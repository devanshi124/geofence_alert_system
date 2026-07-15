import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const AlertContext = createContext(null);

const WS_URL =
  import.meta.env.VITE_WS_URL ;

const MAX_RECENT_ALERTS = 50;
const RECONNECT_DELAY = 3000;

export function AlertProvider({ children }) {
  const [recentAlerts, setRecentAlerts] =
    useState([]);

  const [connectionStatus, setConnectionStatus] =
    useState("connecting");

  const [toastAlerts, setToastAlerts] =
    useState([]);

  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const mountedRef = useRef(false);

  const dismissToast = useCallback((eventID) => {
    setToastAlerts((current) =>
      current.filter(
        (alert) => alert.event_id !== eventID,
      ),
    );
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) {
      return;
    }

    if (
      socketRef.current &&
      (
        socketRef.current.readyState ===
          WebSocket.OPEN ||
        socketRef.current.readyState ===
          WebSocket.CONNECTING
      )
    ) {
      return;
    }

    setConnectionStatus("connecting");

    const socket = new WebSocket(WS_URL);

    socketRef.current = socket;

    socket.onopen = () => {
      if (!mountedRef.current) {
        return;
      }

      setConnectionStatus("connected");
    };

    socket.onmessage = (event) => {
      if (!mountedRef.current) {
        return;
      }

      try {
        const alert = JSON.parse(event.data);

        if (!alert.event_id) {
          return;
        }

        setRecentAlerts((current) => {
          const withoutDuplicate =
            current.filter(
              (item) =>
                item.event_id !== alert.event_id,
            );

          return [
            alert,
            ...withoutDuplicate,
          ].slice(0, MAX_RECENT_ALERTS);
        });

        setToastAlerts((current) => {
          const withoutDuplicate =
            current.filter(
              (item) =>
                item.event_id !== alert.event_id,
            );

          return [
            ...withoutDuplicate,
            alert,
          ].slice(-4);
        });
      } catch (error) {
        console.error(
          "Invalid WebSocket message:",
          error,
        );
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    socket.onclose = () => {
      if (!mountedRef.current) {
        return;
      }

      socketRef.current = null;

      setConnectionStatus("disconnected");

      window.clearTimeout(
        reconnectTimerRef.current,
      );

      reconnectTimerRef.current =
        window.setTimeout(() => {
          connect();
        }, RECONNECT_DELAY);
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    connect();

    return () => {
      mountedRef.current = false;

      window.clearTimeout(
        reconnectTimerRef.current,
      );

      const socket = socketRef.current;

      socketRef.current = null;

      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [connect]);

  const value = {
    recentAlerts,
    connectionStatus,
    toastAlerts,
    dismissToast,
  };

  return (
    <AlertContext.Provider value={value}>
      {children}

      <AlertToastContainer />
    </AlertContext.Provider>
  );
}

export function useAlerts() {
  const context = useContext(AlertContext);

  if (!context) {
    throw new Error(
      "useAlerts must be used inside AlertProvider",
    );
  }

  return context;
}

function AlertToastContainer() {
  const {
    toastAlerts,
    dismissToast,
  } = useAlerts();

  useEffect(() => {
    if (toastAlerts.length === 0) {
      return;
    }

    const timers = toastAlerts.map((alert) =>
      window.setTimeout(() => {
        dismissToast(alert.event_id);
      }, 6000),
    );

    return () => {
      timers.forEach((timer) =>
        window.clearTimeout(timer),
      );
    };
  }, [toastAlerts, dismissToast]);

  return (
    <div className="live-alert-toast-container">
      {toastAlerts.map((alert) => (
        <article
          key={alert.event_id}
          className={`live-alert-toast ${alert.event_type}`}
        >
          <span className="live-alert-toast-indicator" />

          <div className="live-alert-toast-content">
            <div className="live-alert-toast-heading">
              <strong>
                {alert.event_type === "entry"
                  ? "Vehicle Entered Geofence"
                  : "Vehicle Exited Geofence"}
              </strong>

              <button
                type="button"
                onClick={() =>
                  dismissToast(alert.event_id)
                }
              >
                ×
              </button>
            </div>

            <p>
              <b>
                {alert.vehicle?.vehicle_number ??
                  "Unknown vehicle"}
              </b>
              {" "}
              {alert.event_type === "entry"
                ? "entered"
                : "exited"}
              {" "}
              <b>
                {alert.geofence?.geofence_name ??
                  "Unknown geofence"}
              </b>
            </p>

            <small>
              {alert.timestamp
                ? new Date(
                    alert.timestamp,
                  ).toLocaleString()
                : "--"}
            </small>
          </div>
        </article>
      ))}
    </div>
  );
}