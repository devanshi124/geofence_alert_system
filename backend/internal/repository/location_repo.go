package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"vehicle-alert-system/internal/models"
)

var (
	ErrVehicleNotFound  = errors.New("vehicle not found")
	ErrLocationNotFound = errors.New("location not found")
)

type LocationRepository struct {
	pool *pgxpool.Pool
}

func NewLocationRepository(
	pool *pgxpool.Pool,
) *LocationRepository {

	return &LocationRepository{
		pool: pool,
	}
}

// ============================================================
// POST /vehicles/location
// ============================================================

func (r *LocationRepository) ProcessLocationUpdate(
	ctx context.Context,
	req models.CreateLocationRequest,
) (*models.LocationProcessResult, error) {

	tx, err := r.pool.BeginTx(
		ctx,
		pgx.TxOptions{},
	)
	if err != nil {
		return nil, fmt.Errorf(
			"failed to begin transaction: %w",
			err,
		)
	}

	defer func() {
		_ = tx.Rollback(ctx)
	}()

	// Serialize location updates for the same vehicle.
	//
	// This prevents concurrent requests for one vehicle from
	// reading the same previous geofence state and generating
	// duplicate entry/exit events.

	var lockedVehicleID string

	err = tx.QueryRow(
		ctx,
		`
		SELECT id
		FROM vehicles
		WHERE id = $1
		FOR UPDATE
		`,
		req.VehicleID,
	).Scan(&lockedVehicleID)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrVehicleNotFound
	}

	if err != nil {
		return nil, fmt.Errorf(
			"failed to lock vehicle: %w",
			err,
		)
	}

	location, err := insertLocation(
		ctx,
		tx,
		req,
	)
	if err != nil {
		return nil, err
	}

	currentGeofences, err :=
		findContainingGeofences(
			ctx,
			tx,
			req.Longitude,
			req.Latitude,
		)

	if err != nil {
		return nil, err
	}

	previousGeofences, err :=
		getVehicleGeofenceState(
			ctx,
			tx,
			req.VehicleID,
		)

	if err != nil {
		return nil, err
	}

	enteredGeofences :=
		geofenceDifference(
			currentGeofences,
			previousGeofences,
		)

	exitedGeofences :=
		geofenceDifference(
			previousGeofences,
			currentGeofences,
		)

	generatedAlerts := make(
		[]models.GeneratedAlert,
		0,
	)

	// ========================================================
	// ENTRY EVENTS
	// ========================================================

	for _, geofence := range enteredGeofences {

		if err := insertVehicleGeofenceState(
			ctx,
			tx,
			req.VehicleID,
			geofence.GeofenceID,
			req.Timestamp,
		); err != nil {
			return nil, err
		}

		hasAlert, err := hasMatchingAlertConfig(
			ctx,
			tx,
			req.VehicleID,
			geofence.GeofenceID,
			"entry",
		)
		if err != nil {
			return nil, err
		}

		if !hasAlert {
			continue
		}

		violationID, err := insertViolation(
			ctx,
			tx,
			req.VehicleID,
			geofence.GeofenceID,
			location.ID,
			"entry",
			req.Timestamp,
		)
		if err != nil {
			return nil, err
		}

		alerts, err := createMatchingAlertEvents(
			ctx,
			tx,
			req.VehicleID,
			geofence,
			location,
			violationID,
			"entry",
			req.Timestamp,
		)
		if err != nil {
			return nil, err
		}

		generatedAlerts = append(
			generatedAlerts,
			alerts...,
		)
	}

	// ========================================================
	// EXIT EVENTS
	// ========================================================

	for _, geofence := range exitedGeofences {

		if err := deleteVehicleGeofenceState(
			ctx,
			tx,
			req.VehicleID,
			geofence.GeofenceID,
		); err != nil {
			return nil, err
		}

		hasAlert, err := hasMatchingAlertConfig(
			ctx,
			tx,
			req.VehicleID,
			geofence.GeofenceID,
			"exit",
		)
		if err != nil {
			return nil, err
		}

		if !hasAlert {
			continue
		}

		violationID, err := insertViolation(
			ctx,
			tx,
			req.VehicleID,
			geofence.GeofenceID,
			location.ID,
			"exit",
			req.Timestamp,
		)
		if err != nil {
			return nil, err
		}

		alerts, err := createMatchingAlertEvents(
			ctx,
			tx,
			req.VehicleID,
			geofence,
			location,
			violationID,
			"exit",
			req.Timestamp,
		)
		if err != nil {
			return nil, err
		}

		generatedAlerts = append(
			generatedAlerts,
			alerts...,
		)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf(
			"failed to commit transaction: %w",
			err,
		)
	}

	return &models.LocationProcessResult{
		Location:         *location,
		CurrentGeofences: currentGeofences,
		GeneratedAlerts:  generatedAlerts,
	}, nil
}

