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
	"vehicle-alert-system/internal/websocket"
)

type LocationHandler struct {
	locationRepository *repository.LocationRepository
	alertHub           *websocket.Hub
}

func NewLocationHandler(
	locationRepository *repository.LocationRepository,
	alertHub *websocket.Hub,
) *LocationHandler {
	return &LocationHandler{
		locationRepository: locationRepository,
		alertHub:           alertHub,
	}
}

func (h *LocationHandler) Create(
	w http.ResponseWriter,
	r *http.Request,
) {

	start := time.Now()

	var req models.CreateLocationRequest

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

	req.VehicleID =
		strings.TrimSpace(req.VehicleID)

	if err := validateCreateLocation(req); err != nil {
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

	result, err :=
		h.locationRepository.ProcessLocationUpdate(
			r.Context(),
			req,
		)

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
				"error":   "failed to process location update",
				"time_ns": elapsedNS(start),
			},
		)
		return
	}
	for _, alert := range result.GeneratedAlerts {
		h.alertHub.Publish(alert)
	}

	writeJSON(
		w,
		http.StatusOK,
		models.CreateLocationResponse{
			VehicleID:        req.VehicleID,
			LocationUpdated:  true,
			CurrentGeofences: result.CurrentGeofences,
			TimeNS:           elapsedNS(start),
		},
	)
}

func validateCreateLocation(
	req models.CreateLocationRequest,
) error {

	if req.VehicleID == "" {
		return &ValidationError{
			Message: "vehicle_id is required",
		}
	}

	if _, err :=
		uuid.Parse(req.VehicleID); err != nil {

		return &ValidationError{
			Message: "vehicle_id must be a valid UUID",
		}
	}

	if req.Latitude < -90 ||
		req.Latitude > 90 {

		return &ValidationError{
			Message: "latitude must be between -90 and 90",
		}
	}

	if req.Longitude < -180 ||
		req.Longitude > 180 {

		return &ValidationError{
			Message: "longitude must be between -180 and 180",
		}
	}

	if req.Timestamp.IsZero() {
		return &ValidationError{
			Message: "timestamp is required",
		}
	}

	return nil
}

func (h *LocationHandler) GetVehicleLocation(
	w http.ResponseWriter,
	r *http.Request,
) {

	start := time.Now()

	vehicleID :=
		strings.TrimSpace(
			r.PathValue("vehicle_id"),
		)

	if _, err := uuid.Parse(vehicleID); err != nil {

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

	response, err :=
		h.locationRepository.GetVehicleLocation(
			r.Context(),
			vehicleID,
		)

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

	if errors.Is(
		err,
		repository.ErrLocationNotFound,
	) {

		writeJSON(
			w,
			http.StatusNotFound,
			map[string]any{
				"error":   "no location found for vehicle",
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
				"error":   "failed to fetch vehicle location",
				"time_ns": elapsedNS(start),
			},
		)

		return
	}

	response.TimeNS =
		elapsedNS(start)

	writeJSON(
		w,
		http.StatusOK,
		response,
	)
}
