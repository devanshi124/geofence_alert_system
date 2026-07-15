import { NavLink } from "react-router-dom";

import {
  Activity,
  Bell,
  CarFront,
  ChevronRight,
  CircleDot,
  LayoutDashboard,
  Map,
  MapPinned,
  Radio,
  ShieldAlert,
  Wifi,
  X,
} from "lucide-react";

import { useAlerts } from "../context/AlertContext";

const navigation = [
  {
    name: "Dashboard",
    path: "/",
    icon: LayoutDashboard,
  },
  {
    name: "Live Map",
    path: "/map",
    icon: Map,
  },
  {
    name: "Geofences",
    path: "/geofences",
    icon: MapPinned,
  },
  {
    name: "Vehicles",
    path: "/vehicles",
    icon: CarFront,
  },
  {
    name: "Alerts",
    path: "/alerts",
    icon: Bell,
  },
  {
    name: "Violations",
    path: "/violations",
    icon: ShieldAlert,
  },
];

function Sidebar({
  isOpen = false,
  onClose = () => {},
}) {
  const {
    connectionStatus,
    recentAlerts,
  } = useAlerts();

  const connectionLabel =
    connectionStatus === "connected"
      ? "Live Stream Connected"
      : connectionStatus === "connecting"
        ? "Connecting..."
        : "Stream Disconnected";

  const connectionDescription =
    connectionStatus === "connected"
      ? "Receiving real-time geofence alert events."
      : connectionStatus === "connecting"
        ? "Connecting to the real-time alert stream."
        : "Real-time alerts are currently unavailable.";

  return (
    <aside
      className={
        isOpen
          ? "sidebar open"
          : "sidebar"
      }
    >
      <div className="brand">
        <div className="brand-icon">
          <Radio size={22} />
        </div>

        <div className="brand-copy">
          <h1>GeoAlert</h1>

          {/* <p>
            Geofencing Intelligence
          </p> */}
        </div>

        <button
          type="button"
          className="sidebar-close-button"
          onClick={onClose}
          aria-label="Close navigation menu"
        >
          <X size={20} />
        </button>
      </div>
{/* 
      <section className="connection-panel">
        <div className="connection-heading">
          <div className="connection-title">
            <Wifi size={15} />

            Live Connection
          </div>

          <span
            className={`sidebar-live-dot ${connectionStatus}`}
          />
        </div>

        <strong>{connectionLabel}</strong>

        <p>{connectionDescription}</p>

        <div className="connection-event-count">
          <Activity size={13} />

          <span>
            {recentAlerts.length} recent live{" "}
            {recentAlerts.length === 1
              ? "event"
              : "events"}
          </span>
        </div>
      </section> */}

      <p className="sidebar-label">
        Workspace
      </p>

      <nav className="sidebar-navigation">
        {navigation.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              onClick={onClose}
              className={({ isActive }) =>
                isActive
                  ? "nav-link active"
                  : "nav-link"
              }
            >
              <span className="nav-link-content">
                <Icon size={18} />

                {item.name}
              </span>

              <ChevronRight
                className="nav-arrow"
                size={15}
              />
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-spacer" />

      {/* <section className="operations-card">
        <div className="operations-heading">
          <Activity size={16} />

          <span>Live Operations</span>
        </div>

        <div className="operation-row">
          <span>
            <CircleDot
              size={12}
              className="moving-icon"
            />

            Moving
          </span>

          <strong>--</strong>
        </div>

        <div className="operation-row">
          <span>
            <CircleDot
              size={12}
              className="idle-icon"
            />

            Idle
          </span>

          <strong>--</strong>
        </div>

        <div className="operation-row">
          <span>
            <CircleDot
              size={12}
              className="offline-icon"
            />

            Offline
          </span>

          <strong>--</strong>
        </div>
      </section> */}

      <div className="sidebar-footer">
        {/* <div className="footer-status">
          <span
            className={`sidebar-live-dot ${connectionStatus}`}
          />

          {connectionStatus === "connected"
            ? "Monitoring Active"
            : connectionStatus === "connecting"
              ? "Connecting"
              : "Monitoring Offline"}
        </div> */}

        <span className="footer-version">
          GeoAlert v1.0
        </span>
      </div>
    </aside>
  );
}

export default Sidebar;