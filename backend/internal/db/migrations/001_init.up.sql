-- 001_init.up.sql
-- Initial database schema for the Geofencing Real-time Alert System.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- GEOFENCES
-- ============================================================

CREATE TABLE geofences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(255) NOT NULL,

    description TEXT,

    category VARCHAR(50) NOT NULL,

    geom GEOMETRY(Polygon, 4326) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'active',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_geofence_category
        CHECK (
            category IN (
                'delivery_zone',
                'restricted_zone',
                'toll_zone',
                'customer_area'
            )
        ),

    CONSTRAINT chk_geofence_status
        CHECK (
            status IN (
                'active',
                'inactive'
            )
        )
);


-- Spatial index.

CREATE INDEX idx_geofences_geom
ON geofences
USING GIST (geom);


-- Category filtering.

CREATE INDEX idx_geofences_category
ON geofences (category);


-- ============================================================
-- VEHICLES
-- ============================================================

CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    vehicle_number VARCHAR(100) NOT NULL UNIQUE,

    driver_name VARCHAR(255) NOT NULL,

    vehicle_type VARCHAR(100) NOT NULL,

    phone VARCHAR(30) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'active',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_vehicle_status
        CHECK (
            status IN (
                'active',
                'inactive'
            )
        )
);


CREATE INDEX idx_vehicles_status
ON vehicles (status);


-- ============================================================
-- LOCATIONS
-- ============================================================

-- Stores every location update.
--
-- The timestamp comes from the API request.
--
-- received_at records when the backend/database actually
-- received the location update.

CREATE TABLE locations (
    id BIGSERIAL PRIMARY KEY,

    vehicle_id UUID NOT NULL
        REFERENCES vehicles(id)
        ON DELETE CASCADE,

    geom GEOMETRY(Point, 4326) NOT NULL,

    recorded_at TIMESTAMPTZ NOT NULL,

    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- Latest-location lookup.

CREATE INDEX idx_locations_vehicle_recorded
ON locations (
    vehicle_id,
    recorded_at DESC,
    id DESC
);


-- Spatial queries.

CREATE INDEX idx_locations_geom
ON locations
USING GIST (geom);


-- ============================================================
-- VEHICLE GEOFENCE STATE
-- ============================================================

-- Stores the CURRENT geofence membership of each vehicle.
--
-- This table enables:
--
-- previous state
--      vs
-- current PostGIS result
--
-- to detect ENTRY and EXIT events efficiently.

CREATE TABLE vehicle_geofence_state (
    vehicle_id UUID NOT NULL
        REFERENCES vehicles(id)
        ON DELETE CASCADE,

    geofence_id UUID NOT NULL
        REFERENCES geofences(id)
        ON DELETE CASCADE,

    entered_at TIMESTAMPTZ NOT NULL,

    PRIMARY KEY (
        vehicle_id,
        geofence_id
    )
);


CREATE INDEX idx_vehicle_geofence_state_geofence
ON vehicle_geofence_state (geofence_id);


-- ============================================================
-- ALERT CONFIGURATIONS
-- ============================================================

-- Represents the alert rules configured through:
--
-- POST /alerts/configure
-- GET  /alerts
--
-- vehicle_id = NULL means:
--
-- apply this rule to ALL vehicles.

CREATE TABLE alert_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    geofence_id UUID NOT NULL
        REFERENCES geofences(id)
        ON DELETE CASCADE,

    vehicle_id UUID
        REFERENCES vehicles(id)
        ON DELETE CASCADE,

    event_type VARCHAR(10) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'active',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_alert_config_event_type
        CHECK (
            event_type IN (
                'entry',
                'exit',
                'both'
            )
        ),

    CONSTRAINT chk_alert_config_status
        CHECK (
            status IN (
                'active',
                'inactive'
            )
        )
);


CREATE INDEX idx_alert_configs_geofence
ON alert_configs (geofence_id);


CREATE INDEX idx_alert_configs_vehicle
ON alert_configs (vehicle_id);


-- Efficient lookup when processing geofence events.

CREATE INDEX idx_alert_configs_matching
ON alert_configs (
    geofence_id,
    vehicle_id,
    event_type
)
WHERE status = 'active';


-- ============================================================
-- VIOLATIONS
-- ============================================================

-- Stores every detected ENTRY or EXIT event.
--
-- Violations exist independently of alert configurations.
--
-- Example:
--
-- Vehicle enters geofence
--
--      ↓
--
-- violation created
--
--      ↓
--
-- matching alert configuration?
--
-- YES → alert created + WebSocket broadcast
--
-- NO  → violation still remains in history.

CREATE TABLE violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    vehicle_id UUID NOT NULL
        REFERENCES vehicles(id)
        ON DELETE CASCADE,

    geofence_id UUID NOT NULL
        REFERENCES geofences(id)
        ON DELETE CASCADE,

    location_id BIGINT NOT NULL
        REFERENCES locations(id)
        ON DELETE RESTRICT,

    event_type VARCHAR(10) NOT NULL,

    event_timestamp TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_violation_event_type
        CHECK (
            event_type IN (
                'entry',
                'exit'
            )
        )
);


-- Vehicle filtering + date filtering.

CREATE INDEX idx_violations_vehicle_timestamp
ON violations (
    vehicle_id,
    event_timestamp DESC
);


-- Geofence filtering + date filtering.

CREATE INDEX idx_violations_geofence_timestamp
ON violations (
    geofence_id,
    event_timestamp DESC
);


-- General chronological history.

CREATE INDEX idx_violations_event_timestamp
ON violations (
    event_timestamp DESC
);


-- ============================================================
-- ALERT EVENTS
-- ============================================================

-- Stores alerts generated from matching alert configurations.
--
-- These records are used for:
--
-- historical storage
-- debugging
-- retry mechanisms
-- future alert-history UI
--
-- WebSocket broadcasting happens after the transaction commits.

CREATE TABLE alert_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    alert_config_id UUID NOT NULL
        REFERENCES alert_configs(id)
        ON DELETE RESTRICT,

    violation_id UUID NOT NULL
        REFERENCES violations(id)
        ON DELETE RESTRICT,

    vehicle_id UUID NOT NULL
        REFERENCES vehicles(id)
        ON DELETE CASCADE,

    geofence_id UUID NOT NULL
        REFERENCES geofences(id)
        ON DELETE CASCADE,

    location_id BIGINT NOT NULL
        REFERENCES locations(id)
        ON DELETE RESTRICT,

    event_type VARCHAR(10) NOT NULL,

    event_timestamp TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_alert_event_type
        CHECK (
            event_type IN (
                'entry',
                'exit'
            )
        )
);


-- Prevent the same configuration from creating the same alert twice.

CREATE UNIQUE INDEX idx_alert_events_unique
ON alert_events (
    alert_config_id,
    violation_id
);


CREATE INDEX idx_alert_events_created_at
ON alert_events (
    created_at DESC
);


CREATE INDEX idx_alert_events_vehicle
ON alert_events (
    vehicle_id,
    created_at DESC
);


CREATE INDEX idx_alert_events_geofence
ON alert_events (
    geofence_id,
    created_at DESC
);