import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BellRing,
  MapPinned,
  Radio,
  ShieldAlert,
} from "lucide-react";

import { getAlerts } from "../api/alertApi";
import { getGeofences } from "../api/geofenceApi";
import {
  getVehicleLocation,
  getVehicles,
} from "../api/vehicleApi";
import { getViolations } from "../api/violationApi";

import DashboardMap from "../components/DashboardMap";
import WeeklyActivityChart
  from "../components/charts/WeeklyActivityChart";
import useLiveAlerts from "../hooks/useLiveAlerts";

const DAY_LABELS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

function buildWeeklyActivity(violations) {
  const days = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);

    days.push({
      key: date.toDateString(),
      label: DAY_LABELS[date.getDay()],
      entries: 0,
      exits: 0,
    });
  }

  const dayIndexByKey = new Map(
    days.map((day, index) => [day.key, index]),
  );

  violations.forEach((violation) => {
    if (!violation.timestamp) {
      return;
    }

    const key = new Date(
      violation.timestamp,
    ).toDateString();

    const index = dayIndexByKey.get(key);

    if (index === undefined) {
      return;
    }

    if (violation.event_type === "entry") {
      days[index].entries += 1;
    } else {
      days[index].exits += 1;
    }
  });

  return days;
}

function formatTime(value) {
  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function DashboardPage() {
  const [geofences, setGeofences] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleLocations, setVehicleLocations] =
    useState([]);
  const [alertConfigs, setAlertConfigs] =
    useState([]);
  const [violations, setViolations] = useState([]);
  const [totalViolations, setTotalViolations] =
    useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const {
    alerts: liveAlerts,
    connected,
  } = useLiveAlerts();

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const [
          geofenceResponse,
          vehicleResponse,
          alertResponse,
          violationResponse,
        ] = await Promise.all([
          getGeofences(),
          getVehicles(),
          getAlerts(),
          getViolations({
            limit: 300,
          }),
        ]);

        setGeofences(
          geofenceResponse.geofences ?? [],
        );

        setVehicles(
          vehicleResponse.vehicles ?? [],
        );

        setAlertConfigs(
          alertResponse.alerts ?? [],
        );

        setViolations(
          violationResponse.violations ?? [],
        );

        setTotalViolations(
          violationResponse.total_count ?? 0,
        );

        const locationResults =
          await Promise.allSettled(
            (vehicleResponse.vehicles ?? []).map(
              (vehicle) =>
                getVehicleLocation(vehicle.id),
            ),
          );

        setVehicleLocations(
          locationResults
            .filter(
              (result) =>
                result.status === "fulfilled",
            )
            .map((result) => result.value),
        );
      } catch (requestError) {
        console.error(requestError);

        setError(
          "Could not load dashboard data from the backend.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const activeAlertCount = useMemo(
    () =>
      alertConfigs.filter(
        (alert) => alert.status === "active",
      ).length,
    [alertConfigs],
  );

  const recentViolations = violations.slice(0, 6);

  const weeklyActivity = useMemo(
    () => buildWeeklyActivity(violations),
    [violations],
  );

  const weeklyEntryTotal = weeklyActivity.reduce(
    (sum, day) => sum + day.entries,
    0,
  );

  const weeklyExitTotal = weeklyActivity.reduce(
    (sum, day) => sum + day.exits,
    0,
  );

  const combinedActivity = useMemo(() => {
    if (liveAlerts.length > 0) {
      return liveAlerts.slice(0, 6);
    }

    return violations.slice(0, 6).map(
      (violation) => ({
        event_id: violation.id,
        event_type: violation.event_type,
        timestamp: violation.timestamp,

        vehicle: {
          vehicle_number:
            violation.vehicle_number,
        },

        geofence: {
          geofence_name:
            violation.geofence_name,
        },
      }),
    );
  }, [liveAlerts, violations]);

  if (loading) {
    return (
      <div className="dashboard-state">
        Loading operations dashboard...
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
    <div className="page dashboard-page">
      <header className="page-header dashboard-header">
        <div>
          <p className="page-eyebrow">
            Operations Center
          </p>

          <h2>Dashboard</h2>

          <p className="page-description">
            Real-time overview of fleet movement
            and geofence activity.
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
            ? "Live Monitoring"
            : "Reconnecting"}
        </div>
      </header>

      <section className="kpi-strip">
        <article className="kpi-card">
          <div className="kpi-icon geofence">
            <MapPinned size={18} />
          </div>

          <div>
            <p>Geofences</p>
            <strong>{geofences.length}</strong>
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-icon alert">
            <BellRing size={18} />
          </div>

          <div>
            <p>Active Alerts</p>
            <strong>{activeAlertCount}</strong>
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-icon violation">
            <ShieldAlert size={18} />
          </div>

          <div>
            <p>Violations</p>
            <strong>{totalViolations}</strong>
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-icon live">
            <Radio size={18} />
          </div>

          <div>
            <p>Live Events</p>
            <strong>{liveAlerts.length}</strong>
          </div>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="dashboard-card map-card">
          <div className="card-heading">
            <div>
              <p className="card-eyebrow">
                Spatial Overview
              </p>

              <h3>Live Map Overview</h3>
            </div>

            <MapPinned size={20} />
          </div>

          <DashboardMap
            geofences={geofences}
            vehicleLocations={vehicleLocations}
          />

          <div className="map-legend">
            <span>
              <i className="legend-dot moving" />
              Vehicles {vehicles.length}
            </span>

            <span>
              <i className="legend-dot geofence" />
              Geofences {geofences.length}
            </span>

            <span>
              <i className="legend-dot alert" />
              Live Alerts {liveAlerts.length}
            </span>
          </div>
        </article>

        <article className="dashboard-card activity-card">
          <div className="card-heading">
            <div>
              <p className="card-eyebrow">
                Streaming Events
              </p>

              <h3>Live Alert Feed</h3>
            </div>

            <Radio size={20} />
          </div>

          <div className="activity-list">
            {combinedActivity.length === 0 ? (
              <div className="empty-state">
                Waiting for activity...
              </div>
            ) : (
              combinedActivity.map((alert) => (
                <div
                  className="activity-row"
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
                      {alert.vehicle.vehicle_number}
                    </strong>

                    <p>
                      {alert.event_type === "entry"
                        ? "entered"
                        : "exited"}{" "}
                      {alert.geofence.geofence_name}
                    </p>
                  </div>

                  <time>
                    {formatTime(alert.timestamp)}
                  </time>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="dashboard-card chart-card">
          <div className="card-heading">
            <div>
              <p className="card-eyebrow">
                Last 7 Days
              </p>

              <h3>Geofence Activity Trend</h3>
            </div>

            <Activity size={20} />
          </div>

          <div className="trend-chart-legend">
            <span>
              <i className="legend-dot moving" />
              Entries
              <strong>{weeklyEntryTotal}</strong>
            </span>

            <span>
              <i className="legend-dot alert" />
              Exits
              <strong>{weeklyExitTotal}</strong>
            </span>
          </div>

          <WeeklyActivityChart data={weeklyActivity} />
        </article>
      </section>
    </div>
  );
}

export default DashboardPage;