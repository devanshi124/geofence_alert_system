import { useEffect } from "react";

import {
  MapContainer,
  Polygon,
  TileLayer,
  useMap,
} from "react-leaflet";

const THUMB_STYLES = [
  { color: "#7c3aed", fillColor: "#8b5cf6" },
  { color: "#2563eb", fillColor: "#3b82f6" },
  { color: "#16a34a", fillColor: "#22c55e" },
  { color: "#dc2626", fillColor: "#ef4444" },
  { color: "#d97706", fillColor: "#f59e0b" },
  { color: "#0891b2", fillColor: "#22d3ee" },
];

function toLeafletCoordinates(coordinates = []) {
  return coordinates.map(([longitude, latitude]) => [
    latitude,
    longitude,
  ]);
}

function FitToPolygon({ positions }) {
  const map = useMap();

  useEffect(() => {
    if (positions.length < 3) {
      return;
    }

    try {
      map.fitBounds(positions, { padding: [16, 16] });
    } catch {
      // Invalid bounds (e.g. all points identical) - keep default view.
    }
  }, [map, positions]);

  return null;
}

function GeofenceThumbnailMap({ geofence, colorIndex = 0 }) {
  const positions = toLeafletCoordinates(
    geofence.coordinates ?? [],
  );

  const style =
    THUMB_STYLES[colorIndex % THUMB_STYLES.length];

  if (positions.length < 3) {
    return (
      <div className="geofence-thumb-empty">
        No shape data
      </div>
    );
  }

  return (
    <MapContainer
      center={positions[0]}
      zoom={13}
      className="geofence-thumb-map"
      zoomControl={false}
      scrollWheelZoom={false}
      dragging={false}
      doubleClickZoom={false}
      boxZoom={false}
      keyboard={false}
      touchZoom={false}
      attributionControl={false}
    >
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />

      <FitToPolygon positions={positions} />

      <Polygon
        positions={positions}
        pathOptions={{
          color: style.color,
          fillColor: style.fillColor,
          fillOpacity: 0.35,
          weight: 2,
        }}
      />
    </MapContainer>
  );
}

export default GeofenceThumbnailMap;
