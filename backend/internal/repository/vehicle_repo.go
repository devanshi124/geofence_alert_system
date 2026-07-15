package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"vehicle-alert-system/internal/models"
)

type VehicleRepository struct {
	pool *pgxpool.Pool
}

func NewVehicleRepository(
	pool *pgxpool.Pool,
) *VehicleRepository {
	return &VehicleRepository{
		pool: pool,
	}
}

func (r *VehicleRepository) Create(
	ctx context.Context,
	req models.CreateVehicleRequest,
) (string, error) {

	query := `
		INSERT INTO vehicles (
			vehicle_number,
			driver_name,
			vehicle_type,
			phone
		)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`

	var id string

	err := r.pool.QueryRow(
		ctx,
		query,
		req.VehicleNumber,
		req.DriverName,
		req.VehicleType,
		req.Phone,
	).Scan(&id)

	if err != nil {
		return "", fmt.Errorf(
			"failed to create vehicle: %w",
			err,
		)
	}

	return id, nil
}

func (r *VehicleRepository) GetAll(
	ctx context.Context,
) ([]models.Vehicle, error) {

	query := `
		SELECT
			id,
			vehicle_number,
			driver_name,
			vehicle_type,
			phone,
			status,
			created_at
		FROM vehicles
		ORDER BY created_at DESC
	`

	rows, err := r.pool.Query(
		ctx,
		query,
	)

	if err != nil {
		return nil, fmt.Errorf(
			"failed to fetch vehicles: %w",
			err,
		)
	}

	defer rows.Close()

	vehicles := make(
		[]models.Vehicle,
		0,
	)

	for rows.Next() {
		var vehicle models.Vehicle

		err := rows.Scan(
			&vehicle.ID,
			&vehicle.VehicleNumber,
			&vehicle.DriverName,
			&vehicle.VehicleType,
			&vehicle.Phone,
			&vehicle.Status,
			&vehicle.CreatedAt,
		)

		if err != nil {
			return nil, fmt.Errorf(
				"failed to scan vehicle: %w",
				err,
			)
		}

		vehicles = append(
			vehicles,
			vehicle,
		)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf(
			"failed iterating vehicles: %w",
			err,
		)
	}

	return vehicles, nil
}

func (r *VehicleRepository) Exists(
	ctx context.Context,
	vehicleID string,
) (bool, error) {

	query := `
		SELECT EXISTS (
			SELECT 1
			FROM vehicles
			WHERE id = $1
		)
	`

	var exists bool

	err := r.pool.QueryRow(
		ctx,
		query,
		vehicleID,
	).Scan(&exists)

	if err != nil {
		return false, fmt.Errorf(
			"failed to check vehicle existence: %w",
			err,
		)
	}

	return exists, nil
}
