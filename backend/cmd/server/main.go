package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"vehicle-alert-system/internal/config"
	"vehicle-alert-system/internal/db"
	"vehicle-alert-system/internal/handlers"
	"vehicle-alert-system/internal/middleware"
	"vehicle-alert-system/internal/repository"
	"vehicle-alert-system/internal/websocket"
)

func main() {

	cfg := config.Load()

	pool, err := db.NewPool(cfg.DatabaseURL)
	alertHub := websocket.NewHub()

	go alertHub.Run()

	if err != nil {
		log.Fatalf(
			"startup failed: %v",
			err,
		)
	}

	defer pool.Close()

	/*
		Repositories
	*/

	geofenceRepository :=
		repository.NewGeofenceRepository(pool)

	vehicleRepository :=
		repository.NewVehicleRepository(pool)

	locationRepository :=
		repository.NewLocationRepository(pool)

	alertRepository :=
		repository.NewAlertRepository(pool)

	violationRepository :=
		repository.NewViolationRepository(pool)

	/*
		Handlers
	*/

	geofenceHandler :=
		handlers.NewGeofenceHandler(
			geofenceRepository,
		)

	vehicleHandler :=
		handlers.NewVehicleHandler(vehicleRepository)

	locationHandler :=
		handlers.NewLocationHandler(
			locationRepository,
			alertHub,
		)
	alertHandler :=
		handlers.NewAlertHandler(
			alertRepository,
		)

	violationHandler :=
		handlers.NewViolationHandler(
			violationRepository,
		)

	/*
		Routes
	*/

	mux := http.NewServeMux()

	mux.HandleFunc(
		"GET /health",
		func(
			w http.ResponseWriter,
			r *http.Request,
		) {

			ctx, cancel :=
				context.WithTimeout(
					r.Context(),
					2*time.Second,
				)

			defer cancel()

			status := "ok"
			code := http.StatusOK

			if err := pool.Ping(ctx); err != nil {

				status = "database unreachable"

				code =
					http.StatusServiceUnavailable
			}

			w.Header().Set(
				"Content-Type",
				"application/json",
			)

			w.WriteHeader(code)

			json.NewEncoder(w).Encode(
				map[string]string{
					"status": status,
					"time": time.Now().
						UTC().
						Format(time.RFC3339),
				},
			)
		},
	)

	mux.HandleFunc(
		"POST /geofences",
		geofenceHandler.Create,
	)

	mux.HandleFunc(
		"GET /geofences",
		geofenceHandler.GetAll,
	)
	mux.HandleFunc(
		"POST /vehicles",
		vehicleHandler.Create,
	)

	mux.HandleFunc(
		"GET /vehicles",
		vehicleHandler.GetAll,
	)

	mux.HandleFunc(
		"POST /vehicles/location",
		locationHandler.Create,
	)

	mux.HandleFunc(
		"GET /vehicles/location/{vehicle_id}",
		locationHandler.GetVehicleLocation,
	)

	mux.HandleFunc(
		"POST /alerts/configure",
		alertHandler.Create,
	)

	mux.HandleFunc(
		"GET /alerts",
		alertHandler.GetAll,
	)

	mux.HandleFunc(
		"GET /violations/history",
		violationHandler.GetHistory,
	)

	mux.HandleFunc(
		"GET /ws/alerts",
		func(w http.ResponseWriter, r *http.Request) {
			websocket.ServeAlerts(
				alertHub,
				w,
				r,
			)
		},
	)

	addr := ":" + cfg.Port

	log.Printf(
		"server listening on %s",
		addr,
	)

	server := &http.Server{
		Addr:              addr,
		Handler:           middleware.CORS(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}

	if err := server.ListenAndServe(); err != nil &&
		err != http.ErrServerClosed {

		log.Fatalf("server failed: %v", err)
	}
}