// ============================================================
// GET /vehicles/location/{vehicle_id}
// ============================================================

func (r *LocationRepository) GetVehicleLocation(
	ctx context.Context,
	vehicleID string,
) (*models.VehicleLocationResponse, error) {

	var response models.VehicleLocationResponse

	query := `
		SELECT
			v.id,
			v.vehicle_number,
			ST_Y(latest.geom),
			ST_X(latest.geom),
			latest.recorded_at

		FROM vehicles v

		LEFT JOIN LATERAL (
			SELECT
				id,
				geom,
				recorded_at

			FROM locations

			WHERE vehicle_id = v.id

			ORDER BY
				recorded_at DESC,
				id DESC

			LIMIT 1
		) latest ON TRUE

		WHERE v.id = $1
	`

	var latitude *float64
	var longitude *float64
	var recordedAt *time.Time

	err := r.pool.QueryRow(
		ctx,
		query,
		vehicleID,
	).Scan(
		&response.VehicleID,
		&response.VehicleNumber,
		&latitude,
		&longitude,
		&recordedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrVehicleNotFound
	}

	if err != nil {
		return nil, fmt.Errorf(
			"failed to fetch vehicle latest location: %w",
			err,
		)
	}

	if latitude == nil ||
		longitude == nil ||
		recordedAt == nil {

		return nil, ErrLocationNotFound
	}

	response.CurrentLocation = models.CurrentLocation{
		Latitude:  *latitude,
		Longitude: *longitude,
		Timestamp: *recordedAt,
	}

	currentGeofences, err :=
		getCurrentVehicleGeofencesForResponse(
			ctx,
			r.pool,
			vehicleID,
		)

	if err != nil {
		return nil, err
	}

	response.CurrentGeofences = currentGeofences

	return &response, nil
}

// ============================================================
// INSERT LOCATION
// ============================================================

func insertLocation(
	ctx context.Context,
	tx pgx.Tx,
	req models.CreateLocationRequest,
) (*models.Location, error) {

	query := `
		INSERT INTO locations (
			vehicle_id,
			geom,
			recorded_at
		)
		VALUES (
			$1,
			ST_SetSRID(
				ST_MakePoint($2, $3),
				4326
			),
			$4
		)

		RETURNING
			id,
			vehicle_id,
			ST_Y(geom),
			ST_X(geom),
			recorded_at
	`

	var location models.Location

	err := tx.QueryRow(
		ctx,
		query,
		req.VehicleID,
		req.Longitude,
		req.Latitude,
		req.Timestamp,
	).Scan(
		&location.ID,
		&location.VehicleID,
		&location.Latitude,
		&location.Longitude,
		&location.RecordedAt,
	)

	if err != nil {
		return nil, fmt.Errorf(
			"failed to insert location: %w",
			err,
		)
	}

	return &location, nil
}

// ============================================================
// FIND CONTAINING GEOFENCES
// ============================================================

func findContainingGeofences(
	ctx context.Context,
	tx pgx.Tx,
	longitude float64,
	latitude float64,
) ([]models.GeofenceStatus, error) {

	query := `
		SELECT
			id,
			name

		FROM geofences

		WHERE status = 'active'

		  AND ST_Covers(
			  geom,
			  ST_SetSRID(
				  ST_MakePoint($1, $2),
				  4326
			  )
		  )

		ORDER BY id
	`

	rows, err := tx.Query(
		ctx,
		query,
		longitude,
		latitude,
	)

	if err != nil {
		return nil, fmt.Errorf(
			"failed to find containing geofences: %w",
			err,
		)
	}

	defer rows.Close()

	geofences := make(
		[]models.GeofenceStatus,
		0,
	)

	for rows.Next() {

		var geofence models.GeofenceStatus

		if err := rows.Scan(
			&geofence.GeofenceID,
			&geofence.GeofenceName,
		); err != nil {

			return nil, fmt.Errorf(
				"failed to scan containing geofence: %w",
				err,
			)
		}

		geofence.Status = "inside"

		geofences = append(
			geofences,
			geofence,
		)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf(
			"failed iterating containing geofences: %w",
			err,
		)
	}

	return geofences, nil
}

// ============================================================
// GET PREVIOUS VEHICLE GEOFENCE STATE
// ============================================================

