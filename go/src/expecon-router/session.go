package main

import(
    "time"
    "log"
)

type Session struct {
    db_key            string
    router            *Router
    instance          string
    id                int
    nonce             string
    listeners         map[string]*Listener
    subjects          map[string]*Subject
    last_state_update map[string]map[string]*Msg
    last_cfg          *Msg
}

func (s *Session) get_subject(name string) *Subject {
    subject, exists := s.subjects[name]
    if !exists {
        subject = &Subject{name: name}
        s.subjects[subject.name] = subject
        msg := &Msg{
            Instance: s.instance,
            Session:  s.id,
            Nonce:    s.nonce,
            Sender:   name,
            Time:     time.Now().UnixNano(),
            Key:      "__register__",
            Value:    map[string]string{"user_id": name},
            Period:   0,
            Group:    0,
        }
        if err := s.router.db.SaveMessage(msg); err != nil {
            log.Fatal(err)
        }
        for id := range s.listeners {
            s.listeners[id].Send(msg)
        }
    }
    return subject
}

func (s *Session) recv(msg *Msg) {
    if msg.Key != "__reset__" && msg.Key != "__delete__" {
        if err := s.router.db.SaveMessage(msg); err != nil {
            log.Fatal(err)
        }
    }
    for id := range s.listeners {
        s.listeners[id].Send(msg)
    }
}

func (s *Session) reset() {
    s.nonce = uuid()
    s.subjects = make(map[string]*Subject)
    s.last_state_update = make(map[string]map[string]*Msg)

    sessionID := SessionID{instance: s.instance, id: s.id}
    s.router.db.DeleteSession(sessionID)

    // replay last config
    if s.last_cfg != nil {
        s.last_cfg.Nonce = s.nonce
        s.last_cfg.ack = make(chan bool, 1)
        s.router.handle_msg(s.last_cfg)
        <-s.last_cfg.ack
    }
}

func (s *Session) delete() {
    s.reset()
    delete(s.router.sessions[s.instance], s.id)
}