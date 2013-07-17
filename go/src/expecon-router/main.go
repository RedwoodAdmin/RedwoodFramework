package main

import (
	"websocket"
	"container/list"
	"encoding/json"
	"flag"
	"fmt"
	"redis-go"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

/*
	Redis Schema
		sessions - set of integer session ids
		session:<instance>:<id int> - list of json-encoded messages
*/

type Router struct {
	messages        chan *Msg
	newListeners    chan *Listener
	requestSubject  chan *SubjectRequest
	removeListeners chan *Listener
	sessions        map[string]map[int]*Session
	db              *redis.Client
}

type Session struct {
	router            *Router
	instance          string
	id                int
	nonce             string
	listeners         map[string]*Listener
	queue             *list.List
	subjects          map[string]*Subject
	last_state_update map[string]map[string]*Msg
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
			router:            r,
			instance:          instance,
			id:                id,
			nonce:             uuid(),
			listeners:         make(map[string]*Listener),
			queue:             list.New(),
			subjects:          make(map[string]*Subject),
			last_state_update: make(map[string]map[string]*Msg),
		}
		instance_sessions[id] = session
	}
	return session
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
		s.queue.PushBack(msg)
		msg.save(s.router.db)
		for id := range s.listeners {
			send(s, msg, s.listeners[id], s.router.removeListeners)
		}
	}
	return subject
}

func (s *Session) recv(msg *Msg) {
	if msg.Key != "__reset__" && msg.Key != "__delete__" {
		s.queue.PushBack(msg)
		msg.save(s.router.db)
	}
	for id := range s.listeners {
		send(s, msg, s.listeners[id], s.router.removeListeners)
	}
}

func (s *Session) reset() {
	s.nonce = uuid()
	var last_cfg *Msg
	for n := s.queue.Front(); n != nil; n = n.Next() {
		m := n.Value.(*Msg)
		if m.Key == "__set_config__" {
			last_cfg = m;
		}
	}
	s.queue.Init()
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
	if last_cfg != nil {
		last_cfg.Nonce = s.nonce
		last_cfg.ack = make(chan bool, 1)
		s.router.handle_msg(last_cfg)
		<-last_cfg.ack
	}
}

func (s *Session) delete() {
	s.reset()
	delete(s.router.sessions[s.instance], s.id)
}

type Subject struct {
	name          string
	period, group int
}

type Listener struct {
	router     *Router
	instance   string
	session_id int
	subject    *Subject
	recv       chan *Msg
}

// Messages are namespaced by a session identifier. Group is set by the Redwood
// server. Only receivers in the same group as sender will receive the message.
//
// Time, also set by the server, provides a unique message ordering.
//
// Key, and Value are all set by the sender.
type Msg struct {
	Instance    string
	Session     int
	Nonce       string
	Sender      string
	Period      int
	Group       int
	StateUpdate bool
	Time        int64
	ClientTime  uint64
	Key         string
	Value       interface{}
	ack					chan bool
}

func (m *Msg) save(db *redis.Client) {
	key := fmt.Sprintf("session:%s:%d", m.Instance, m.Session)
	db.Sadd("sessions", []byte(key))
	if b, err := json.Marshal(m); err == nil {
		db.Rpush(key, b)
	} else {
		log.Fatal(err)
	}
}

