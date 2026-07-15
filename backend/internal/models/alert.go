package models

import "time"

// ============================================================
// POST /alerts/configure
// ============================================================

type CreateAlertConfigRequest struct {
	GeofenceID string `json:"geofence_id"`
	VehicleID  string `json:"vehicle_id"`
	EventType  string `json:"event_type"`
}

type AlertConfig struct {
	ID         string    `json:"id"`
	GeofenceID string    `json:"geofence_id"`
	VehicleID  *string   `json:"vehicle_id"`
	EventType  string    `json:"event_type"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"created_at"`
}

type CreateAlertConfigResponse struct {
	AlertID    string  `json:"alert_id"`
	GeofenceID string  `json:"geofence_id"`
	VehicleID  *string `json:"vehicle_id"`
	EventType  string  `json:"event_type"`
	Status     string  `json:"status"`
	TimeNS     string  `json:"time_ns"`
}

// ============================================================
// GET /alerts
// ============================================================

type AlertListFilter struct {
	GeofenceID string
	VehicleID  string
}

type AlertListItem struct {
	AlertID       string    `json:"alert_id"`
	GeofenceID    string    `json:"geofence_id"`
	GeofenceName  string    `json:"geofence_name"`
	VehicleID     *string   `json:"vehicle_id"`
	VehicleNumber *string   `json:"vehicle_number"`
	EventType     string    `json:"event_type"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"created_at"`
}

type GetAlertsResponse struct {
	Alerts []AlertListItem `json:"alerts"`
	TimeNS string          `json:"time_ns"`
}