func getVehicleGeofenceState(
	ctx context.Context,
	tx pgx.Tx,
	vehicleID string,
) ([]models.GeofenceStatus, error) {

	query := `
		SELECT
			g.id,
			g.name

		FROM vehicle_geofence_state vgs

		JOIN geofences g
		  ON g.id = vgs.geofence_id

		WHERE vgs.vehicle_id = $1

		ORDER BY g.id
	`

	rows, err := tx.Query(
		ctx,
		query,
		vehicleID,
	)

	if err != nil {
		return nil, fmt.Errorf(
			"failed to fetch vehicle geofence state: %w",
			err,
		)
	}

	defer rows.Close()

	geofences := make(
		[]models.GeofenceStatus,
		0,
	)

	for rows.Next() {

		var geofence models.GeofenceStatus

		if err := rows.Scan(
			&geofence.GeofenceID,
			&geofence.GeofenceName,
		); err != nil {

			return nil, fmt.Errorf(
				"failed to scan vehicle geofence state: %w",
				err,
			)
		}

		geofence.Status = "inside"

		geofences = append(
			geofences,
			geofence,
		)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf(
			"failed iterating vehicle geofence state: %w",
			err,
		)
	}

	return geofences, nil
}

// ============================================================
// GEOFENCE DIFFERENCE
// ============================================================

func geofenceDifference(
	left []models.GeofenceStatus,
	right []models.GeofenceStatus,
) []models.GeofenceStatus {

	rightSet := make(
		map[string]struct{},
		len(right),
	)

	for _, geofence := range right {
		rightSet[geofence.GeofenceID] = struct{}{}
	}

	difference := make(
		[]models.GeofenceStatus,
		0,
	)

	for _, geofence := range left {

		if _, exists :=
			rightSet[geofence.GeofenceID]; !exists {

			difference = append(
				difference,
				geofence,
			)
		}
	}

	return difference
}

// ============================================================
// INSERT VEHICLE GEOFENCE STATE
// ============================================================

func insertVehicleGeofenceState(
	ctx context.Context,
	tx pgx.Tx,
	vehicleID string,
	geofenceID string,
	enteredAt time.Time,
) error {

	query := `
		INSERT INTO vehicle_geofence_state (
			vehicle_id,
			geofence_id,
			entered_at
		)
		VALUES (
			$1,
			$2,
			$3
		)

		ON CONFLICT (
			vehicle_id,
			geofence_id
		)
		DO NOTHING
	`

	_, err := tx.Exec(
		ctx,
		query,
		vehicleID,
		geofenceID,
		enteredAt,
	)

	if err != nil {
		return fmt.Errorf(
			"failed to insert vehicle geofence state: %w",
			err,
		)
	}

	return nil
}

// ============================================================
// DELETE VEHICLE GEOFENCE STATE
// ============================================================

func deleteVehicleGeofenceState(
	ctx context.Context,
	tx pgx.Tx,
	vehicleID string,
	geofenceID string,
) error {

	query := `
		DELETE FROM vehicle_geofence_state

		WHERE vehicle_id = $1

		  AND geofence_id = $2
	`

	_, err := tx.Exec(
		ctx,
		query,
		vehicleID,
		geofenceID,
	)

	if err != nil {
		return fmt.Errorf(
			"failed to delete vehicle geofence state: %w",
			err,
		)
	}

	return nil
}

// ============================================================
// INSERT VIOLATION
// ============================================================

func insertViolation(
	ctx context.Context,
	tx pgx.Tx,
	vehicleID string,
	geofenceID string,
	locationID int64,
	eventType string,
	eventTimestamp time.Time,
) (string, error) {

	query := `
		INSERT INTO violations (
			vehicle_id,
			geofence_id,
			event_type,
			location_id,
			event_timestamp
		)
		VALUES (
			$1,
			$2,
			$3,
			$4,
			$5
		)

		RETURNING id
	`

	var violationID string

	err := tx.QueryRow(
		ctx,
		query,
		vehicleID,
		geofenceID,
		eventType,
		locationID,
		eventTimestamp,
	).Scan(&violationID)

	if err != nil {
		return "", fmt.Errorf(
			"failed to insert violation: %w",
			err,
		)
	}

	return violationID, nil
}

func hasMatchingAlertConfig(
	ctx context.Context,
	tx pgx.Tx,
	vehicleID string,
	geofenceID string,
	eventType string,
) (bool, error) {

	var count int

	err := tx.QueryRow(
		ctx,
		`
		SELECT COUNT(*)
		FROM alert_configs ac
		WHERE ac.geofence_id = $1
		  AND ac.status = 'active'
		  AND (
				ac.vehicle_id = $2
				OR ac.vehicle_id IS NULL
		  )
		  AND (
				ac.event_type = $3
				OR ac.event_type = 'both'
		  )
		`,
		geofenceID,
		vehicleID,
		eventType,
	).Scan(&count)

	if err != nil {
		return false, err
	}

	return count > 0, nil
}

// ============================================================
// CREATE MATCHING ALERT EVENTS
// ============================================================

