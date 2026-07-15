package models

import "time"

// ============================================================
// GET /violations/history
// ============================================================

type ViolationHistoryItem struct {
	ID            string    `json:"id"`
	VehicleID     string    `json:"vehicle_id"`
	VehicleNumber string    `json:"vehicle_number"`
	GeofenceID    string    `json:"geofence_id"`
	GeofenceName  string    `json:"geofence_name"`
	EventType     string    `json:"event_type"`
	Latitude      float64   `json:"latitude"`
	Longitude     float64   `json:"longitude"`
	Timestamp     time.Time `json:"timestamp"`
}

type ViolationHistoryFilter struct {
	VehicleID  string
	GeofenceID string
	StartDate  *time.Time
	EndDate    *time.Time
	Limit      int
}

type GetViolationHistoryResponse struct {
	Violations []ViolationHistoryItem `json:"violations"`
	TotalCount int64                  `json:"total_count"`
	TimeNS     string                 `json:"time_ns"`
}
