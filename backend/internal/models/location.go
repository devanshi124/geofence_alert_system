package models

import "time"

// ============================================================
// POST /vehicles/location
// ============================================================

type CreateLocationRequest struct {
	VehicleID string    `json:"vehicle_id"`
	Latitude  float64   `json:"latitude"`
	Longitude float64   `json:"longitude"`
	Timestamp time.Time `json:"timestamp"`
}

// Used ONLY by POST /vehicles/location.
//
// Required response:
//
// current_geofences: [
//
//	{
//	    "geofence_id": "...",
//	    "geofence_name": "...",
//	    "status": "inside"
//	}
//
// ]
type GeofenceStatus struct {
	GeofenceID   string `json:"geofence_id"`
	GeofenceName string `json:"geofence_name"`
	Status       string `json:"status"`
}

type CreateLocationResponse struct {
	VehicleID        string           `json:"vehicle_id"`
	LocationUpdated  bool             `json:"location_updated"`
	CurrentGeofences []GeofenceStatus `json:"current_geofences"`
	TimeNS           string           `json:"time_ns"`
}

// ============================================================
// INTERNAL LOCATION MODEL
// ============================================================

type Location struct {
	ID         int64     `json:"id"`
	VehicleID  string    `json:"vehicle_id"`
	Latitude   float64   `json:"latitude"`
	Longitude  float64   `json:"longitude"`
	RecordedAt time.Time `json:"timestamp"`
}

// Internal transaction result.
//
// This is NOT returned directly by an HTTP endpoint.
type LocationProcessResult struct {
	Location         Location
	CurrentGeofences []GeofenceStatus
	GeneratedAlerts  []GeneratedAlert
}

// ============================================================
// GET /vehicles/location/{vehicle_id}
// ============================================================

type CurrentLocation struct {
	Latitude  float64   `json:"latitude"`
	Longitude float64   `json:"longitude"`
	Timestamp time.Time `json:"timestamp"`
}

// Used ONLY by GET /vehicles/location/{vehicle_id}.
//
// Unlike POST /vehicles/location, the problem statement requires
// "category" here instead of "status".
type CurrentGeofence struct {
	GeofenceID   string `json:"geofence_id"`
	GeofenceName string `json:"geofence_name"`
	Category     string `json:"category"`
}

type VehicleLocationResponse struct {
	VehicleID        string            `json:"vehicle_id"`
	VehicleNumber    string            `json:"vehicle_number"`
	CurrentLocation  CurrentLocation   `json:"current_location"`
	CurrentGeofences []CurrentGeofence `json:"current_geofences"`
	TimeNS           string            `json:"time_ns"`
}

// ============================================================
// INTERNAL GENERATED ALERT
// ============================================================

// GeneratedAlert is internal.
//
// Alert events are created inside the location transaction.
// Later, after the transaction commits, these values can be
// passed to the WebSocket broadcasting layer.
type GeneratedAlert struct {
	AlertID          string
	AlertConfigID    string
	ViolationID      string
	VehicleID        string
	VehicleNumber    string
	DriverName       string
	GeofenceID       string
	GeofenceName     string
	GeofenceCategory string
	EventType        string
	Latitude         float64
	Longitude        float64
	EventTimestamp   time.Time
}
