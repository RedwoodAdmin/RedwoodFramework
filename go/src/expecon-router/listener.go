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
    recv       chan *Msg
    encoder    *json.Encoder
    decoder    *json.Decoder
}

func NewListener(router *Router, instance string, session_id int, subject *Subject, connection *websocket.Conn) *Listener {
    listener := &Listener{
        router:     router,
        instance:   instance,
        session_id: session_id,
        subject:    subject,
        recv:       make(chan *Msg, 100),
        encoder:    json.NewEncoder(connection),
        decoder:    json.NewDecoder(connection),
    }
    return listener;
}

// send msg to the given Listener
// If it fails for any reason, l is added to the remove queue.
func (l *Listener) Send(msg *Msg) {
    session := l.router.get_session(l.instance, l.session_id)
    if l.match(session, msg) {
        if l.router.removeListeners != nil {
            defer func() {
                if err := recover(); err != nil {
                    l.router.removeListeners <- &ListenerRequest{l, nil}
                }
            }()
        }
        l.recv <- msg
    }
}

func (l *Listener) SendLoop() {
    for {
        msg, ok := <- l.recv
        if !ok {
            return
        }
        if err := l.encoder.Encode(msg); err != nil {
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

            allMessages, err := l.router.db.GetMessages(SessionID{l.instance, l.session_id})
            if err != nil {
                log.Fatal(err)
            }
            for msg := range allMessages {
                if period == 0 || msg.Period == period {
                    msgs = append(msgs, msg)
                }
            }
            l.recv <- &Msg{Key: "__get_period__", Value: msgs}
        default:
            msg.ack = make(chan bool)
            l.router.messages <- &msg
            <-msg.ack
        }
    }
}

// push requested messages from queue to w, in between to fictitious start and end messages
func (l *Listener) sync() {
    session := l.router.get_session(l.instance, l.session_id)

    queueStartMessage := &Msg{
        Time: time.Now().UnixNano(),
        Key: "__queue_start__",
        Nonce: session.nonce,
    }
    l.encoder.Encode(queueStartMessage);

    messages, err := l.router.db.GetMessages(SessionID{l.instance, l.session_id})
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
    is_relevant := !msg.StateUpdate || msg.identical_to(last_state_update_msg)

    return control || (session_state && is_relevant && (is_admin || (same_period && same_group))) || (same_period && same_group && is_relevant)
}