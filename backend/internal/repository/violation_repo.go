package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"vehicle-alert-system/internal/models"
)

type ViolationRepository struct {
	pool *pgxpool.Pool
}

func NewViolationRepository(
	pool *pgxpool.Pool,
) *ViolationRepository {
	return &ViolationRepository{
		pool: pool,
	}
}

func (r *ViolationRepository) GetHistory(
	ctx context.Context,
	filter models.ViolationHistoryFilter,
) ([]models.ViolationHistoryItem, int64, error) {

	// ========================================================
	// COUNT ALL MATCHING VIOLATIONS
	// ========================================================

	countQuery := `
		SELECT COUNT(*)

		FROM violations vi

		WHERE
			($1 = '' OR vi.vehicle_id = NULLIF($1, '')::uuid)

		AND
			($2 = '' OR vi.geofence_id = NULLIF($2, '')::uuid)

		AND
			($3::timestamptz IS NULL OR vi.event_timestamp >= $3)

		AND
			($4::timestamptz IS NULL OR vi.event_timestamp <= $4)
	`

	var totalCount int64

	err := r.pool.QueryRow(
		ctx,
		countQuery,
		filter.VehicleID,
		filter.GeofenceID,
		filter.StartDate,
		filter.EndDate,
	).Scan(&totalCount)

	if err != nil {
		return nil, 0, fmt.Errorf(
			"failed to count violations: %w",
			err,
		)
	}

	// ========================================================
	// FETCH MATCHING VIOLATIONS
	// ========================================================

	query := `
		SELECT
			vi.id,
			vi.vehicle_id,
			v.vehicle_number,
			vi.geofence_id,
			g.name,
			vi.event_type,
			ST_Y(l.geom),
			ST_X(l.geom),
			vi.event_timestamp

		FROM violations vi

		JOIN vehicles v
			ON v.id = vi.vehicle_id

		JOIN geofences g
			ON g.id = vi.geofence_id

		JOIN locations l
			ON l.id = vi.location_id

		WHERE
			($1 = '' OR vi.vehicle_id = NULLIF($1, '')::uuid)

		AND
			($2 = '' OR vi.geofence_id = NULLIF($2, '')::uuid)

		AND
			($3::timestamptz IS NULL OR vi.event_timestamp >= $3)

		AND
			($4::timestamptz IS NULL OR vi.event_timestamp <= $4)

		ORDER BY
			vi.event_timestamp DESC,
			vi.id DESC

		LIMIT $5
	`

	rows, err := r.pool.Query(
		ctx,
		query,
		filter.VehicleID,
		filter.GeofenceID,
		filter.StartDate,
		filter.EndDate,
		filter.Limit,
	)

	if err != nil {
		return nil, 0, fmt.Errorf(
			"failed to fetch violation history: %w",
			err,
		)
	}

	defer rows.Close()

	violations := make(
		[]models.ViolationHistoryItem,
		0,
	)

	for rows.Next() {

		var violation models.ViolationHistoryItem

		if err := rows.Scan(
			&violation.ID,
			&violation.VehicleID,
			&violation.VehicleNumber,
			&violation.GeofenceID,
			&violation.GeofenceName,
			&violation.EventType,
			&violation.Latitude,
			&violation.Longitude,
			&violation.Timestamp,
		); err != nil {

			return nil, 0, fmt.Errorf(
				"failed to scan violation history: %w",
				err,
			)
		}

		violations = append(
			violations,
			violation,
		)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf(
			"failed iterating violation history: %w",
			err,
		)
	}

	return violations, totalCount, nil
}
