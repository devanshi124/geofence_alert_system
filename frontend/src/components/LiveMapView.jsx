import {
  CircleMarker,
  MapContainer,
  Polygon,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";

import { useEffect } from "react";

const FALLBACK_CENTER = [37.779, -122.414];

const polygonStyles = [
  { color: "#7c3aed", fillColor: "#8b5cf6" },
  { color: "#2563eb", fillColor: "#3b82f6" },
  { color: "#16a34a", fillColor: "#22c55e" },
  { color: "#dc2626", fillColor: "#ef4444" },
];

function normalizeCoordinates(coordinates = []) {
  return coordinates.map(([longitude, latitude]) => [
    latitude,
    longitude,
  ]);
}

function MapController({
  selectedVehicle,
  geofences,
  vehicleLocations,
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedVehicle?.current_location) {
      map.flyTo(
        [
          selectedVehicle.current_location.latitude,
          selectedVehicle.current_location.longitude,
        ],
        15,
        {
          duration: 0.8,
        },
      );

      return;
    }

    const points = [];

    vehicleLocations.forEach((vehicle) => {
      if (vehicle.current_location) {
        points.push([
          vehicle.current_location.latitude,
          vehicle.current_location.longitude,
        ]);
      }
    });

    geofences.forEach((geofence) => {
      normalizeCoordinates(
        geofence.coordinates,
      ).forEach((point) => points.push(point));
    });

    if (points.length > 0) {
      map.fitBounds(points, {
        padding: [35, 35],
        maxZoom: 14,
      });
    }
  }, [
    map,
    selectedVehicle,
    geofences,
    vehicleLocations,
  ]);

  return null;
}

function LiveMapView({
  geofences,
  vehicleLocations,
  selectedVehicle,
  onSelectVehicle,
}) {
  return (
    <MapContainer
      center={FALLBACK_CENTER}
      zoom={13}
      scrollWheelZoom
      className="live-map"
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapController
        selectedVehicle={selectedVehicle}
        geofences={geofences}
        vehicleLocations={vehicleLocations}
      />

      {geofences.map((geofence, index) => {
        const style =
          polygonStyles[index % polygonStyles.length];

        return (
          <Polygon
            key={geofence.id}
            positions={normalizeCoordinates(
              geofence.coordinates,
            )}
            pathOptions={{
              color: style.color,
              fillColor: style.fillColor,
              fillOpacity: 0.16,
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

      {vehicleLocations.map((vehicle) => {
        const isSelected =
          selectedVehicle?.vehicle_id ===
          vehicle.vehicle_id;

        return (
          <CircleMarker
            key={vehicle.vehicle_id}
            center={[
              vehicle.current_location.latitude,
              vehicle.current_location.longitude,
            ]}
            radius={isSelected ? 11 : 8}
            pathOptions={{
              color: "#ffffff",
              fillColor: isSelected
                ? "#2563eb"
                : "#101828",
              fillOpacity: 1,
              weight: 3,
            }}
            eventHandlers={{
              click: () => onSelectVehicle(vehicle),
            }}
          >
            <Tooltip
              direction="top"
              offset={[0, -8]}
            >
              {vehicle.vehicle_number}
            </Tooltip>

            <Popup>
              <strong>
                {vehicle.vehicle_number}
              </strong>

              <br />

              {vehicle.current_geofences.length > 0
                ? vehicle.current_geofences
                    .map(
                      (geofence) =>
                        geofence.geofence_name,
                    )
                    .join(", ")
                : "Outside all geofences"}
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}

export default LiveMapView;