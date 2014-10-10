package main

import(
    "redis-go"
    "encoding/json"
    "log"
    "fmt"
)

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
