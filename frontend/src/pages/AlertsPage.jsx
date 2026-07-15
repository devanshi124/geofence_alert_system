import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  BellRing,
  CheckCircle2,
  Filter,
  MapPinned,
  Plus,
  Search,
  ShieldAlert,
  Truck,
  X,
} from "lucide-react";

import {
  createAlertConfig,
  getAlerts,
} from "../api/alertApi";

import { getGeofences } from "../api/geofenceApi";
import { getVehicles } from "../api/vehicleApi";

const INITIAL_FORM = {
  geofence_id: "",
  scope: "all",
  vehicle_id: "",
  event_type: "entry",
};

function formatTimestamp(value) {
  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleString();
}

function getEventLabel(eventType) {
  switch (eventType) {
    case "entry":
      return "Entry";

    case "exit":
      return "Exit";

    case "both":
      return "Entry & Exit";

    default:
      return eventType;
  }
}

function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  const [geofenceFilter, setGeofenceFilter] =
    useState("");

  const [vehicleFilter, setVehicleFilter] =
    useState("");

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);
  const [error, setError] = useState("");

  const [
    showConfigureModal,
    setShowConfigureModal,
  ] = useState(false);

  const [form, setForm] =
    useState(INITIAL_FORM);

  const [creating, setCreating] =
    useState(false);

  const [createError, setCreateError] =
    useState("");

  const [createSuccess, setCreateSuccess] =
    useState("");

  async function loadAlerts(filters = {}) {
    const response = await getAlerts(filters);

    setAlerts(response.alerts ?? []);
  }

  useEffect(() => {
    let ignore = false;

    async function loadPage() {
      try {
        setLoading(true);
        setError("");

        const [
          alertsResponse,
          geofenceResponse,
          vehicleResponse,
        ] = await Promise.all([
          getAlerts(),
          getGeofences(),
          getVehicles(),
        ]);

        if (ignore) {
          return;
        }

        setAlerts(alertsResponse.alerts ?? []);

        setGeofences(
          geofenceResponse.geofences ?? [],
        );

        setVehicles(
          vehicleResponse.vehicles ?? [],
        );
      } catch (requestError) {
        console.error(requestError);

        if (!ignore) {
          setError(
            "Could not load alert configurations.",
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

  const visibleAlerts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return alerts;
    }

    return alerts.filter((alert) => {
      const geofenceName =
        alert.geofence_name
          ?.toLowerCase() ?? "";

      const vehicleNumber =
        alert.vehicle_number
          ?.toLowerCase() ?? "";

      const eventType =
        alert.event_type
          ?.toLowerCase() ?? "";

      const status =
        alert.status?.toLowerCase() ?? "";

      return (
        geofenceName.includes(query) ||
        vehicleNumber.includes(query) ||
        eventType.includes(query) ||
        status.includes(query)
      );
    });
  }, [alerts, search]);

 

  async function applyFilters() {
    try {
      setFiltering(true);
      setError("");

      await loadAlerts({
        geofence_id: geofenceFilter,
        vehicle_id: vehicleFilter,
      });
    } catch (requestError) {
      console.error(requestError);

      setError(
        requestError.response?.data?.error ??
          "Could not filter alert configurations.",
      );
    } finally {
      setFiltering(false);
    }
  }

  async function clearFilters() {
    try {
      setFiltering(true);
      setError("");

      setGeofenceFilter("");
      setVehicleFilter("");
      setSearch("");

      await loadAlerts();
    } catch (requestError) {
      console.error(requestError);

      setError(
        "Could not reload alert configurations.",
      );
    } finally {
      setFiltering(false);
    }
  }

  function openConfigureModal() {
    setForm(INITIAL_FORM);
    setCreateError("");
    setCreateSuccess("");
    setShowConfigureModal(true);
  }

  function closeConfigureModal() {
    if (creating) {
      return;
    }

    setShowConfigureModal(false);
    setForm(INITIAL_FORM);
    setCreateError("");
    setCreateSuccess("");
  }

  function updateForm(event) {
    const { name, value } = event.target;

    setForm((current) => {
      if (
        name === "scope" &&
        value === "all"
      ) {
        return {
          ...current,
          scope: value,
          vehicle_id: "",
        };
      }

      return {
        ...current,
        [name]: value,
      };
    });

    setCreateError("");
    setCreateSuccess("");
  }

  async function handleCreateAlert(event) {
    event.preventDefault();

    if (!form.geofence_id) {
      setCreateError(
        "Select a geofence.",
      );

      return;
    }

    if (
      form.scope === "vehicle" &&
      !form.vehicle_id
    ) {
      setCreateError(
        "Select a vehicle.",
      );

      return;
    }

    if (
      !["entry", "exit", "both"].includes(
        form.event_type,
      )
    ) {
      setCreateError(
        "Select a valid event type.",
      );

      return;
    }

    const payload = {
      geofence_id: form.geofence_id,
      event_type: form.event_type,
    };

    if (form.scope === "vehicle") {
      payload.vehicle_id = form.vehicle_id;
    }

    try {
      setCreating(true);
      setCreateError("");
      setCreateSuccess("");

      await createAlertConfig(payload);

      await loadAlerts({
        geofence_id: geofenceFilter,
        vehicle_id: vehicleFilter,
      });

      setCreateSuccess(
        "Alert configuration created successfully.",
      );

      window.setTimeout(() => {
        setShowConfigureModal(false);
        setForm(INITIAL_FORM);
        setCreateSuccess("");
      }, 800);
    } catch (requestError) {
      console.error(requestError);

      setCreateError(
        requestError.response?.data?.error ??
          "Could not create alert configuration.",
      );
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="dashboard-state">
        Loading alert configurations...
      </div>
    );
  }

  return (
    <div className="page alerts-page">
      <header className="page-header">
        <div>
         
          <h2>Alert Configurations</h2>

          {/* <p className="page-description">
            Configure entry and exit notifications
            for monitored geofences and vehicles.
          </p> */}
        </div>

        <button
          type="button"
          className="primary-action"
          onClick={openConfigureModal}
        >
          <Plus size={16} />
          Configure Alert
        </button>
      </header>

      {error && (
        <div className="form-message error alerts-page-error">
          {error}
        </div>
      )}

      

      <section className="alerts-content-card">
        <div className="alerts-toolbar">
          <div>
            {/* <p className="card-eyebrow">
              Configuration Registry
            </p> */}

            <h3>Alert Rules</h3>
          </div>

          <span className="alerts-result-count">
            {visibleAlerts.length} shown
          </span>
        </div>

        <div className="alerts-filter-bar">
          <label className="alerts-search">
            <Search size={16} />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search configurations..."
            />
          </label>

          <select
            value={geofenceFilter}
            onChange={(event) =>
              setGeofenceFilter(
                event.target.value,
              )
            }
          >
            <option value="">
              All geofences
            </option>

            {geofences.map((geofence) => (
              <option
                key={geofence.id}
                value={geofence.id}
              >
                {geofence.name}
              </option>
            ))}
          </select>

          <select
            value={vehicleFilter}
            onChange={(event) =>
              setVehicleFilter(
                event.target.value,
              )
            }
          >
            <option value="">
              All vehicles
            </option>

            {vehicles.map((vehicle) => (
              <option
                key={vehicle.id}
                value={vehicle.id}
              >
                {vehicle.vehicle_number}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="alerts-filter-button"
            onClick={applyFilters}
            disabled={filtering}
          >
            <Filter size={15} />

            {filtering
              ? "Filtering..."
              : "Apply"}
          </button>

          <button
            type="button"
            className="alerts-clear-button"
            onClick={clearFilters}
            disabled={filtering}
          >
            Clear
          </button>
        </div>

        {visibleAlerts.length === 0 ? (
          <div className="alerts-empty-state">
            <ShieldAlert size={30} />

            <strong>
              No alert configurations found
            </strong>

            <p>
              Create a configuration or change the
              current filters.
            </p>
          </div>
        ) : (
          <div className="alerts-table-wrapper">
            <table className="alerts-table">
              <thead>
                <tr>
                  <th>Geofence</th>
                  <th>Vehicle Scope</th>
                  <th>Event</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Alert ID</th>
                </tr>
              </thead>

              <tbody>
                {visibleAlerts.map((alert) => (
                  <tr key={alert.alert_id}>
                    <td>
                      <div className="alert-table-primary">
                        <MapPinned size={15} />

                        <div>
                          <strong>
                            {alert.geofence_name}
                          </strong>

                          <small>
                            {alert.geofence_id}
                          </small>
                        </div>
                      </div>
                    </td>

                    <td>
                      {alert.vehicle_id ? (
                        <div className="alert-vehicle-scope">
                          <Truck size={14} />

                          <div>
                            <strong>
                              {alert.vehicle_number}
                            </strong>

                            <small>
                              Vehicle specific
                            </small>
                          </div>
                        </div>
                      ) : (
                        <span className="alert-global-scope">
                          All Vehicles
                        </span>
                      )}
                    </td>

                    <td>
                      <span
                        className={`alert-event-badge ${alert.event_type}`}
                      >
                        {getEventLabel(
                          alert.event_type,
                        )}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`alert-config-status ${alert.status}`}
                      >
                        {alert.status}
                      </span>
                    </td>

                    <td>
                      {formatTimestamp(
                        alert.created_at,
                      )}
                    </td>

                    <td>
                      <span className="alert-id-text">
                        {alert.alert_id}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showConfigureModal && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeConfigureModal();
            }
          }}
        >
          <section className="configure-alert-modal">
            <div className="modal-heading">
              <div>
                <p className="card-eyebrow">
                  Notification Rule
                </p>

                <h3>Configure Alert</h3>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={closeConfigureModal}
              >
                <X size={18} />
              </button>
            </div>

            <form
              className="configure-alert-form"
              onSubmit={handleCreateAlert}
            >
              <div className="alert-modal-intro">
                <span>
                  <BellRing size={22} />
                </span>

                <div>
                  <strong>
                    Create a geofence notification rule
                  </strong>

                  <p>
                    Matching vehicle entry and exit
                    transitions will generate alert
                    events.
                  </p>
                </div>
              </div>

              <label className="form-field">
                <span>Geofence</span>

                <select
                  name="geofence_id"
                  value={form.geofence_id}
                  onChange={updateForm}
                >
                  <option value="">
                    Select geofence
                  </option>

                  {geofences.map((geofence) => (
                    <option
                      key={geofence.id}
                      value={geofence.id}
                    >
                      {geofence.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="alert-form-section">
                <span className="alert-form-label">
                  Vehicle Scope
                </span>

                <div className="alert-scope-grid">
                  <label
                    className={
                      form.scope === "all"
                        ? "alert-scope-option selected"
                        : "alert-scope-option"
                    }
                  >
                    <input
                      type="radio"
                      name="scope"
                      value="all"
                      checked={
                        form.scope === "all"
                      }
                      onChange={updateForm}
                    />

                    <MapPinned size={19} />

                    <div>
                      <strong>All Vehicles</strong>

                      <small>
                        Trigger for every vehicle
                      </small>
                    </div>
                  </label>

                  <label
                    className={
                      form.scope === "vehicle"
                        ? "alert-scope-option selected"
                        : "alert-scope-option"
                    }
                  >
                    <input
                      type="radio"
                      name="scope"
                      value="vehicle"
                      checked={
                        form.scope === "vehicle"
                      }
                      onChange={updateForm}
                    />

                    <Truck size={19} />

                    <div>
                      <strong>
                        Specific Vehicle
                      </strong>

                      <small>
                        Trigger for one vehicle
                      </small>
                    </div>
                  </label>
                </div>
              </div>

              {form.scope === "vehicle" && (
                <label className="form-field">
                  <span>Vehicle</span>

                  <select
                    name="vehicle_id"
                    value={form.vehicle_id}
                    onChange={updateForm}
                  >
                    <option value="">
                      Select vehicle
                    </option>

                    {vehicles.map((vehicle) => (
                      <option
                        key={vehicle.id}
                        value={vehicle.id}
                      >
                        {vehicle.vehicle_number}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="form-field">
                <span>Event Type</span>

                <select
                  name="event_type"
                  value={form.event_type}
                  onChange={updateForm}
                >
                  <option value="entry">
                    Entry
                  </option>

                  <option value="exit">
                    Exit
                  </option>

                  <option value="both">
                    Entry & Exit
                  </option>
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
                  onClick={closeConfigureModal}
                  disabled={creating}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="modal-submit-button"
                  disabled={creating}
                >
                  <Plus size={15} />

                  {creating
                    ? "Creating..."
                    : "Create Configuration"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default AlertsPage;