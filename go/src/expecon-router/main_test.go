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

func flushDB() {
	client := &redis.Client{Addr: redisHost, Db: redisDB}
	client.Flush(false)
}

func setupRouter() {
	once.Do(func() {
		ready := make(chan bool)
		go StartUp(redisHost, redisDB, 8080, ready)
		<- ready
	})
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

func floodRouter(subjectID int, key string, value string, count int) (error) {
	conn, err := setupClient(subjectID); 
	if err != nil {
		return err
	}
	defer conn.Close()

	nonce_chan := make(chan string)
	finished_chan := make(chan bool)
	go func() {
		received_count := 0
		d := json.NewDecoder(conn)
		for {
			var msg Msg
			if err := d.Decode(&msg); err != nil {
				return
			}
			if msg.Key == "__queue_start__" {
				nonce_chan <- msg.Nonce
			}
			if msg.Key == key {
				received_count += 1
				if received_count == count {
					finished_chan <- true
				}
			}
		}
	}()
	nonce := <-nonce_chan
	e := json.NewEncoder(conn)
	for i := 0; i < count; i++ {
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
			Key: key,
			Value: value,
		}
		if err := e.Encode(msg); err != nil {
			return err
		}
	}
	<- finished_chan
	return nil
}

// Test Sync between multiple clients
func TestSync(t *testing.T) {
	flushDB()
	setupRouter()
	// Fill database with 1000 messages
	msg_count := 50000
	floodRouter(1, "sync_test", "placeholder", msg_count)
	// Make client connections
	connection_count := 10
	finished := make(chan *websocket.Conn)
	for i := 1; i <= connection_count; i++ {
		conn, err := setupClient(i); 
		go func() {
			if err != nil {
				t.Fatal(err)
			}
			sync_messages := make(chan int)
			go func() {
				d := json.NewDecoder(conn)
				for {
					var msg Msg
					if err := d.Decode(&msg); err != nil {
						return
					}
					if msg.Key == "sync_test" {
						sync_messages <- 1
					}
				}
			}()
			// Wait for entire message digest to sync
			for j := 1; j <= msg_count; j++ {
				<- sync_messages
			}
			finished <- conn
		}()
	}

	// Drain finished channel
	for i := 1; i <= connection_count; i++ {
		conn := <- finished
		conn.Close()
	}
}

func TestIntegration(t *testing.T) {
	flushDB()
	setupRouter()
	floodRouter(1, "foo", "bar", 100000)
}

func BenchmarkThroughput(b *testing.B) {
	flushDB()
	setupRouter()
	// setup dummy clients to sink messages
	for i := 2; i < 12; i++ {
		conn, err := setupClient(i)
		if err != nil {
			b.Fatal("client setup failed")
		}
		go func() {
			d := json.NewDecoder(conn)
			for {
				var msg Msg
				if err := d.Decode(&msg); err != nil {
					return
				}
			}
		}()
	}
	b.ResetTimer()
	// flood the router with messages
	floodRouter(1, "throughput", "testdata", b.N)
}
