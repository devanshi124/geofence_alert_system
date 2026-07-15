package websocket

import (
	"net/http"
	"time"

	gorilla "github.com/gorilla/websocket"

	"vehicle-alert-system/internal/models"
)

const (
	writeWait  = 10 * time.Second
	pongWait   = 60 * time.Second
	pingPeriod = 54 * time.Second
)

type Client struct {
	hub  *Hub
	conn *gorilla.Conn
	send chan AlertMessage
}

type AlertMessage struct {
	EventID   string        `json:"event_id"`
	EventType string        `json:"event_type"`
	Timestamp time.Time     `json:"timestamp"`
	Vehicle   AlertVehicle  `json:"vehicle"`
	Geofence  AlertGeofence `json:"geofence"`
	Location  AlertLocation `json:"location"`
}

type AlertVehicle struct {
	VehicleID     string `json:"vehicle_id"`
	VehicleNumber string `json:"vehicle_number"`
	DriverName    string `json:"driver_name"`
}

type AlertGeofence struct {
	GeofenceID   string `json:"geofence_id"`
	GeofenceName string `json:"geofence_name"`
	Category     string `json:"category"`
}

type AlertLocation struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

func NewAlertMessage(
	alert models.GeneratedAlert,
) AlertMessage {
	return AlertMessage{
		EventID:   alert.AlertID,
		EventType: alert.EventType,
		Timestamp: alert.EventTimestamp,

		Vehicle: AlertVehicle{
			VehicleID:     alert.VehicleID,
			VehicleNumber: alert.VehicleNumber,
			DriverName:    alert.DriverName,
		},

		Geofence: AlertGeofence{
			GeofenceID:   alert.GeofenceID,
			GeofenceName: alert.GeofenceName,
			Category:     alert.GeofenceCategory,
		},

		Location: AlertLocation{
			Latitude:  alert.Latitude,
			Longitude: alert.Longitude,
		},
	}
}

var upgrader = gorilla.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,

	// Development only.
	//
	// Tighten this when the frontend origin is known.
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func ServeAlerts(
	hub *Hub,
	w http.ResponseWriter,
	r *http.Request,
) {
	conn, err := upgrader.Upgrade(
		w,
		r,
		nil,
	)

	if err != nil {
		return
	}

	client := &Client{
		hub:  hub,
		conn: conn,
		send: make(chan AlertMessage, 64),
	}

	hub.register <- client

	go client.writePump()
	go client.readPump()
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		_ = c.conn.Close()
	}()

	c.conn.SetReadLimit(1024)

	_ = c.conn.SetReadDeadline(
		time.Now().Add(pongWait),
	)

	c.conn.SetPongHandler(
		func(string) error {
			return c.conn.SetReadDeadline(
				time.Now().Add(pongWait),
			)
		},
	)

	for {
		if _, _, err := c.conn.ReadMessage(); err != nil {
			break
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)

	defer func() {
		ticker.Stop()
		_ = c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(
				time.Now().Add(writeWait),
			)

			if !ok {
				_ = c.conn.WriteMessage(
					gorilla.CloseMessage,
					[]byte{},
				)
				return
			}

			if err := c.conn.WriteJSON(message); err != nil {
				return
			}

		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(
				time.Now().Add(writeWait),
			)

			if err := c.conn.WriteMessage(
				gorilla.PingMessage,
				nil,
			); err != nil {
				return
			}
		}
	}
}
