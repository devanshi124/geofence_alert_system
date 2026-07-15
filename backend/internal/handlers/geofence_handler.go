package handlers

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"vehicle-alert-system/internal/models"
	"vehicle-alert-system/internal/repository"
)

type GeofenceHandler struct {
	repository *repository.GeofenceRepository
}

func NewGeofenceHandler(
	repository *repository.GeofenceRepository,
) *GeofenceHandler {

	return &GeofenceHandler{
		repository: repository,
	}
}

func (h *GeofenceHandler) Create(
	w http.ResponseWriter,
	r *http.Request,
) {

	start := time.Now()

	var req models.CreateGeofenceRequest

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

	/*
		Reject multiple JSON values.

		Example invalid body:

		{...} {...}
	*/

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

	normalizeCreateGeofenceRequest(&req)

	if err := validateCreateGeofence(req); err != nil {

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

		writeJSON(
			w,
			http.StatusInternalServerError,
			map[string]any{
				"error":   "failed to create geofence",
				"time_ns": elapsedNS(start),
			},
		)

		return
	}

	writeJSON(
		w,
		http.StatusCreated,
		models.CreateGeofenceResponse{
			ID:     id,
			Name:   req.Name,
			Status: "active",
			TimeNS: elapsedNS(start),
		},
	)
}

func (h *GeofenceHandler) GetAll(
	w http.ResponseWriter,
	r *http.Request,
) {

	start := time.Now()

	category :=
		strings.TrimSpace(
			r.URL.Query().Get("category"),
		)

	/*
		If a category filter was supplied,
		validate it.

		This prevents accepting arbitrary categories.
	*/

	if category != "" &&
		!isValidGeofenceCategory(category) {

		writeJSON(
			w,
			http.StatusBadRequest,
			map[string]any{
				"error":   "invalid geofence category",
				"time_ns": elapsedNS(start),
			},
		)

		return
	}

	geofences, err :=
		h.repository.GetAll(
			r.Context(),
			category,
		)

	if err != nil {

		writeJSON(
			w,
			http.StatusInternalServerError,
			map[string]any{
				"error":   "failed to fetch geofences",
				"time_ns": elapsedNS(start),
			},
		)

		return
	}

	writeJSON(
		w,
		http.StatusOK,
		models.GetGeofencesResponse{
			Geofences: geofences,
			TimeNS:    elapsedNS(start),
		},
	)
}

func normalizeCreateGeofenceRequest(
	req *models.CreateGeofenceRequest,
) {

	req.Name =
		strings.TrimSpace(req.Name)

	req.Description =
		strings.TrimSpace(req.Description)

	req.Category =
		strings.ToLower(
			strings.TrimSpace(req.Category),
		)
}

func validateCreateGeofence(
	req models.CreateGeofenceRequest,
) error {

	if req.Name == "" {

		return &ValidationError{
			Message: "name is required",
		}
	}

	if len(req.Name) > 255 {

		return &ValidationError{
			Message: "name must not exceed 255 characters",
		}
	}

	if req.Category == "" {

		return &ValidationError{
			Message: "category is required",
		}
	}

	if !isValidGeofenceCategory(
		req.Category,
	) {

		return &ValidationError{
			Message: "category must be one of: delivery_zone, restricted_zone, toll_zone, customer_area",
		}
	}

	if len(req.Coordinates) < 4 {

		return &ValidationError{
			Message: "coordinates must contain at least 4 points",
		}
	}

	for _, coordinate := range req.Coordinates {

		if len(coordinate) != 2 {

			return &ValidationError{
				Message: "each coordinate must contain latitude and longitude",
			}
		}

		latitude := coordinate[0]

		longitude := coordinate[1]

		if latitude < -90 ||
			latitude > 90 {

			return &ValidationError{
				Message: "latitude must be between -90 and 90",
			}
		}

		if longitude < -180 ||
			longitude > 180 {

			return &ValidationError{
				Message: "longitude must be between -180 and 180",
			}
		}
	}

	first :=
		req.Coordinates[0]

	last :=
		req.Coordinates[len(req.Coordinates)-1]

	if first[0] != last[0] ||
		first[1] != last[1] {

		return &ValidationError{
			Message: "first and last coordinates must be identical",
		}
	}

	/*
		Minimum 3 unique points.

		A polygon like:

		A → B → A → A

		is technically closed and has four coordinates,
		but does not form a valid polygon.
	*/

	uniqueCoordinates :=
		make(map[[2]float64]struct{})

	for i := 0; i < len(req.Coordinates)-1; i++ {

		coordinate :=
			req.Coordinates[i]

		key := [2]float64{
			coordinate[0],
			coordinate[1],
		}

		uniqueCoordinates[key] =
			struct{}{}
	}

	if len(uniqueCoordinates) < 3 {

		return &ValidationError{
			Message: "polygon must contain at least 3 unique points",
		}
	}

	return nil
}

func isValidGeofenceCategory(
	category string,
) bool {

	switch category {

	case "delivery_zone",
		"restricted_zone",
		"toll_zone",
		"customer_area":

		return true

	default:

		return false
	}
}

func elapsedNS(
	start time.Time,
) string {

	return formatInt64(
		time.Since(start).
			Nanoseconds(),
	)
}

func ensureSingleJSONValue(
	decoder *json.Decoder,
) error {

	var extra any

	err := decoder.Decode(&extra)

	if errors.Is(err, io.EOF) {
		return nil
	}

	return errors.New(
		"request contains additional JSON data",
	)
}
