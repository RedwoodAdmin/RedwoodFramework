package main

import (
	"websocket"
	"redis-go"
	"encoding/json"
	"log"
	"time"
	"testing"
	"fmt"
	"sync"
)

var once sync.Once
var redisHost = "127.0.0.1:6379"
var redisDB = 1

func setupRouter() {
	once.Do(func() {
		ready := make(chan bool)
		go StartUp(redisHost, redisDB, 8080, ready)
		<- ready
	})
	// clear database
	client := &redis.Client{Addr: redisHost, Db: redisDB}
	client.Flush(false)
}

func setupClient(clientID int) (*websocket.Conn, error) {
	var ws *websocket.Conn
	var err error
	url := fmt.Sprintf("ws://127.0.0.1:8080/redwood/1/%d", clientID)
	for timeout := 1; ; timeout *= 2 {
		ws, err = websocket.Dial(url, "", "http://127.0.0.1")
		if err == nil {
			return ws, nil
		}
		if timeout <= 20 {
			log.Printf("Trying to connect to websocket failed, sleeping %ds", timeout)
			time.Sleep(time.Duration(timeout) * time.Second)
		} else {
			return nil, err
		}
	}
}

// Test sync between multiple clients
// only synchronizes __register__ messages
func TestSync(t *testing.T) {
	setupRouter()
	// Make client connections
	connection_count := 10
	finished := make(chan *websocket.Conn)
	for i := 1; i <= connection_count; i++ {
		conn, err := setupClient(i); 
		go func() {
			if err != nil {
				t.Fatal(err)
			}
			registered := make(chan int)
			go func() {
				d := json.NewDecoder(conn)
				for {
					var msg Msg
					if err := d.Decode(&msg); err != nil {
						return
					}
					if msg.Key == "__register__" {
						registered <- 1
					}
				}
			}()
			// Wait for all clients to register by
			// draining registered channel
			for j := 1; j <= connection_count; j++ {
				<- registered
			}
			finished <- conn
		}()
		time.Sleep(time.Duration(100) * time.Millisecond)
	}

	// Drain finished channel
	for i := 1; i <= connection_count; i++ {
		conn := <- finished
		conn.Close()
	}
}

func TestIntegration(t *testing.T) {
	setupRouter()
	ws, err := setupClient(1); 
	if err != nil {
		t.Fatal(err)
	}
	log.Println("Connect to router via websocket!")
	nonce_chan := make(chan string)
	go func() {
		d := json.NewDecoder(ws)
		for {
			var msg Msg
			if err := d.Decode(&msg); err != nil {
				return
			}
			t.Log(msg)
			if msg.Key == "__queue_start__" {
				nonce_chan <- msg.Nonce
			}
		}
	}()
	nonce := <-nonce_chan
	e := json.NewEncoder(ws)
	MSGS := 100000
	for i := 0; i < MSGS; i++ {
		if i % 1000 == 0 {
			log.Printf("Sending message %d of %d", i, MSGS)
		}
		msg := Msg{
			Instance: "redwood",
			Session: 1,
			Nonce: nonce,
			Sender: "1",
			Period: 0,
			Group: 0,
			StateUpdate: false,
			Time: 0,
			ClientTime: 0,
			Key: "foo",
			Value: "bar",
		}
		if err := e.Encode(msg); err != nil {
			t.Fatal(err)
		}
	}
	ws.Close()
}
