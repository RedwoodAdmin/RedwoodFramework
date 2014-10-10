package main

import(
    "time"
    "fmt"
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
        msg.save(s.router.db)
        for id := range s.listeners {
            send(s, msg, s.listeners[id], s.router.removeListeners)
        }
    }
    return subject
}

func (s *Session) set_session_object(obj_key string, obj_bytes []byte) error {
    var err error
    if err = s.router.db.Set(obj_key, []byte(obj_bytes)); err != nil {
        return err
    }
    if _, err = s.router.db.Sadd(fmt.Sprintf("session_objs:%s:%d", s.instance, s.id), []byte(obj_key)); err != nil {
        return err
    }
    return nil
}

func (s *Session) recv(msg *Msg) {
    if msg.Key != "__reset__" && msg.Key != "__delete__" {
        msg.save(s.router.db)
    }
    for id := range s.listeners {
        send(s, msg, s.listeners[id], s.router.removeListeners)
    }
}

func (s *Session) reset() {
    s.nonce = uuid()
    session_objs_key := fmt.Sprintf("session_objs:%s:%d", s.instance, s.id)
    session_objs, _ := s.router.db.Smembers(session_objs_key)
    for i := range session_objs {
        s.router.db.Del(string(session_objs[i]))
    }
    s.router.db.Del(session_objs_key)
    s.subjects = make(map[string]*Subject)
    s.last_state_update = make(map[string]map[string]*Msg)
    session_key := fmt.Sprintf("session:%s:%d", s.instance, s.id)
    s.router.db.Del(session_key)
    s.router.db.Srem("sessions", []byte(session_key))
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