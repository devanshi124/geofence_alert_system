package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"vehicle-alert-system/internal/models"
	"vehicle-alert-system/internal/repository"
)

type ViolationHandler struct {
	repository *repository.ViolationRepository
}

func NewViolationHandler(
	repository *repository.ViolationRepository,
) *ViolationHandler {

	return &ViolationHandler{
		repository: repository,
	}
}

func (h *ViolationHandler) GetHistory(
	w http.ResponseWriter,
	r *http.Request,
) {

	start := time.Now()

	filter := models.ViolationHistoryFilter{
		VehicleID: strings.TrimSpace(
			r.URL.Query().Get("vehicle_id"),
		),
		GeofenceID: strings.TrimSpace(
			r.URL.Query().Get("geofence_id"),
		),
		Limit: 50,
	}

	// ========================================================
	// VALIDATE VEHICLE ID
	// ========================================================

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

	// ========================================================
	// VALIDATE GEOFENCE ID
	// ========================================================

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

	// ========================================================
	// PARSE START DATE
	// ========================================================

	startDateValue := strings.TrimSpace(
		r.URL.Query().Get("start_date"),
	)

	if startDateValue != "" {

		startDate, err := time.Parse(
			time.RFC3339,
			startDateValue,
		)

		if err != nil {

			writeJSON(
				w,
				http.StatusBadRequest,
				map[string]any{
					"error":   "start_date must be a valid ISO 8601 timestamp",
					"time_ns": elapsedNS(start),
				},
			)

			return
		}

		filter.StartDate = &startDate
	}

	// ========================================================
	// PARSE END DATE
	// ========================================================

	endDateValue := strings.TrimSpace(
		r.URL.Query().Get("end_date"),
	)

	if endDateValue != "" {

		endDate, err := time.Parse(
			time.RFC3339,
			endDateValue,
		)

		if err != nil {

			writeJSON(
				w,
				http.StatusBadRequest,
				map[string]any{
					"error":   "end_date must be a valid ISO 8601 timestamp",
					"time_ns": elapsedNS(start),
				},
			)

			return
		}

		filter.EndDate = &endDate
	}

	// ========================================================
	// VALIDATE DATE RANGE
	// ========================================================

	if filter.StartDate != nil &&
		filter.EndDate != nil &&
		filter.StartDate.After(*filter.EndDate) {

		writeJSON(
			w,
			http.StatusBadRequest,
			map[string]any{
				"error":   "start_date must not be after end_date",
				"time_ns": elapsedNS(start),
			},
		)

		return
	}

	// ========================================================
	// PARSE LIMIT
	// ========================================================

	limitValue := strings.TrimSpace(
		r.URL.Query().Get("limit"),
	)

	if limitValue != "" {

		limit, err := strconv.Atoi(
			limitValue,
		)

		if err != nil ||
			limit < 1 ||
			limit > 500 {

			writeJSON(
				w,
				http.StatusBadRequest,
				map[string]any{
					"error":   "limit must be between 1 and 500",
					"time_ns": elapsedNS(start),
				},
			)

			return
		}

		filter.Limit = limit
	}

	// ========================================================
	// FETCH HISTORY
	// ========================================================

	violations, totalCount, err :=
		h.repository.GetHistory(
			r.Context(),
			filter,
		)

	if err != nil {

		writeJSON(
			w,
			http.StatusInternalServerError,
			map[string]any{
				"error":   "failed to fetch violation history",
				"time_ns": elapsedNS(start),
			},
		)

		return
	}

	// ========================================================
	// SUCCESS RESPONSE
	// ========================================================

	writeJSON(
		w,
		http.StatusOK,
		models.GetViolationHistoryResponse{
			Violations: violations,
			TotalCount: totalCount,
			TimeNS:     elapsedNS(start),
		},
	)
}
