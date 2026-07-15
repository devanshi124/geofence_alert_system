package websocket

import (
	"log"

	"vehicle-alert-system/internal/models"
)

type Hub struct {
	clients    map[*Client]struct{}
	register   chan *Client
	unregister chan *Client
	broadcast  chan models.GeneratedAlert
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]struct{}),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan models.GeneratedAlert, 256),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = struct{}{}

		case client := <-h.unregister:
			if _, exists := h.clients[client]; exists {
				delete(h.clients, client)
				close(client.send)
			}

		case alert := <-h.broadcast:
			message := NewAlertMessage(alert)

			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					delete(h.clients, client)
					close(client.send)

					log.Printf(
						"websocket client removed: send buffer full",
					)
				}
			}
		}
	}
}

func (h *Hub) Publish(alert models.GeneratedAlert) {
	select {
	case h.broadcast <- alert:
	default:
		log.Printf(
			"websocket alert dropped: broadcast buffer full",
		)
	}
}
