package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"vehicle-alert-system/internal/models"
)

type GeofenceRepository struct {
	pool *pgxpool.Pool
}

func NewGeofenceRepository(
	pool *pgxpool.Pool,
) *GeofenceRepository {
	return &GeofenceRepository{
		pool: pool,
	}
}

func (r *GeofenceRepository) Create(
	ctx context.Context,
	req models.CreateGeofenceRequest,
) (string, error) {

	/*
		API coordinates:

		[longitude, latitude]

		GeoJSON coordinates:

		[longitude, latitude]

		Therefore preserve coordinate order.
	*/

	ring := make(
		[][]float64,
		0,
		len(req.Coordinates),
	)

	for _, coordinate := range req.Coordinates {
		ring = append(
			ring,
			[]float64{
				coordinate[0],
				coordinate[1],
			},
		)
	}

	geometry := map[string]any{
		"type": "Polygon",
		"coordinates": []any{
			ring,
		},
	}

	geometryJSON, err :=
		json.Marshal(geometry)

	if err != nil {
		return "", fmt.Errorf(
			"failed to encode geometry: %w",
			err,
		)
	}

	query := `
		INSERT INTO geofences (
			name,
			description,
			category,
			geom
		)
		VALUES (
			$1,
			$2,
			$3,
			ST_SetSRID(
				ST_GeomFromGeoJSON($4),
				4326
			)
		)
		RETURNING id
	`

	var id string

	err = r.pool.QueryRow(
		ctx,
		query,
		req.Name,
		req.Description,
		req.Category,
		string(geometryJSON),
	).Scan(&id)

	if err != nil {
		return "", fmt.Errorf(
			"failed to create geofence: %w",
			err,
		)
	}

	return id, nil
}

func (r *GeofenceRepository) GetAll(
	ctx context.Context,
	category string,
) ([]models.Geofence, error) {

	query := `
		SELECT
			id,
			name,
			COALESCE(description, ''),
			category,
			ST_AsGeoJSON(geom),
			created_at
		FROM geofences
		WHERE ($1 = '' OR category = $1)
		ORDER BY created_at DESC
	`

	rows, err := r.pool.Query(
		ctx,
		query,
		category,
	)

	if err != nil {
		return nil, fmt.Errorf(
			"failed to fetch geofences: %w",
			err,
		)
	}

	defer rows.Close()

	geofences := make(
		[]models.Geofence,
		0,
	)

	for rows.Next() {

		var geofence models.Geofence
		var geometryJSON string

		err := rows.Scan(
			&geofence.ID,
			&geofence.Name,
			&geofence.Description,
			&geofence.Category,
			&geometryJSON,
			&geofence.CreatedAt,
		)

		if err != nil {
			return nil, fmt.Errorf(
				"failed to scan geofence: %w",
				err,
			)
		}

		var geometry struct {
			Type string `json:"type"`

			Coordinates [][][]float64 `json:"coordinates"`
		}

		err = json.Unmarshal(
			[]byte(geometryJSON),
			&geometry,
		)

		if err != nil {
			return nil, fmt.Errorf(
				"failed to decode geometry: %w",
				err,
			)
		}

		geofence.Coordinates =
			make(
				[]models.Coordinate,
				0,
			)

		if len(geometry.Coordinates) > 0 {

			for _, coordinate := range geometry.Coordinates[0] {

				/*
					PostGIS / GeoJSON:

					[longitude, latitude]

					API:

					[longitude, latitude]

					Preserve coordinate order.
				*/

				geofence.Coordinates =
					append(
						geofence.Coordinates,
						models.Coordinate{
							coordinate[0],
							coordinate[1],
						},
					)
			}
		}

		geofences = append(
			geofences,
			geofence,
		)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf(
			"failed iterating geofences: %w",
			err,
		)
	}

	return geofences, nil
}
