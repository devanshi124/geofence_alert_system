package config

import (
	"os"
)

// Config holds all runtime configuration loaded from environment variables.
type Config struct {
	DatabaseURL string
	Port        string
}

// Load reads configuration from environment variables, applying sensible
// defaults for local development if they're not set.
func Load() Config {
	return Config{
		DatabaseURL: getEnv("DATABASE_URL", "postgres://geofence_user:geofence_pass@localhost:5432/geofence_db?sslmode=disable"),
		Port:        getEnv("PORT", "8080"),
	}
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return fallback
}
