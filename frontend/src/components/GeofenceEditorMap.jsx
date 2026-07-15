import { useEffect } from "react";

import {
  CircleMarker,
  MapContainer,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

import MapResizeController
  from "../components/map/MapResizeController";

const FALLBACK_CENTER = [37.779, -122.414];

const polygonStyles = [
  { color: "#7c3aed", fillColor: "#8b5cf6" },
  { color: "#2563eb", fillColor: "#3b82f6" },
  { color: "#16a34a", fillColor: "#22c55e" },
  { color: "#dc2626", fillColor: "#ef4444" },
];

function toLeafletCoordinates(coordinates = []) {
  return coordinates.map(([longitude, latitude]) => [
    latitude,
    longitude,
  ]);
}

function DrawingEvents({ enabled, onAddPoint }) {
  useMapEvents({
    click(event) {
      if (enabled) {
        onAddPoint([
          event.latlng.lat,
          event.latlng.lng,
        ]);
      }
    },
  });

  return null;
}

function MapController({ searchedLocation }) {
  const map = useMap();

  useEffect(() => {
    if (!searchedLocation) {
      return;
    }

    map.flyTo(
      [
        searchedLocation.latitude,
        searchedLocation.longitude,
      ],
      15,
      {
        duration: 1,
      },
    );
  }, [map, searchedLocation]);

  return null;
}

function GeofenceEditorMap({
  geofences,
  draftPoints,
  drawingEnabled,
  onAddPoint,
  searchedLocation,
}) {
  const firstCoordinate =
    geofences[0]?.coordinates?.[0];

  const center = firstCoordinate
    ? [firstCoordinate[1], firstCoordinate[0]]
    : FALLBACK_CENTER;

  return (
    <MapContainer
      center={center}
      zoom={13}
      scrollWheelZoom
      className={
        drawingEnabled
          ? "geofence-editor-map drawing"
          : "geofence-editor-map"
      }
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />

      <MapController
        searchedLocation={searchedLocation}
      />

      <DrawingEvents
        enabled={drawingEnabled}
        onAddPoint={onAddPoint}
      />

      {geofences.map((geofence, index) => {
        const style =
          polygonStyles[index % polygonStyles.length];

        return (
          <Polygon
            key={geofence.id}
            positions={toLeafletCoordinates(
              geofence.coordinates,
            )}
            pathOptions={{
              color: style.color,
              fillColor: style.fillColor,
              fillOpacity: 0.15,
              weight: 2,
            }}
          >
            <Popup>
              <strong>{geofence.name}</strong>
              <br />
              {geofence.category}
            </Popup>
          </Polygon>
        );
      })}

      {draftPoints.length >= 2 && (
        <Polyline
          positions={draftPoints}
          pathOptions={{
            color: "#2563eb",
            weight: 3,
            dashArray: "7 6",
          }}
        />
      )}

      {draftPoints.length >= 3 && (
        <Polygon
          positions={draftPoints}
          pathOptions={{
            color: "#2563eb",
            fillColor: "#3b82f6",
            fillOpacity: 0.15,
            weight: 2,
          }}
        />
      )}

      {draftPoints.map((point, index) => (
        <CircleMarker
          key={`${point[0]}-${point[1]}-${index}`}
          center={point}
          radius={6}
          pathOptions={{
            color: "#ffffff",
            fillColor: "#2563eb",
            fillOpacity: 1,
            weight: 3,
          }}
        >
          <Popup>Point {index + 1}</Popup>
        </CircleMarker>
      ))}

      {searchedLocation && (
        <CircleMarker
          center={[
            searchedLocation.latitude,
            searchedLocation.longitude,
          ]}
          radius={9}
          pathOptions={{
            color: "#ffffff",
            fillColor: "#dc2626",
            fillOpacity: 1,
            weight: 3,
          }}
        >
          <Popup>{searchedLocation.name}</Popup>
        </CircleMarker>
      )}
    </MapContainer>
  );
}


export default GeofenceEditorMap;