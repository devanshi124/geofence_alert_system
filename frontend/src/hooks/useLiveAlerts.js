import { useEffect, useRef, useState } from "react";

const MAX_ALERTS = 20;
const RECONNECT_DELAY = 3000;

export default function useLiveAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);

  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  useEffect(() => {
    let disposed = false;

    function connect() {
      if (disposed) {
        return;
      }

      const socket = new WebSocket(
        import.meta.env.VITE_WS_URL,
      );

      socketRef.current = socket;

      socket.onopen = () => {
        if (!disposed) {
          setConnected(true);
        }
      };

      socket.onmessage = (event) => {
        try {
          const alert = JSON.parse(event.data);

          setAlerts((current) => [
            alert,
            ...current,
          ].slice(0, MAX_ALERTS));
        } catch (error) {
          console.error(
            "Invalid WebSocket message:",
            error,
          );
        }
      };

      socket.onerror = () => {
        socket.close();
      };

      socket.onclose = () => {
        if (disposed) {
          return;
        }

        setConnected(false);

        reconnectTimerRef.current = setTimeout(
          connect,
          RECONNECT_DELAY,
        );
      };
    }

    connect();

    return () => {
      disposed = true;

      clearTimeout(reconnectTimerRef.current);

      socketRef.current?.close();
    };
  }, []);

  return {
    alerts,
    connected,
  };
}