func createMatchingAlertEvents(
	ctx context.Context,
	tx pgx.Tx,
	vehicleID string,
	geofence models.GeofenceStatus,
	location *models.Location,
	violationID string,
	eventType string,
	eventTimestamp time.Time,
) ([]models.GeneratedAlert, error) {

	query := `
		SELECT
			ac.id,
			v.vehicle_number,
			v.driver_name,
			g.category

		FROM alert_configs ac

		JOIN vehicles v
			ON v.id = $2

		JOIN geofences g
			ON g.id = ac.geofence_id

		WHERE ac.geofence_id = $1

		  AND ac.status = 'active'

		  AND (
			  ac.vehicle_id = $2
			  OR ac.vehicle_id IS NULL
		  )

		  AND (
			  ac.event_type = $3
			  OR ac.event_type = 'both'
		  )

		ORDER BY ac.id
	`

	rows, err := tx.Query(
		ctx,
		query,
		geofence.GeofenceID,
		vehicleID,
		eventType,
	)

	if err != nil {
		return nil, fmt.Errorf(
			"failed to find matching alert configs: %w",
			err,
		)
	}

	type matchingConfig struct {
		ConfigID         string
		VehicleNumber    string
		DriverName       string
		GeofenceCategory string
	}

	configs := make([]matchingConfig, 0)

	for rows.Next() {
		var config matchingConfig

		if err := rows.Scan(
			&config.ConfigID,
			&config.VehicleNumber,
			&config.DriverName,
			&config.GeofenceCategory,
		); err != nil {
			rows.Close()

			return nil, fmt.Errorf(
				"failed to scan alert config: %w",
				err,
			)
		}

		configs = append(configs, config)
	}

	if err := rows.Err(); err != nil {
		rows.Close()

		return nil, fmt.Errorf(
			"failed iterating alert configs: %w",
			err,
		)
	}

	rows.Close()

	generatedAlerts := make(
		[]models.GeneratedAlert,
		0,
		len(configs),
	)

	for _, config := range configs {

		var alertID string

		err := tx.QueryRow(
			ctx,
			`
			INSERT INTO alert_events (
				alert_config_id,
				violation_id,
				vehicle_id,
				geofence_id,
				location_id,
				event_type,
				event_timestamp
			)
			VALUES (
				$1,
				$2,
				$3,
				$4,
				$5,
				$6,
				$7
			)

			RETURNING id
			`,
			config.ConfigID,
			violationID,
			vehicleID,
			geofence.GeofenceID,
			location.ID,
			eventType,
			eventTimestamp,
		).Scan(&alertID)

		if err != nil {
			return nil, fmt.Errorf(
				"failed to create alert event: %w",
				err,
			)
		}

		generatedAlerts = append(
			generatedAlerts,
			models.GeneratedAlert{
				AlertID:          alertID,
				AlertConfigID:    config.ConfigID,
				ViolationID:      violationID,
				VehicleID:        vehicleID,
				VehicleNumber:    config.VehicleNumber,
				DriverName:       config.DriverName,
				GeofenceID:       geofence.GeofenceID,
				GeofenceName:     geofence.GeofenceName,
				GeofenceCategory: config.GeofenceCategory,
				EventType:        eventType,
				Latitude:         location.Latitude,
				Longitude:        location.Longitude,
				EventTimestamp:   eventTimestamp,
			},
		)
	}

	return generatedAlerts, nil
}

// ============================================================
// GET CURRENT GEOFENCES FOR GET LOCATION RESPONSE
// ============================================================

// This helper is intentionally separate from
// getVehicleGeofenceState().
//
// POST /vehicles/location requires:
//     status: "inside"
//
// GET /vehicles/location/{vehicle_id} requires:
//     category: "delivery_zone"

func getCurrentVehicleGeofencesForResponse(
	ctx context.Context,
	pool *pgxpool.Pool,
	vehicleID string,
) ([]models.CurrentGeofence, error) {

	query := `
		SELECT
			g.id,
			g.name,
			g.category

		FROM vehicle_geofence_state vgs

		JOIN geofences g
		  ON g.id = vgs.geofence_id

		WHERE vgs.vehicle_id = $1

		ORDER BY g.name ASC
	`

	rows, err := pool.Query(
		ctx,
		query,
		vehicleID,
	)

	if err != nil {
		return nil, fmt.Errorf(
			"failed to fetch current vehicle geofences: %w",
			err,
		)
	}

	defer rows.Close()

	geofences := make(
		[]models.CurrentGeofence,
		0,
	)

	for rows.Next() {

		var geofence models.CurrentGeofence

		if err := rows.Scan(
			&geofence.GeofenceID,
			&geofence.GeofenceName,
			&geofence.Category,
		); err != nil {

			return nil, fmt.Errorf(
				"failed to scan current vehicle geofence: %w",
				err,
			)
		}

		geofences = append(
			geofences,
			geofence,
		)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf(
			"failed iterating current vehicle geofences: %w",
			err,
		)
	}

	return geofences, nil
}
