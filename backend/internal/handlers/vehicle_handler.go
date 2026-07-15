package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"vehicle-alert-system/internal/models"
	"vehicle-alert-system/internal/repository"
)

type VehicleHandler struct {
	repository *repository.VehicleRepository
}

func NewVehicleHandler(
	repository *repository.VehicleRepository,
) *VehicleHandler {

	return &VehicleHandler{
		repository: repository,
	}
}

func (h *VehicleHandler) Create(
	w http.ResponseWriter,
	r *http.Request,
) {

	start := time.Now()

	var req models.CreateVehicleRequest

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

	normalizeCreateVehicleRequest(&req)

	if err := validateCreateVehicle(req); err != nil {
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

	id, err := h.repository.Create(
		r.Context(),
		req,
	)

	if err != nil {
		var pgErr *pgconn.PgError

		if errors.As(err, &pgErr) &&
			pgErr.Code == "23505" {

			writeJSON(
				w,
				http.StatusConflict,
				map[string]any{
					"error":   "vehicle_number already exists",
					"time_ns": elapsedNS(start),
				},
			)
			return
		}

		writeJSON(
			w,
			http.StatusInternalServerError,
			map[string]any{
				"error":   "failed to create vehicle",
				"time_ns": elapsedNS(start),
			},
		)
		return
	}

	writeJSON(
		w,
		http.StatusCreated,
		models.CreateVehicleResponse{
			ID:            id,
			VehicleNumber: req.VehicleNumber,
			Status:        "active",
			TimeNS:        elapsedNS(start),
		},
	)
}

func (h *VehicleHandler) GetAll(
	w http.ResponseWriter,
	r *http.Request,
) {

	start := time.Now()

	vehicles, err :=
		h.repository.GetAll(
			r.Context(),
		)

	if err != nil {
		writeJSON(
			w,
			http.StatusInternalServerError,
			map[string]any{
				"error":   "failed to fetch vehicles",
				"time_ns": elapsedNS(start),
			},
		)
		return
	}

	writeJSON(
		w,
		http.StatusOK,
		models.GetVehiclesResponse{
			Vehicles: vehicles,
			TimeNS:   elapsedNS(start),
		},
	)
}

func normalizeCreateVehicleRequest(
	req *models.CreateVehicleRequest,
) {

	req.VehicleNumber =
		strings.ToUpper(
			strings.TrimSpace(
				req.VehicleNumber,
			),
		)

	req.DriverName =
		strings.TrimSpace(
			req.DriverName,
		)

	req.VehicleType =
		strings.ToLower(
			strings.TrimSpace(
				req.VehicleType,
			),
		)

	req.Phone =
		strings.TrimSpace(
			req.Phone,
		)
}

func validateCreateVehicle(
	req models.CreateVehicleRequest,
) error {

	if req.VehicleNumber == "" {
		return &ValidationError{
			Message: "vehicle_number is required",
		}
	}

	if req.DriverName == "" {
		return &ValidationError{
			Message: "driver_name is required",
		}
	}

	if req.VehicleType == "" {
		return &ValidationError{
			Message: "vehicle_type is required",
		}
	}

	if req.Phone == "" {
		return &ValidationError{
			Message: "phone is required",
		}
	}

	if len(req.VehicleNumber) > 100 {
		return &ValidationError{
			Message: "vehicle_number must not exceed 100 characters",
		}
	}

	if len(req.DriverName) > 255 {
		return &ValidationError{
			Message: "driver_name must not exceed 255 characters",
		}
	}

	if len(req.VehicleType) > 100 {
		return &ValidationError{
			Message: "vehicle_type must not exceed 100 characters",
		}
	}

	if len(req.Phone) > 30 {
		return &ValidationError{
			Message: "phone must not exceed 30 characters",
		}
	}

	return nil
}
