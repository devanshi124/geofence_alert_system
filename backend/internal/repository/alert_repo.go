package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"vehicle-alert-system/internal/models"
)

var (
	ErrGeofenceNotFound = errors.New("geofence not found")
)

type AlertRepository struct {
	pool *pgxpool.Pool
}

func NewAlertRepository(
	pool *pgxpool.Pool,
) *AlertRepository {
	return &AlertRepository{
		pool: pool,
	}
}

func (r *AlertRepository) Create(
	ctx context.Context,
	req models.CreateAlertConfigRequest,
) (*models.AlertConfig, error) {

	var vehicleID any

	if req.VehicleID == "" {
		vehicleID = nil
	} else {
		vehicleID = req.VehicleID
	}

	query := `
		INSERT INTO alert_configs (
			geofence_id,
			vehicle_id,
			event_type,
			status
		)
		VALUES (
			$1,
			$2,
			$3,
			'active'
		)
		RETURNING
			id,
			geofence_id,
			vehicle_id,
			event_type,
			status,
			created_at
	`

	var config models.AlertConfig

	err := r.pool.QueryRow(
		ctx,
		query,
		req.GeofenceID,
		vehicleID,
		req.EventType,
	).Scan(
		&config.ID,
		&config.GeofenceID,
		&config.VehicleID,
		&config.EventType,
		&config.Status,
		&config.CreatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf(
			"failed to create alert config: %w",
			err,
		)
	}

	return &config, nil
}

func (r *AlertRepository) GetAll(
	ctx context.Context,
	filter models.AlertListFilter,
) ([]models.AlertListItem, error) {

	query := `
		SELECT
			ac.id,
			ac.geofence_id,
			g.name,
			ac.vehicle_id,
			v.vehicle_number,
			ac.event_type,
			ac.status,
			ac.created_at

		FROM alert_configs ac

		JOIN geofences g
			ON g.id = ac.geofence_id

		LEFT JOIN vehicles v
			ON v.id = ac.vehicle_id

		WHERE
			($1 = '' OR ac.geofence_id = NULLIF($1, '')::uuid)

		AND
			($2 = '' OR ac.vehicle_id = NULLIF($2, '')::uuid)

		ORDER BY
			ac.created_at DESC,
			ac.id DESC
	`

	rows, err := r.pool.Query(
		ctx,
		query,
		filter.GeofenceID,
		filter.VehicleID,
	)

	if err != nil {
		return nil, fmt.Errorf(
			"failed to fetch alert configurations: %w",
			err,
		)
	}

	defer rows.Close()

	alerts := make(
		[]models.AlertListItem,
		0,
	)

	for rows.Next() {

		var alert models.AlertListItem

		if err := rows.Scan(
			&alert.AlertID,
			&alert.GeofenceID,
			&alert.GeofenceName,
			&alert.VehicleID,
			&alert.VehicleNumber,
			&alert.EventType,
			&alert.Status,
			&alert.CreatedAt,
		); err != nil {

			return nil, fmt.Errorf(
				"failed to scan alert configuration: %w",
				err,
			)
		}

		alerts = append(
			alerts,
			alert,
		)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf(
			"failed iterating alert configurations: %w",
			err,
		)
	}

	return alerts, nil
}
