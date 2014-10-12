package main

import(
    "websocket"
    "encoding/json"
    "net/url"
    "strconv"
    "strings"
    "time"
    "fmt"
    "log"
)

type Router struct {
    messages        chan *Msg
    newListeners    chan *Listener
    requestSubject  chan *SubjectRequest
    removeListeners chan *Listener
    sessions        map[string]map[int]*Session
    db           *Database
}

func NewRouter(redis_host string, redis_db int) (r *Router) {
    r = new(Router)
    r.messages = make(chan *Msg, 100)
    r.newListeners = make(chan *Listener, 100)
    r.removeListeners = make(chan *Listener, 100)
    r.requestSubject = make(chan *SubjectRequest, 100)
    r.sessions = make(map[string]map[int]*Session)

    r.db = NewDatabase(redis_host, redis_db)
    // populate the in-memory queues with persisted redis data

    sessionIDs, err := r.db.GetSessionIDs()
    if err != nil {
        log.Fatal(err)
    }

    log.Printf("loading %d sessions from redis", len(sessionIDs))
    for _, sessionID := range sessionIDs {

        session := r.get_session(sessionID.instance, sessionID.id)
        sessionObjectIDs, err := r.db.GetSessionObjectIDs(sessionID)
        if err != nil {
            log.Print(err)
        }
        for _, objectID := range sessionObjectIDs {

            subject := objectID.subject
            if session.subjects[subject] == nil {
                session.subjects[subject] = &Subject{name: subject}
            }

            switch objectID.objectType {
            case "period":
                period, err := r.db.GetPeriod(objectID)
                if err != nil {
                    panic(err)
                }
                session.subjects[subject].period = period
            case "group":
                group, err := r.db.GetGroup(objectID)
                if err != nil {
                    panic(err)
                }
                session.subjects[subject].group = group
            case "config":
                config, err := r.db.GetConfig(objectID)
                if err != nil {
                    panic(err)
                }
                session.last_cfg = config
            }
        }
    }
    return r
}

func (r *Router) get_session(instance string, id int) *Session {
    instance_sessions, exists := r.sessions[instance]
    if !exists {
        instance_sessions = make(map[int]*Session)
        r.sessions[instance] = instance_sessions
    }
    session, exists := instance_sessions[id]
    if !exists {
        session = &Session{
            db_key:            fmt.Sprintf("session:%s:%d", instance, id),
            router:            r,
            instance:          instance,
            id:                id,
            nonce:             uuid(),
            listeners:         make(map[string]*Listener),
            subjects:          make(map[string]*Subject),
            last_state_update: make(map[string]map[string]*Msg),
        }
        instance_sessions[id] = session
    }
    return session
}

// handle receives messages on the given websocket connection, decoding them
// from JSON to a Msg object. It adds a channel to listeners, encoding messages
// received on the listener channel as JSON, then sending it over the connection.
func (r *Router) handle_ws(c *websocket.Conn) {
    u, err := url.Parse(c.LocalAddr().String())
    if err != nil {
        log.Println(err)
        return
    }

    // split url path into components, e.g.
    // url: http://leeps.ucsc.edu/redwood/session/1/subject1@example.com
    // path: /redwood/session/1/subject1@example.com
    // -> [redwood, session, 1, subject1@example.com]
    components := strings.Split(u.Path, "/")

    // map components into instance_prefix, session_id, and subject_name
    var instance, session_id_string, subject_name string
    if len(components) >= 4 {
        instance = components[1]
        session_id_string = components[2]
        subject_name = components[3]
    } else {
        session_id_string = components[1]
        subject_name = components[2]
    }

    session_id, err := strconv.Atoi(session_id_string)
    if err != nil {
        log.Println(err)
        return
    }

    var subject *Subject
    if subject_name == "admin" || subject_name == "listener" {
        subject = &Subject{name: subject_name, period: -1, group: -1}
    } else {
        // put in a request to the server loop for the given subject object
        // this ensures only one subject object exists per session/name pair
        request := &SubjectRequest{instance: instance, session: session_id, name: subject_name, response: make(chan *Subject)}
        r.requestSubject <- request
        subject = <-request.response
    }
    if subject == nil {
        log.Panicln("nil subject")
    }

    listener := NewListener(r, instance, session_id, subject, c)
    r.newListeners <- listener
    
    log.Printf("STARTED SYNC: %s\n", subject.name);
    listener.sync()
    log.Printf("FINISHED SYNC: %s\n", subject.name);

    go listener.SendLoop()
    listener.ReceiveLoop();
}

