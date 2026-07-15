import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CarFront,
  CircleDot,
  LocateFixed,
  MapPinned,
  Radio,
  Search,
  ShieldCheck,
  Wifi,
} from "lucide-react";

import { getGeofences } from "../api/geofenceApi";

import {
  getVehicleLocation,
  getVehicles,
} from "../api/vehicleApi";

import LiveMapView from "../components/LiveMapView";

import useLiveAlerts from "../hooks/useLiveAlerts";

function formatTimestamp(value) {
  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleString();
}

function MapPage() {
  const [geofences, setGeofences] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleLocations, setVehicleLocations] =
    useState([]);

  const [selectedVehicleID, setSelectedVehicleID] =
    useState("");

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const {
    alerts: liveAlerts,
    connected,
  } = useLiveAlerts();

  useEffect(() => {
    async function loadMapData() {
      try {
        setLoading(true);
        setError("");

        const [
          geofenceResponse,
          vehicleResponse,
        ] = await Promise.all([
          getGeofences(),
          getVehicles(),
        ]);

        const loadedVehicles =
          vehicleResponse.vehicles ?? [];

        setGeofences(
          geofenceResponse.geofences ?? [],
        );

        setVehicles(loadedVehicles);

        const locationResults =
          await Promise.allSettled(
            loadedVehicles.map((vehicle) =>
              getVehicleLocation(vehicle.id),
            ),
          );

        const locations = locationResults
          .filter(
            (result) =>
              result.status === "fulfilled",
          )
          .map((result) => result.value);

        setVehicleLocations(locations);

        if (locations.length > 0) {
          setSelectedVehicleID(
            locations[0].vehicle_id,
          );
        }
      } catch (requestError) {
        console.error(requestError);

        setError(
          "Could not load live map data.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadMapData();
  }, []);

  useEffect(() => {
    if (liveAlerts.length === 0) {
      return;
    }

    const latestAlert = liveAlerts[0];

    setVehicleLocations((current) =>
      current.map((vehicle) => {
        if (
          vehicle.vehicle_id !==
          latestAlert.vehicle.vehicle_id
        ) {
          return vehicle;
        }

        return {
          ...vehicle,

          current_location: {
            latitude:
              latestAlert.location.latitude,

            longitude:
              latestAlert.location.longitude,

            timestamp: latestAlert.timestamp,
          },
        };
      }),
    );
  }, [liveAlerts]);

  const selectedVehicle = useMemo(
    () =>
      vehicleLocations.find(
        (vehicle) =>
          vehicle.vehicle_id ===
          selectedVehicleID,
      ) ?? null,
    [vehicleLocations, selectedVehicleID],
  );

  const filteredVehicles = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) {
      return vehicles;
    }

    return vehicles.filter((vehicle) => {
      return (
        vehicle.vehicle_number
          ?.toLowerCase()
          .includes(value) ||
        vehicle.driver_name
          ?.toLowerCase()
          .includes(value)
      );
    });
  }, [vehicles, search]);

  const locationByVehicleID = useMemo(() => {
    return new Map(
      vehicleLocations.map((vehicle) => [
        vehicle.vehicle_id,
        vehicle,
      ]),
    );
  }, [vehicleLocations]);

  function selectVehicle(vehicleID) {
    const location =
      locationByVehicleID.get(vehicleID);

    if (location) {
      setSelectedVehicleID(vehicleID);
    }
  }

  if (loading) {
    return (
      <div className="dashboard-state">
        Loading live map...
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-state error-state">
        {error}
      </div>
    );
  }

  return (
    <div className="page live-map-page">
      <header className="page-header">
        <div>
          <p className="page-eyebrow">
            Real-time Monitoring
          </p>

          <h2>Live Map</h2>

          <p className="page-description">
            Monitor vehicle locations, geofence
            membership, and live events.
          </p>
        </div>

        <div
          className={
            connected
              ? "page-status"
              : "page-status disconnected"
          }
        >
          <span className="live-indicator" />

          {connected
            ? "Alert Stream Connected"
            : "Reconnecting"}
        </div>
      </header>

      <section className="live-map-layout">
        <article className="live-map-card">
          <div className="map-toolbar">
            <div>
              <p className="card-eyebrow">
                Fleet Geography
              </p>

              <h3>Vehicle & Geofence Map</h3>
            </div>

            <div className="map-toolbar-meta">
              <span>
                <CarFront size={14} />
                {vehicleLocations.length} located
              </span>

              <span>
                <MapPinned size={14} />
                {geofences.length} zones
              </span>
            </div>
          </div>

          <LiveMapView
            geofences={geofences}
            vehicleLocations={vehicleLocations}
            selectedVehicle={selectedVehicle}
            onSelectVehicle={(vehicle) =>
              setSelectedVehicleID(
                vehicle.vehicle_id,
              )
            }
          />

          <div className="live-map-footer">
            <span>
              <i className="legend-dot selected" />
              Selected vehicle
            </span>

            <span>
              <i className="legend-dot moving" />
              Vehicle
            </span>

            <span>
              <i className="legend-dot geofence" />
              Geofence boundary
            </span>
          </div>
        </article>

        <aside className="map-side-panel">
          <section className="side-card vehicle-browser">
            <div className="side-card-heading">
              <div>
                <p className="card-eyebrow">
                  Fleet Browser
                </p>

                <h3>Vehicles</h3>
              </div>

              <CarFront size={18} />
            </div>

            <label className="vehicle-search">
              <Search size={16} />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search vehicle or driver"
              />
            </label>

            <div className="vehicle-list">
              {filteredVehicles.map((vehicle) => {
                const location =
                  locationByVehicleID.get(
                    vehicle.id,
                  );

                const isSelected =
                  selectedVehicleID === vehicle.id;

                return (
                  <button
                    key={vehicle.id}
                    type="button"
                    disabled={!location}
                    className={
                      isSelected
                        ? "vehicle-list-item selected"
                        : "vehicle-list-item"
                    }
                    onClick={() =>
                      selectVehicle(vehicle.id)
                    }
                  >
                    <span className="vehicle-list-icon">
                      <CarFront size={16} />
                    </span>

                    <span className="vehicle-list-main">
                      <strong>
                        {vehicle.vehicle_number}
                      </strong>

                      <small>
                        {vehicle.driver_name ||
                          "No driver assigned"}
                      </small>
                    </span>

                    <span
                      className={
                        location
                          ? "location-status available"
                          : "location-status unavailable"
                      }
                    >
                      <CircleDot size={10} />

                      {location
                        ? "Located"
                        : "No GPS"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="side-card selected-vehicle-card">
            <div className="side-card-heading">
              <div>
                <p className="card-eyebrow">
                  Current Selection
                </p>

                <h3>Vehicle Details</h3>
              </div>

              <LocateFixed size={18} />
            </div>

            {!selectedVehicle ? (
              <div className="empty-state">
                Select a located vehicle.
              </div>
            ) : (
              <div className="vehicle-detail-content">
                <div className="selected-vehicle-title">
                  <span className="selected-vehicle-icon">
                    <CarFront size={20} />
                  </span>

                  <div>
                    <strong>
                      {
                        selectedVehicle.vehicle_number
                      }
                    </strong>

                    <small>
                      {
                        vehicles.find(
                          (vehicle) =>
                            vehicle.id ===
                            selectedVehicle.vehicle_id,
                        )?.driver_name
                      }
                    </small>
                  </div>
                </div>

                <div className="vehicle-coordinate-grid">
                  <div>
                    <span>Latitude</span>

                    <strong>
                      {selectedVehicle.current_location.latitude.toFixed(
                        6,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Longitude</span>

                    <strong>
                      {selectedVehicle.current_location.longitude.toFixed(
                        6,
                      )}
                    </strong>
                  </div>
                </div>

                <div className="detail-row">
                  <span>
                    <Wifi size={14} />
                    Last Location
                  </span>

                  <strong>
                    {formatTimestamp(
                      selectedVehicle
                        .current_location.timestamp,
                    )}
                  </strong>
                </div>

                <div className="membership-block">
                  <span className="membership-title">
                    <ShieldCheck size={14} />
                    Current Geofences
                  </span>

                  {selectedVehicle.current_geofences
                    .length === 0 ? (
                    <p>Outside all geofences</p>
                  ) : (
                    <div className="membership-tags">
                      {selectedVehicle.current_geofences.map(
                        (geofence) => (
                          <span
                            key={
                              geofence.geofence_id
                            }
                          >
                            {geofence.geofence_name}
                          </span>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="side-card mini-feed-card">
            <div className="side-card-heading">
              <div>
                <p className="card-eyebrow">
                  Alert Stream
                </p>

                <h3>Recent Live Events</h3>
              </div>

              <Radio size={18} />
            </div>

            <div className="mini-live-feed">
              {liveAlerts.length === 0 ? (
                <div className="empty-state">
                  Waiting for live alerts...
                </div>
              ) : (
                liveAlerts.slice(0, 4).map((alert) => (
                  <div
                    className="mini-live-event"
                    key={alert.event_id}
                  >
                    <span
                      className={
                        alert.event_type === "entry"
                          ? "activity-pulse entry"
                          : "activity-pulse exit"
                      }
                    />

                    <div>
                      <strong>
                        {
                          alert.vehicle
                            .vehicle_number
                        }
                      </strong>

                      <p>
                        {alert.event_type} ·{" "}
                        {
                          alert.geofence
                            .geofence_name
                        }
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}

export default MapPage;