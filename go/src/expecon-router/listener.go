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
    connection *websocket.Conn
}

// send msg to the given Listener
// If it fails for any reason, e is added to the remove queue.
func (l *Listener) send(session *Session, msg *Msg, remove chan *Listener) {
    if l.match(session, msg) {
        if remove != nil {
            defer func() {
                if err := recover(); err != nil {
                    remove <- l
                }
            }()
        }
        l.recv <- msg
    }
}

func (l *Listener) send_from_channel(channel <-chan *Msg) {
    go func() {
        e := json.NewEncoder(l.connection)
        for {
            msg, ok := <- channel
            if !ok {
                return
            }
            log.Printf("%s, %s, %d, %s from %p\n", msg.Sender, l.subject.name, msg.Period, msg.Key, channel);
            if err := e.Encode(msg); err != nil {
                return
            }
        }
    }()
}

// push requested messages from queue to w, in between to fictitious start and end messages
func (l *Listener) sync() {
    sync_channel := make(chan *Msg)
    l.send_from_channel(sync_channel)

    session := l.router.get_session(l.instance, l.session_id)
    sync_channel <- &Msg{Time: time.Now().UnixNano(), Key: "__queue_start__", Nonce: session.nonce}
    msg_bytes, err := session.router.db.Lrange(session.db_key, 0, -1)
    if err != nil {
        log.Fatal(err)
    }
    for _, b := range msg_bytes {
        var msg Msg
        if err = json.Unmarshal(b, &msg); err != nil {
            log.Fatal(err)
        }
        if l.match(session, &msg) {
            sync_channel <- &msg
        }
    }
    sync_channel <- &Msg{Time: time.Now().UnixNano(), Key: "__queue_end__", Nonce: session.nonce}
    close(sync_channel)
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