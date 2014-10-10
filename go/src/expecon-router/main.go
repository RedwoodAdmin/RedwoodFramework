package main

import (
	"websocket"
	"encoding/json"
	"flag"
	"fmt"
	"redis-go"
	"log"
	"net/http"
	"strconv"
	"strings"
)

/*
	Redis Schema
		"sessions"
		"session:%s:%d" instance, id
		"session_objs:%s:%d" instance, id
		"period:%s:%d:%s" instance, id
		"group:%s:%d:%s" instance, id
		"page:%s:%d:%s" instance, id
*/

type Subject struct {
	name          string
	period, group int
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
	ack         chan bool
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

func (msg *Msg) identical_to(otherMsg *Msg) bool {
	// Test equality of all properties except for the ack channel
	// some of these comparisons may not be necessary
	return otherMsg != nil &&
	       msg.Instance    == otherMsg.Instance &&
	       msg.Session     == otherMsg.Session &&
	       msg.Nonce       == otherMsg.Nonce &&
	       msg.Sender      == otherMsg.Sender &&
	       msg.Period      == otherMsg.Period &&
	       msg.Group       == otherMsg.Group &&
	       msg.StateUpdate == otherMsg.StateUpdate &&
	       msg.Time        == otherMsg.Time &&
	       msg.ClientTime  == otherMsg.ClientTime &&
	       msg.Key         == otherMsg.Key
}

type SubjectRequest struct {
	instance string
	session  int
	name     string
	response chan *Subject
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

func newRouter(redis_host string, redis_db int) (r *Router) {
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
	log.Printf("loading %d sessions from redis", len(sessions))
	for _, session_bytes := range sessions {
		key := string(session_bytes)
		components := strings.Split(key, ":")
		instance := components[1]
		id, err := strconv.Atoi(components[2])
		if err != nil {
			log.Fatal(err)
		}
		session := r.get_session(instance, id)

		session_objs_key := fmt.Sprintf("session_objs:%s:%d", instance, id)
		session_objs, _ := session.router.db.Smembers(session_objs_key)
		for _, key := range session_objs {

			components = strings.Split(string(key), ":")
			key_type := components[0]
			obj_instance := components[1]
			obj_id, err := strconv.Atoi(components[2])
			if err != nil {
				panic(err)
			}
			if obj_instance != instance || obj_id != id {
				panic("session_objs has object with different instance/id")
			}
			subject := components[3]
			if session.subjects[subject] == nil {
				session.subjects[subject] = &Subject{name: subject}
			}
			switch key_type {
			case "period":
				period_key := fmt.Sprintf("period:%s:%d:%s", instance, id, subject)
				period_bytes, err := r.db.Get(period_key)
				if err != nil {
					panic(err)
				}
				period, err := strconv.Atoi(string(period_bytes))
				if err != nil {
					panic(err)
				}
				session.subjects[subject].period = period
			case "group":
				group_key := fmt.Sprintf("group:%s:%d:%s", instance, id, subject)
				group_bytes, err := r.db.Get(group_key)
				if err != nil {
					panic(err)
				}
				group, err := strconv.Atoi(string(group_bytes))
				if err != nil {
					panic(err)
				}
				session.subjects[subject].group = group
			case "config":
				config_key := fmt.Sprintf("config:%s:%d:%s", instance, id, subject)
				config_bytes, err := r.db.Get(config_key)
				if err != nil {
					panic(err)
				}
				var config Msg
				if err = json.Unmarshal(config_bytes, &config); err != nil {
					panic(err)
				}
				session.last_cfg = &config
			}
		}
	}
	return r
}

func main() {
	var help bool
	var redis_host string
	var redis_db int
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

	StartUp(redis_host, redis_db, port, nil)
}

func StartUp(redis_host string, redis_db, port int, ready chan bool) {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	router := newRouter(redis_host, redis_db)
	go router.route()
	log.Println("router routing")
	websocketHandler := websocket.Handler(func(c *websocket.Conn) {
		router.handle_ws(c)
		c.Close()
	})
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		websocketHandler.ServeHTTP(w, r)
	})
	log.Printf("listening on port %d", port)
	if ready != nil {
		ready <- true
	}
	err := http.ListenAndServe(fmt.Sprintf(":%d", port), nil)
	if err != nil {
		log.Panicln(err)
	}
}
