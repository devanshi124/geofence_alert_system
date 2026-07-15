import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CarFront,
  CheckCircle2,
  CircleDot,
  LocateFixed,
  LoaderCircle,
  MapPinned,
  Navigation,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

import {
  createVehicle,
  getVehicleLocation,
  getVehicles,
  updateVehicleLocation,
} from "../api/vehicleApi";

import { getGeofences } from "../api/geofenceApi";

import VehicleDetailMap from
  "../components/VehicleDetailMap";

import LocationPickerMap from
  "../components/LocationPickerMap";

const INITIAL_VEHICLE_FORM = {
  vehicle_number: "",
  driver_name: "",
  phone: "",
  vehicle_type: "",
};

const VEHICLE_TYPES = [
  "truck",
  "van",
  "car",
  "bike",
];

function formatTimestamp(value) {
  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleString();
}

function VehiclesPage() {
  /*
  |--------------------------------------------------------------------------
  | PAGE DATA
  |--------------------------------------------------------------------------
  */

  const [vehicles, setVehicles] = useState([]);

  const [geofences, setGeofences] = useState([]);

  const [locations, setLocations] = useState({});

  const [
    selectedVehicleID,
    setSelectedVehicleID,
  ] = useState("");

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  /*
  |--------------------------------------------------------------------------
  | CREATE VEHICLE MODAL
  |--------------------------------------------------------------------------
  */

  const [
    showCreateVehicle,
    setShowCreateVehicle,
  ] = useState(false);

  const [
    vehicleForm,
    setVehicleForm,
  ] = useState(INITIAL_VEHICLE_FORM);

  const [
    creatingVehicle,
    setCreatingVehicle,
  ] = useState(false);

  const [createError, setCreateError] =
    useState("");

  const [createSuccess, setCreateSuccess] =
    useState("");

  /*
  |--------------------------------------------------------------------------
  | LOCATION MODAL
  |--------------------------------------------------------------------------
  */

  const [
    showLocationModal,
    setShowLocationModal,
  ] = useState(false);

  const [
    selectedNewLocation,
    setSelectedNewLocation,
  ] = useState(null);

  const [
    locationQuery,
    setLocationQuery,
  ] = useState("");

  const [
    locationSearchResults,
    setLocationSearchResults,
  ] = useState([]);

  const [
    searchingLocation,
    setSearchingLocation,
  ] = useState(false);

  const [
    updatingLocation,
    setUpdatingLocation,
  ] = useState(false);

  const [
    locationError,
    setLocationError,
  ] = useState("");

  const [
    locationSuccess,
    setLocationSuccess,
  ] = useState("");

  /*
  |--------------------------------------------------------------------------
  | INITIAL DATA LOAD
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let ignore = false;

    async function loadPage() {
      try {
        setLoading(true);

        setError("");

        const [
          vehicleResponse,
          geofenceResponse,
        ] = await Promise.all([
          getVehicles(),
          getGeofences(),
        ]);

        if (ignore) {
          return;
        }

        const loadedVehicles =
          vehicleResponse.vehicles ?? [];

        setVehicles(loadedVehicles);

        setGeofences(
          geofenceResponse.geofences ?? [],
        );

        /*
         * A vehicle may not have a location yet.
         *
         * Promise.allSettled prevents one 404 from
         * failing the complete Vehicles page.
         */

        const results = await Promise.allSettled(
          loadedVehicles.map(async (vehicle) => {
            const location =
              await getVehicleLocation(vehicle.id);

            return {
              vehicleID: vehicle.id,
              location,
            };
          }),
        );

        if (ignore) {
          return;
        }

        const locationMap = {};

        results.forEach((result) => {
          if (result.status === "fulfilled") {
            locationMap[
              result.value.vehicleID
            ] = result.value.location;
          }
        });

        setLocations(locationMap);

        if (loadedVehicles.length > 0) {
          setSelectedVehicleID(
            loadedVehicles[0].id,
          );
        }
      } catch (requestError) {
        console.error(requestError);

        if (!ignore) {
          setError(
            "Could not load vehicle information.",
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadPage();

    return () => {
      ignore = true;
    };
  }, []);

  /*
  |--------------------------------------------------------------------------
  | LOCATION SEARCH
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (!showLocationModal) {
      return undefined;
    }

    const query = locationQuery.trim();

    if (query.length < 3) {
      setLocationSearchResults([]);

      setSearchingLocation(false);

      return undefined;
    }

    const controller = new AbortController();

    const timer = window.setTimeout(
      async () => {
        try {
          setSearchingLocation(true);

          const params =
            new URLSearchParams({
              q: query,
              format: "jsonv2",
              limit: "5",
              addressdetails: "1",
            });

          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?${params.toString()}`,
            {
              signal: controller.signal,

              headers: {
                Accept: "application/json",
              },
            },
          );

          if (!response.ok) {
            throw new Error(
              "Location search failed.",
            );
          }

          const results =
            await response.json();

          if (!controller.signal.aborted) {
            setLocationSearchResults(results);
          }
        } catch (searchError) {
          if (
            searchError.name !== "AbortError"
          ) {
            console.error(searchError);

            setLocationError(
              "Could not search locations.",
            );
          }
        } finally {
          if (!controller.signal.aborted) {
            setSearchingLocation(false);
          }
        }
      },
      500,
    );

    return () => {
      window.clearTimeout(timer);

      controller.abort();
    };
  }, [
    locationQuery,
    showLocationModal,
  ]);

  /*
  |--------------------------------------------------------------------------
  | DERIVED VALUES
  |--------------------------------------------------------------------------
  */

  const filteredVehicles = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return vehicles.filter((vehicle) => {
      const vehicleNumber =
        vehicle.vehicle_number
          ?.toLowerCase() ?? "";

      const driverName =
        vehicle.driver_name
          ?.toLowerCase() ?? "";

      const matchesSearch =
        !query ||
        vehicleNumber.includes(query) ||
        driverName.includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        vehicle.status === statusFilter;

      return (
        matchesSearch &&
        matchesStatus
      );
    });
  }, [
    vehicles,
    search,
    statusFilter,
  ]);

  const selectedVehicle = useMemo(() => {
    return (
      vehicles.find(
        (vehicle) =>
          vehicle.id === selectedVehicleID,
      ) ?? null
    );
  }, [
    vehicles,
    selectedVehicleID,
  ]);

  const selectedLocation =
    locations[selectedVehicleID] ?? null;

  /*
  |--------------------------------------------------------------------------
  | CREATE VEHICLE FUNCTIONS
  |--------------------------------------------------------------------------
  */

  function openCreateVehicleModal() {
    setVehicleForm(
      INITIAL_VEHICLE_FORM,
    );

    setCreateError("");

    setCreateSuccess("");

    setShowCreateVehicle(true);
  }

  function closeCreateVehicleModal() {
    if (creatingVehicle) {
      return;
    }

    setShowCreateVehicle(false);

    setVehicleForm(
      INITIAL_VEHICLE_FORM,
    );

    setCreateError("");

    setCreateSuccess("");
  }

  function updateVehicleForm(event) {
    const { name, value } = event.target;

    setVehicleForm((current) => ({
      ...current,

      [name]: value,
    }));

    setCreateError("");

    setCreateSuccess("");
  }

  async function handleCreateVehicle(event) {
    event.preventDefault();

    const vehicleNumber =
      vehicleForm.vehicle_number.trim();

    const driverName =
      vehicleForm.driver_name.trim();

    const phone =
      vehicleForm.phone.trim();

    const vehicleType =
      vehicleForm.vehicle_type.trim();

    if (!vehicleNumber) {
      setCreateError(
        "Vehicle number is required.",
      );

      return;
    }

    if (!driverName) {
      setCreateError(
        "Driver name is required.",
      );

      return;
    }

    if (!phone) {
      setCreateError(
        "Phone is required.",
      );

      return;
    }

    if (!vehicleType) {
      setCreateError(
        "Vehicle type is required.",
      );

      return;
    }

    try {
      setCreatingVehicle(true);

      setCreateError("");

      setCreateSuccess("");

      const response =
        await createVehicle({
          vehicle_number: vehicleNumber,
          driver_name: driverName,
          phone,
          vehicle_type: vehicleType,
        });

      const vehiclesResponse =
        await getVehicles();

      const updatedVehicles =
        vehiclesResponse.vehicles ?? [];

      setVehicles(updatedVehicles);

      setSelectedVehicleID(response.id);

      setCreateSuccess(
        "Vehicle registered successfully.",
      );

      setVehicleForm(
        INITIAL_VEHICLE_FORM,
      );

      /*
       * Close modal directly with state updates.
       * Do not call a function during rendering.
       */

      window.setTimeout(() => {
        setShowCreateVehicle(false);

        setCreateSuccess("");
      }, 800);
    } catch (requestError) {
      console.error(requestError);

      setCreateError(
        requestError.response
          ?.data?.error ??
          "Could not register vehicle.",
      );
    } finally {
      setCreatingVehicle(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | LOCATION MODAL FUNCTIONS
  |--------------------------------------------------------------------------
  */

  function openLocationModal() {
    if (!selectedVehicleID) {
      return;
    }

    const currentLocation =
      locations[selectedVehicleID]
        ?.current_location;

    if (currentLocation) {
      setSelectedNewLocation({
        latitude:
          currentLocation.latitude,

        longitude:
          currentLocation.longitude,
      });
    } else {
      setSelectedNewLocation(null);
    }

    setLocationQuery("");

    setLocationSearchResults([]);

    setSearchingLocation(false);

    setLocationError("");

    setLocationSuccess("");

    setShowLocationModal(true);
  }

  function closeLocationModal() {
    if (updatingLocation) {
      return;
    }

    setShowLocationModal(false);

    setSelectedNewLocation(null);

    setLocationQuery("");

    setLocationSearchResults([]);

    setSearchingLocation(false);

    setLocationError("");

    setLocationSuccess("");
  }

  function handleMapLocationSelect(
    location,
  ) {
    setSelectedNewLocation({
      latitude: location.latitude,

      longitude: location.longitude,
    });

    setLocationError("");
  }

  function handleSearchResultSelect(
    result,
  ) {
    setSelectedNewLocation({
      latitude: Number(result.lat),

      longitude: Number(result.lon),
    });

    setLocationQuery(
      result.display_name,
    );

    setLocationSearchResults([]);

    setLocationError("");
  }

  function updateSelectedCoordinate(
    field,
    value,
  ) {
    /*
     * Keep empty strings while user edits.
     *
     * Conversion to Number happens only
     * during submission.
     */

    setSelectedNewLocation((current) => ({
      latitude:
        field === "latitude"
          ? value
          : current?.latitude ?? "",

      longitude:
        field === "longitude"
          ? value
          : current?.longitude ?? "",
    }));

    setLocationError("");
  }

  async function handleLocationSubmit(
    event,
  ) {
    event.preventDefault();

    if (!selectedVehicleID) {
      setLocationError(
        "Select a vehicle first.",
      );

      return;
    }

    if (!selectedNewLocation) {
      setLocationError(
        "Select a location.",
      );

      return;
    }

    const latitude = Number(
      selectedNewLocation.latitude,
    );

    const longitude = Number(
      selectedNewLocation.longitude,
    );

    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90
    ) {
      setLocationError(
        "Latitude must be between -90 and 90.",
      );

      return;
    }

    if (
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      setLocationError(
        "Longitude must be between -180 and 180.",
      );

      return;
    }

    try {
      setUpdatingLocation(true);

      setLocationError("");

      setLocationSuccess("");

      await updateVehicleLocation({
        vehicle_id: selectedVehicleID,

        latitude,

        longitude,

        timestamp:
          new Date().toISOString(),
      });

      /*
       * Important:
       *
       * Refresh from backend instead of
       * manually changing the UI.
       *
       * The backend calculates:
       * - current geofences
       * - entry/exit transitions
       * - violations
       * - alerts
       */

      const refreshedLocation =
        await getVehicleLocation(
          selectedVehicleID,
        );

      setLocations((current) => ({
        ...current,

        [selectedVehicleID]:
          refreshedLocation,
      }));

      setLocationSuccess(
        "Vehicle location updated successfully.",
      );

      window.setTimeout(() => {
        setShowLocationModal(false);

        setSelectedNewLocation(null);

        setLocationQuery("");

        setLocationSearchResults([]);

        setLocationSuccess("");
      }, 800);
    } catch (requestError) {
      console.error(requestError);

      setLocationError(
        requestError.response
          ?.data?.error ??
          "Could not update vehicle location.",
      );
    } finally {
      setUpdatingLocation(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | PAGE STATES
  |--------------------------------------------------------------------------
  */

  if (loading) {
    return (
      <div className="dashboard-state">
        Loading vehicles...
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

  /*
  |--------------------------------------------------------------------------
  | PAGE UI
  |--------------------------------------------------------------------------
  */

  return (
    <div className="page vehicles-page">
      <header className="page-header">
        <div>
          <p className="page-eyebrow">
            Fleet Management
          </p>

          <h2>Vehicles</h2>

          <p className="page-description">
            Search the fleet, register vehicles,
            update locations, and inspect geofence
            membership.
          </p>
        </div>

        <div className="vehicle-header-actions">
          <div className="page-status">
            <CarFront size={15} />

            {vehicles.length} Registered Vehicles
          </div>

          <button
            type="button"
            className="primary-action"
            onClick={openCreateVehicleModal}
          >
            <Plus size={16} />

            Register Vehicle
          </button>
        </div>
      </header>

      <section className="vehicles-workspace">
        {/* FLEET PANEL */}

        <aside className="fleet-panel">
          <div className="fleet-panel-heading">
            <div>
              <p className="card-eyebrow">
                Fleet Directory
              </p>

              <h3>Vehicle Browser</h3>
            </div>

            <CarFront size={19} />
          </div>

          <div className="fleet-controls">
            <label className="fleet-search">
              <Search size={16} />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search vehicle or driver"
              />
            </label>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value,
                )
              }
            >
              <option value="all">
                All statuses
              </option>

              <option value="active">
                Active
              </option>

              <option value="inactive">
                Inactive
              </option>

              <option value="maintenance">
                Maintenance
              </option>
            </select>
          </div>

          <div className="fleet-list">
            {filteredVehicles.length === 0 ? (
              <div className="empty-state">
                No matching vehicles.
              </div>
            ) : (
              filteredVehicles.map(
                (vehicle) => {
                  const hasLocation =
                    Boolean(
                      locations[vehicle.id],
                    );

                  const selected =
                    selectedVehicleID ===
                    vehicle.id;

                  return (
                    <button
                      key={vehicle.id}
                      type="button"
                      className={
                        selected
                          ? "fleet-item selected"
                          : "fleet-item"
                      }
                      onClick={() =>
                        setSelectedVehicleID(
                          vehicle.id,
                        )
                      }
                    >
                      <span className="fleet-item-icon">
                        <CarFront size={18} />
                      </span>

                      <span className="fleet-item-main">
                        <strong>
                          {
                            vehicle.vehicle_number
                          }
                        </strong>

                        <small>
                          {vehicle.driver_name ||
                            "No driver assigned"}
                        </small>
                      </span>

                      <span className="fleet-item-meta">
                        <span
                          className={`vehicle-status-badge ${vehicle.status}`}
                        >
                          {vehicle.status}
                        </span>

                        <span
                          className={
                            hasLocation
                              ? "gps-state available"
                              : "gps-state unavailable"
                          }
                        >
                          <CircleDot size={9} />

                          {hasLocation
                            ? "GPS"
                            : "No GPS"}
                        </span>
                      </span>
                    </button>
                  );
                },
              )
            )}
          </div>
        </aside>

        {/* VEHICLE INSPECTOR */}

        <section className="vehicle-inspector">
          {!selectedVehicle ? (
            <div className="empty-state">
              Select a vehicle.
            </div>
          ) : (
            <>
              <article className="vehicle-profile-card">
                <div className="vehicle-profile-main">
                  <span className="vehicle-profile-icon">
                    <CarFront size={25} />
                  </span>

                  <div>
                    <p className="card-eyebrow">
                      Selected Vehicle
                    </p>

                    <h3>
                      {
                        selectedVehicle.vehicle_number
                      }
                    </h3>

                    <span
                      className={`vehicle-status-badge ${selectedVehicle.status}`}
                    >
                      {selectedVehicle.status}
                    </span>
                  </div>
                </div>

                <div className="vehicle-profile-details">
                  <div>
                    <UserRound size={16} />

                    <span>Driver</span>

                    <strong>
                      {selectedVehicle.driver_name ||
                        "Not assigned"}
                    </strong>
                  </div>

                  <div>
                    <LocateFixed size={16} />

                    <span>
                      Location Status
                    </span>

                    <strong>
                      {selectedLocation
                        ? "Available"
                        : "No location"}
                    </strong>
                  </div>

                  <div>
                    <MapPinned size={16} />

                    <span>Current Zones</span>

                    <strong>
                      {selectedLocation
                        ?.current_geofences
                        ?.length ?? 0}
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="update-location-button"
                  onClick={openLocationModal}
                >
                  <Navigation size={16} />

                  Update Location
                </button>
              </article>

              {/* VEHICLE MAP */}

              <article className="vehicle-map-card">
                <div className="map-toolbar">
                  <div>
                    <p className="card-eyebrow">
                      Spatial Position
                    </p>

                    <h3>Current Location</h3>
                  </div>

                  {selectedLocation && (
                    <span className="vehicle-map-time">
                      Updated{" "}
                      {formatTimestamp(
                        selectedLocation
                          .current_location
                          ?.timestamp,
                      )}
                    </span>
                  )}
                </div>

                {selectedLocation ? (
                  <VehicleDetailMap
                    vehicleLocation={
                      selectedLocation
                    }
                    geofences={geofences}
                  />
                ) : (
                  <div className="vehicle-no-location">
                    <LocateFixed size={30} />

                    <strong>
                      No location recorded
                    </strong>

                    <p>
                      Use Update Location to simulate
                      a GPS location for this vehicle.
                    </p>
                  </div>
                )}
              </article>

              {/* CURRENT GEOFENCES */}

              <article className="vehicle-membership-card">
                <div className="section-heading">
                  <div>
                    <p className="card-eyebrow">
                      Spatial Membership
                    </p>

                    <h3>
                      Current Geofences
                    </h3>
                  </div>

                  <ShieldCheck size={18} />
                </div>

                {!selectedLocation ||
                !selectedLocation
                  .current_geofences ||
                selectedLocation
                  .current_geofences.length === 0 ? (
                  <div className="empty-state">
                    Vehicle is outside all geofences.
                  </div>
                ) : (
                  <div className="vehicle-zone-grid">
                    {selectedLocation.current_geofences.map(
                      (geofence) => (
                        <div
                          className="vehicle-zone-card"
                          key={
                            geofence.geofence_id
                          }
                        >
                          <MapPinned size={18} />

                          <div>
                            <strong>
                              {
                                geofence.geofence_name
                              }
                            </strong>

                            <span>
                              {geofence.category}
                            </span>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </article>
            </>
          )}
        </section>
      </section>

      {/* CREATE VEHICLE MODAL */}

      {showCreateVehicle && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeCreateVehicleModal();
            }
          }}
        >
          <section className="create-vehicle-modal">
            <div className="modal-heading">
              <div>
                <p className="card-eyebrow">
                  Fleet Registration
                </p>

                <h3>Register Vehicle</h3>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={
                  closeCreateVehicleModal
                }
              >
                <X size={18} />
              </button>
            </div>

            <form
              className="create-vehicle-form"
              onSubmit={handleCreateVehicle}
            >
              <label className="form-field">
                <span>Vehicle Number</span>

                <input
                  name="vehicle_number"
                  value={
                    vehicleForm.vehicle_number
                  }
                  onChange={updateVehicleForm}
                  placeholder="GJ01AB1234"
                />
              </label>

              <label className="form-field">
                <span>Driver Name</span>

                <input
                  name="driver_name"
                  value={
                    vehicleForm.driver_name
                  }
                  onChange={updateVehicleForm}
                  placeholder="Rahul Sharma"
                />
              </label>

              <label className="form-field">
                <span>Phone</span>

                <input
                  type="tel"
                  name="phone"
                  value={vehicleForm.phone}
                  onChange={updateVehicleForm}
                  placeholder="+91 9876543210"
                />
              </label>

              <label className="form-field">
                <span>Vehicle Type</span>

                <select
                  name="vehicle_type"
                  value={
                    vehicleForm.vehicle_type
                  }
                  onChange={updateVehicleForm}
                >
                  <option value="">
                    Select vehicle type
                  </option>

                  {VEHICLE_TYPES.map(
                    (type) => (
                      <option
                        key={type}
                        value={type}
                      >
                        {type}
                      </option>
                    ),
                  )}
                </select>
              </label>

              {createError && (
                <div className="form-message error">
                  {createError}
                </div>
              )}

              {createSuccess && (
                <div className="form-message success">
                  <CheckCircle2 size={15} />

                  {createSuccess}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-cancel-button"
                  onClick={
                    closeCreateVehicleModal
                  }
                  disabled={creatingVehicle}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="modal-submit-button"
                  disabled={creatingVehicle}
                >
                  <Plus size={15} />

                  {creatingVehicle
                    ? "Registering..."
                    : "Register Vehicle"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* LOCATION UPDATE MODAL */}

      {showLocationModal &&
        selectedVehicle && (
          <div
            className="modal-backdrop"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeLocationModal();
              }
            }}
          >
            <section className="location-modal">
              <div className="modal-heading">
                <div>
                  <p className="card-eyebrow">
                    GPS Simulator
                  </p>

                  <h3>
                    Update Vehicle Location
                  </h3>

                  <span className="location-modal-vehicle">
                    {
                      selectedVehicle.vehicle_number
                    }
                  </span>
                </div>

                <button
                  type="button"
                  className="modal-close"
                  onClick={closeLocationModal}
                >
                  <X size={18} />
                </button>
              </div>

              <form
                className="location-update-form"
                onSubmit={
                  handleLocationSubmit
                }
              >
                <div className="location-search-wrapper">
                  <label className="location-search-input">
                    <Search size={16} />

                    <input
                      value={locationQuery}
                      onChange={(event) => {
                        setLocationQuery(
                          event.target.value,
                        );

                        setLocationError("");
                      }}
                      placeholder="Search city, address, or location..."
                    />

                    {searchingLocation && (
                      <LoaderCircle
                        size={16}
                        className="search-spinner"
                      />
                    )}
                  </label>

                  {locationSearchResults.length >
                    0 && (
                    <div className="vehicle-location-results">
                      {locationSearchResults.map(
                        (result) => (
                          <button
                            type="button"
                            key={
                              result.place_id
                            }
                            onClick={() =>
                              handleSearchResultSelect(
                                result,
                              )
                            }
                          >
                            <MapPinned
                              size={15}
                            />

                            <span>
                              {
                                result.display_name
                              }
                            </span>
                          </button>
                        ),
                      )}
                    </div>
                  )}
                </div>

                <div className="location-picker-wrapper">
                  <LocationPickerMap
                    selectedLocation={
                      selectedNewLocation
                    }
                    onSelect={
                      handleMapLocationSelect
                    }
                  />
                </div>

                <p className="location-picker-help">
                  Search for a location, click the
                  map, or enter coordinates manually.
                </p>

                <div className="coordinate-fields">
                  <label className="form-field">
                    <span>Latitude</span>

                    <input
                      type="number"
                      step="any"
                      value={
                        selectedNewLocation
                          ?.latitude ?? ""
                      }
                      onChange={(event) =>
                        updateSelectedCoordinate(
                          "latitude",
                          event.target.value,
                        )
                      }
                      placeholder="21.1702"
                    />
                  </label>

                  <label className="form-field">
                    <span>Longitude</span>

                    <input
                      type="number"
                      step="any"
                      value={
                        selectedNewLocation
                          ?.longitude ?? ""
                      }
                      onChange={(event) =>
                        updateSelectedCoordinate(
                          "longitude",
                          event.target.value,
                        )
                      }
                      placeholder="72.8311"
                    />
                  </label>
                </div>

                {locationError && (
                  <div className="form-message error">
                    {locationError}
                  </div>
                )}

                {locationSuccess && (
                  <div className="form-message success">
                    <CheckCircle2 size={15} />

                    {locationSuccess}
                  </div>
                )}

                <div className="modal-actions">
                  <button
                    type="button"
                    className="modal-cancel-button"
                    onClick={
                      closeLocationModal
                    }
                    disabled={
                      updatingLocation
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="modal-submit-button"
                    disabled={
                      updatingLocation ||
                      !selectedNewLocation
                    }
                  >
                    <Navigation size={15} />

                    {updatingLocation
                      ? "Updating..."
                      : "Update Location"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
    </div>
  );
}

export default VehiclesPage;