package models

import "time"

// Coordinate represents [latitude, longitude] in the external API.
type Coordinate []float64

type CreateGeofenceRequest struct {
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Coordinates []Coordinate `json:"coordinates"`
	Category    string       `json:"category"`
}

type CreateGeofenceResponse struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Status string `json:"status"`
	TimeNS string `json:"time_ns"`
}

type Geofence struct {
	ID          string       `json:"id"`
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Coordinates []Coordinate `json:"coordinates"`
	Category    string       `json:"category"`
	CreatedAt   time.Time    `json:"created_at"`
}

type GetGeofencesResponse struct {
	Geofences []Geofence `json:"geofences"`
	TimeNS    string     `json:"time_ns"`
}
