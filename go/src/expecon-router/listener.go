package main

import(
    "websocket"
    "encoding/json"
    "time"
    "log"
)

type Listener struct {
    router     *Router
    instance   string
    session_id int
    subject    *Subject
    recv       chan []byte
    conn       *websocket.Conn
    encoder    *json.Encoder
    decoder    *json.Decoder
}

func NewListener(router *Router, instance string, session_id int, subject *Subject, connection *websocket.Conn) *Listener {
    listener := &Listener{
        router:     router,
        instance:   instance,
        session_id: session_id,
        subject:    subject,
        recv:       make(chan []byte, 100),
        conn:       connection,
        encoder:    json.NewEncoder(connection),
        decoder:    json.NewDecoder(connection),
    }
    return listener;
}

// send msg to the given Listener
// If it fails for any reason, l is added to the remove queue.
func (l *Listener) Send(rawMessage []byte) {
    if l.router.removeListeners != nil {
        defer func() {
            // If send on l.recv fails, then remove the listener
            if err := recover(); err != nil {
                l.router.removeListeners <- l
            }
        }()
    }
    l.recv <- rawMessage
}

func (l *Listener) SendLoop() {
    defer func() {
        close(l.recv)
    }()
    for {
        msg, ok := <- l.recv
        if !ok {
            return
        }
        if _, err := l.conn.Write(msg)/*l.encoder.Encode(msg)*/; err != nil {
            return
        }
    }
}

func (l *Listener) ReceiveLoop() {
    for {
        var msg Msg
        if err := l.decoder.Decode(&msg); err != nil {
            return
        }
        msg.Instance = l.instance
        msg.Session = l.session_id
        if msg.Sender == "" && l.subject.name != "" {
            msg.Sender = l.subject.name
        }
        switch msg.Key {
        case "__get_period__":
            v := msg.Value.(map[string]interface{})
            period := int(v["period"].(float64))
            msgs := make([]*Msg, 0)

            allMessages, err := l.router.db.Messages(SessionID{l.instance, l.session_id})
            if err != nil {
                log.Fatal(err)
            }
            for msg := range allMessages {
                if period == 0 || msg.Period == period {
                    msgs = append(msgs, msg)
                }
            }
            bytes, err := json.Marshal(&Msg{Key: "__get_period__", Value: msgs})
            if err != nil {
                log.Fatal("could not marshal __get_period__ message")
            }
            l.recv <- bytes
        default:
            l.router.messages <- &msg
        }
    }
}

// push requested messages from queue to w, in between to fictitious start and end messages
func (l *Listener) Sync() {
    session := l.router.Session(l.instance, l.session_id)

    queueStartMessage := &Msg{
        Time: time.Now().UnixNano(),
        Key: "__queue_start__",
        Nonce: session.nonce,
    }
    l.encoder.Encode(queueStartMessage);

    messages, err := l.router.db.Messages(SessionID{l.instance, l.session_id})
    if err != nil {
        log.Fatal(err)
    }
    for msg := range messages {
        if l.match(session, msg) {
            l.encoder.Encode(&msg)
        }
    }

    queueEndMessage := &Msg{
        Time: time.Now().UnixNano(),
        Key: "__queue_end__",
        Nonce: session.nonce,
    }
    l.encoder.Encode(queueEndMessage);
    log.Printf("Finished sync for %p", l)
}

func (l *Listener) match(session *Session, msg *Msg) bool {
    if l.subject.name == "listener" {
        return true
    }
    // keeping this for backwards compatibility reasons
    // otherwise admin doesn't receive everything
    // needed for redwood 2 admin pause controls and other things
    if l.subject.name == "admin" {
        return true
    }
    //
    control :=
        msg.Key == "__register__" ||
            msg.Key == "__pause__" ||
            msg.Key == "__reset__" ||
            msg.Key == "__delete__" ||
            msg.Key == "__error__"
    session_state :=
        msg.Key == "__set_period__" ||
            msg.Key == "__set_group__" ||
            msg.Key == "__set_page__"
    is_admin := l.subject.name == "admin"
    same_period := msg.Period == l.subject.period || msg.Period == 0
    same_group := msg.Group == l.subject.group || msg.Group == 0
    last_state_update_msg := session.last_state_update[msg.Key][msg.Sender]
    is_relevant := !msg.StateUpdate || msg.IdenticalTo(last_state_update_msg)

    return control || (session_state && is_relevant && (is_admin || (same_period && same_group))) || (same_period && same_group && is_relevant)
}