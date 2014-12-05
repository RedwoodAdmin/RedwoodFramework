package main

import(
    "time"
    "log"
    "encoding/json"
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

func (s *Session) Subject(name string) *Subject {
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
        s.Receive(msg)
    }
    return subject
}

func (s *Session) Receive(msg *Msg) {
    if msg.Key != "__reset__" && msg.Key != "__delete__" {
        if err := s.router.db.SaveMessage(msg); err != nil {
            log.Fatal(err)
        }
    }
    bytes, err := json.Marshal(msg)
    if err != nil {
        log.Fatal(err) // not really a good idea to fatal here
    }
    for _, listener := range s.listeners {
        if listener.match(s, msg) {
            listener.Send(bytes)
        }
    }
}

func (s *Session) Reset() {
    s.nonce = uuid()
    s.subjects = make(map[string]*Subject)
    s.last_state_update = make(map[string]map[string]*Msg)

    sessionID := SessionID{instance: s.instance, id: s.id}
    s.router.db.DeleteSession(sessionID)

    // replay last config
    if s.last_cfg != nil {
        s.last_cfg.Nonce = s.nonce
        s.last_cfg.ack = make(chan bool, 1)
        s.router.HandleMessage(s.last_cfg)
        <-s.last_cfg.ack
    }
}

func (s *Session) Delete() {
    s.Reset()
    delete(s.router.sessions[s.instance], s.id)
}