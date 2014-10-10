package main

import (
	"websocket"
	"flag"
	"fmt"
	"log"
	"net/http"
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
	router := NewRouter(redis_host, redis_db)
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