func (r *Router) handle_msg(msg *Msg) {
    defer func() {
        msg.ack <- true
    }()
    var err error
    msg.Time = time.Now().UnixNano()
    session := r.get_session(msg.Instance, msg.Session)
    if msg.Nonce != session.nonce {
        return
    }
    if msg.StateUpdate {
        last_msgs, exists := session.last_state_update[msg.Key]
        if !exists {
            last_msgs = make(map[string]*Msg)
            session.last_state_update[msg.Key] = last_msgs
        }
        last_msgs[msg.Sender] = msg
    }

    sessionID := SessionID{instance: msg.Instance, id: msg.Session}
    objectID := SessionObjectID{
        objectType: "",
        sessionID: sessionID,
        subject: msg.Sender,
    }

    switch msg.Key {
    case "__set_period__":
        v := msg.Value.(map[string]interface{})
        subject := session.subjects[msg.Sender]
        subject.period = int(v["period"].(float64))
        msg.Period = int(v["period"].(float64))
        period_bytes := fmt.Sprintf("%d", subject.period)

        objectID.objectType = "period"
        if r.db.SetSessionObject(objectID, []byte(period_bytes)); err != nil {
            panic(err)
        }
    case "__set_group__":
        v := msg.Value.(map[string]interface{})
        subject := session.subjects[msg.Sender]
        subject.group = int(v["group"].(float64))
        msg.Group = int(v["group"].(float64))
        group_bytes := fmt.Sprintf("%d", subject.group)

        objectID.objectType = "group"
        if r.db.SetSessionObject(objectID, []byte(group_bytes)); err != nil {
            panic(err)
        }
    case "__set_page__":
        page_bytes := []byte(msg.Value.(map[string]interface{})["page"].(string))

        objectID.objectType = "page"
        if r.db.SetSessionObject(objectID, []byte(page_bytes)); err != nil {
            panic(err)
        }
    case "__set_config__":
        session.last_cfg = msg
        config_bytes, err := json.Marshal(msg)
        if err != nil {
            panic(err)
        }

        objectID.objectType = "config"
        if r.db.SetSessionObject(objectID, []byte(config_bytes)); err != nil {
            panic(err)
        }
    case "__reset__":
        session.reset()
    case "__delete__":
        session.delete()
    }
    if err == nil {
        session.recv(msg)
    } else {
        errMsg := &Msg{
            Instance: msg.Instance,
            Session:  msg.Session,
            Sender:   "server",
            Period:   0,
            Group:    0,
            Time:     time.Now().UnixNano(),
            Key:      "__error__",
            Value:    err.Error()}
        session.recv(errMsg)
    }
}

// route listens for incoming messages, routing them to applicable listeners.
// handles control messages
func (r *Router) route() {
    for {
        select {
        case listener := <-r.newListeners:
            session := r.get_session(listener.instance, listener.session_id)
            session.listeners[listener.subject.name] = listener
        case request := <-r.requestSubject:
            session := r.get_session(request.instance, request.session)
            request.response <- session.get_subject(request.name)
        case msg := <-r.messages:
            r.handle_msg(msg)
        case listener := <-r.removeListeners:
            session := r.get_session(listener.instance, listener.session_id)
            for id := range session.listeners {
                if listener == session.listeners[id] {
                    delete(session.listeners, id)
                }
            }
        }
    }
}