type SubjectRequest struct {
	instance string
	session  int
	name     string
	response chan *Subject
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
	listener := &Listener{
		router:     r,
		instance:   instance,
		session_id: session_id,
		subject:    subject,
		recv:       make(chan *Msg, 100)}
	r.newListeners <- listener
	go func() {
		defer func() {
			close(listener.recv)
		}()
		e := json.NewEncoder(c)
		for {
			if err := e.Encode(<-listener.recv); err != nil {
				return
			}
		}
	}()
	listener.sync()
	d := json.NewDecoder(c)
	for {
		var msg Msg
		if err := d.Decode(&msg); err != nil {
			return
		}
		msg.Instance = listener.instance
		msg.Session = listener.session_id
		if msg.Sender == "" && listener.subject.name != "" {
			msg.Sender = listener.subject.name
		}
		switch msg.Key {
		case "__get_period__":
			session := r.get_session(instance, session_id)
			v := msg.Value.(map[string]interface{})
			period := int(v["period"].(float64))
			msgs := make([]*Msg, 0)
			for n := session.queue.Front(); n != nil; n = n.Next() {
				m := n.Value.(*Msg)
				if period == 0 || m.Period == period {
					msgs = append(msgs, m)
				}
			}
			listener.recv <- &Msg{Key: "__get_period__", Value: msgs}
		default:
			msg.ack = make(chan bool)
			r.messages <- &msg
			<-msg.ack
		}
	}
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
	switch msg.Key {
	case "__set_period__":
		v := msg.Value.(map[string]interface{})
		subject := session.subjects[msg.Sender]
		subject.period = int(v["period"].(float64))
		msg.Period = int(v["period"].(float64))
		period_key := fmt.Sprintf("period:%s:%d:%s", session.instance, session.id, msg.Sender)
		period_string := fmt.Sprintf("%d", subject.period)
		err = r.db.Set(period_key, []byte(period_string))
		if err == nil {
			_, err = r.db.Sadd(fmt.Sprintf("session_objs:%s:%d", session.instance, session.id), []byte(period_key))
		}
	case "__set_group__":
		v := msg.Value.(map[string]interface{})
		subject := session.subjects[msg.Sender]
		subject.group = int(v["group"].(float64))
		msg.Group = int(v["group"].(float64))
	case "__set_page__":
		page_key := fmt.Sprintf("page:%s:%d:%s", session.instance, session.id, msg.Sender)
		err = r.db.Set(page_key, []byte(msg.Value.(map[string]interface{})["page"].(string)))
		if err == nil {
			_, err = r.db.Sadd(fmt.Sprintf("session_objs:%s:%d", session.instance, session.id), []byte(page_key))
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

// push requested messages from queue to w, in between to fictitious start and end messages
func (l *Listener) sync() {
	session := l.router.get_session(l.instance, l.session_id)
	l.recv <- &Msg{Time: time.Now().UnixNano(), Key: "__queue_start__", Nonce: session.nonce}
	for n := session.queue.Front(); n != nil; n = n.Next() {
		msg := n.Value.(*Msg)
		if l.match(session, msg) {
			l.recv <- msg
		}
	}
	l.recv <- &Msg{Time: time.Now().UnixNano(), Key: "__queue_end__", Nonce: session.nonce}
}

func (l *Listener) match(session *Session, msg *Msg) bool {
	if l.subject.name == "listener" {
		return true
	}
	if l.subject.name == "admin" {
		return true
	}
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
	is_relevant := !msg.StateUpdate || msg == session.last_state_update[msg.Key][msg.Sender]
	return control || (session_state && is_relevant && (is_admin || (same_period && same_group))) || (same_period && same_group && is_relevant)
}

// send msg to the given Listener
// If it fails for any reason, e is added to the remove queue.
func send(session *Session, msg *Msg, l *Listener, remove chan *Listener) {
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

func newRouter() (r *Router) {
	r = new(Router)
	r.messages = make(chan *Msg, 100)
	r.newListeners = make(chan *Listener, 100)
	r.removeListeners = make(chan *Listener, 100)
	r.requestSubject = make(chan *SubjectRequest, 100)
	r.sessions = make(map[string]map[int]*Session)
	r.db = &redis.Client{Addr: redis_host, Db: redis_db}
	// populate the in-memory queues with persisted redis data
	sessions, err := r.db.Smembers("sessions")
	if err != nil {
		log.Fatal(err)
	}
	for _, session_bytes := range sessions {
		key := string(session_bytes)
		components := strings.Split(key, ":")
		instance := components[1]
		id, err := strconv.Atoi(components[2])
		if err != nil {
			log.Fatal(err)
		}
		session := r.get_session(instance, id)
		msgs, err := r.db.Lrange(key, 0, -1)
		if err != nil {
			log.Fatal(err)
		}
		for _, b := range msgs {
			var msg Msg
			if err := json.Unmarshal(b, &msg); err != nil {
				log.Fatal(err)
			}
			switch msg.Key {
			case "__register__":
				session.subjects[msg.Sender] = &Subject{name: msg.Sender}
			case "__set_period__":
				session.subjects[msg.Sender].period = int(msg.Value.(map[string]interface{})["period"].(float64))
			case "__set_group__":
				session.subjects[msg.Sender].group = int(msg.Value.(map[string]interface{})["group"].(float64))
			}
			if msg.StateUpdate {
				last_msgs, exists := session.last_state_update[msg.Key]
				if !exists {
					last_msgs = make(map[string]*Msg)
					session.last_state_update[msg.Key] = last_msgs
				}
				last_msgs[msg.Sender] = &msg
			}
			session.queue.PushBack(&msg)
		}
	}
	return r
}

var redis_host string
var redis_db int

func main() {

	var help bool
	var port int
	flag.BoolVar(&help, "h", false, "Print this usage message")
	flag.StringVar(&redis_host, "redis", "127.0.0.1:6379", "Redis server")
	flag.IntVar(&redis_db, "db", 0, "Redis db")
	flag.IntVar(&port, "port", 8080, "Listen port")
	flag.Parse()

	if help {
		flag.Usage()
		return
	}

	log.SetFlags(log.LstdFlags | log.Lshortfile)
	router := newRouter()
	go router.route()
	websocketHandler := websocket.Handler(func(c *websocket.Conn) {
		router.handle_ws(c)
		c.Close()
	})
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		websocketHandler.ServeHTTP(w, r)
	})
	err := http.ListenAndServe(fmt.Sprintf(":%d", port), nil)
	if err != nil {
		log.Panicln(err)
	}
}
