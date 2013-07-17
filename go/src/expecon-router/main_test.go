package main

import (
	"code.google.com/p/go.net/websocket"
	"encoding/json"
	"log"
	"time"
	"testing"
)

func TestIntegration(t *testing.T) {
	ready := make(chan bool)
	go StartUp("127.0.0.1:6379", 1, 8080, ready)
	<-ready
	var ws *websocket.Conn
	var err error
	for timeout := 1; ; timeout *= 2 {
		ws, err = websocket.Dial("ws://127.0.0.1:8080/redwood/1/1", "", "http://127.0.0.1")
		if err == nil {
			break
		}
		if timeout <= 20 {
			log.Printf("Trying to connect to websocket failed, sleeping %ds", timeout)
			time.Sleep(time.Duration(timeout) * time.Second)
		} else {
			t.Fatal(err)
		}
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
