package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"vehicle-alert-system/internal/models"
	"vehicle-alert-system/internal/repository"
)

type AlertHandler struct {
	repository *repository.AlertRepository
}

func NewAlertHandler(
	repository *repository.AlertRepository,
) *AlertHandler {

	return &AlertHandler{
		repository: repository,
	}
}

func (h *AlertHandler) Create(
	w http.ResponseWriter,
	r *http.Request,
) {

	start := time.Now()

	var req models.CreateAlertConfigRequest

	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(&req); err != nil {
		writeJSON(
			w,
			http.StatusBadRequest,
			map[string]any{
				"error":   "invalid request body",
				"time_ns": elapsedNS(start),
			},
		)
		return
	}

	if err := ensureSingleJSONValue(decoder); err != nil {
		writeJSON(
			w,
			http.StatusBadRequest,
			map[string]any{
				"error":   "request body must contain exactly one JSON object",
				"time_ns": elapsedNS(start),
			},
		)
		return
	}

	normalizeCreateAlertConfigRequest(&req)

	if err := validateCreateAlertConfig(req); err != nil {
		writeJSON(
			w,
			http.StatusBadRequest,
			map[string]any{
				"error":   err.Error(),
				"time_ns": elapsedNS(start),
			},
		)
		return
	}

	config, err := h.repository.Create(
		r.Context(),
		req,
	)

	if errors.Is(
		err,
		repository.ErrGeofenceNotFound,
	) {
		writeJSON(
			w,
			http.StatusNotFound,
			map[string]any{
				"error":   "geofence not found",
				"time_ns": elapsedNS(start),
			},
		)
		return
	}

	if errors.Is(
		err,
		repository.ErrVehicleNotFound,
	) {
		writeJSON(
			w,
			http.StatusNotFound,
			map[string]any{
				"error":   "vehicle not found",
				"time_ns": elapsedNS(start),
			},
		)
		return
	}

	if err != nil {
		writeJSON(
			w,
			http.StatusInternalServerError,
			map[string]any{
				"error":   "failed to create alert configuration",
				"time_ns": elapsedNS(start),
			},
		)
		return
	}

	writeJSON(
		w,
		http.StatusCreated,
		models.CreateAlertConfigResponse{
			AlertID:    config.ID,
			GeofenceID: config.GeofenceID,
			VehicleID:  config.VehicleID,
			EventType:  config.EventType,
			Status:     config.Status,
			TimeNS:     elapsedNS(start),
		},
	)
}

func (h *AlertHandler) GetAll(
	w http.ResponseWriter,
	r *http.Request,
) {

	start := time.Now()

	filter := models.AlertListFilter{
		GeofenceID: strings.TrimSpace(
			r.URL.Query().Get("geofence_id"),
		),
		VehicleID: strings.TrimSpace(
			r.URL.Query().Get("vehicle_id"),
		),
	}

	if filter.GeofenceID != "" {

		if _, err := uuid.Parse(
			filter.GeofenceID,
		); err != nil {

			writeJSON(
				w,
				http.StatusBadRequest,
				map[string]any{
					"error":   "geofence_id must be a valid UUID",
					"time_ns": elapsedNS(start),
				},
			)

			return
		}
	}

	if filter.VehicleID != "" {

		if _, err := uuid.Parse(
			filter.VehicleID,
		); err != nil {

			writeJSON(
				w,
				http.StatusBadRequest,
				map[string]any{
					"error":   "vehicle_id must be a valid UUID",
					"time_ns": elapsedNS(start),
				},
			)

			return
		}
	}

	alerts, err := h.repository.GetAll(
		r.Context(),
		filter,
	)

	if err != nil {

		writeJSON(
			w,
			http.StatusInternalServerError,
			map[string]any{
				"error":   "failed to fetch alert configurations",
				"time_ns": elapsedNS(start),
			},
		)

		return
	}

	writeJSON(
		w,
		http.StatusOK,
		models.GetAlertsResponse{
			Alerts: alerts,
			TimeNS: elapsedNS(start),
		},
	)
}

func normalizeCreateAlertConfigRequest(
	req *models.CreateAlertConfigRequest,
) {

	req.GeofenceID =
		strings.TrimSpace(req.GeofenceID)

	req.VehicleID =
		strings.TrimSpace(req.VehicleID)

	req.EventType =
		strings.ToLower(
			strings.TrimSpace(req.EventType),
		)
}

func validateCreateAlertConfig(
	req models.CreateAlertConfigRequest,
) error {

	if req.GeofenceID == "" {
		return &ValidationError{
			Message: "geofence_id is required",
		}
	}

	if _, err :=
		uuid.Parse(req.GeofenceID); err != nil {

		return &ValidationError{
			Message: "geofence_id must be a valid UUID",
		}
	}

	if req.VehicleID != "" {
		if _, err :=
			uuid.Parse(req.VehicleID); err != nil {

			return &ValidationError{
				Message: "vehicle_id must be a valid UUID",
			}
		}
	}

	switch req.EventType {
	case "entry", "exit", "both":
	default:
		return &ValidationError{
			Message: "event_type must be one of: entry, exit, both",
		}
	}

	return nil
}
