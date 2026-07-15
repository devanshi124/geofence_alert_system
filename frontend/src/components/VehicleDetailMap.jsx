import { useEffect } from "react";

import {
  CircleMarker,
  MapContainer,
  Polygon,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

const FALLBACK_CENTER = [37.779, -122.414];

function toLeafletCoordinates(coordinates = []) {
  return coordinates.map(([longitude, latitude]) => [
    latitude,
    longitude,
  ]);
}

function MapController({ vehicleLocation }) {
  const map = useMap();

  useEffect(() => {
    if (!vehicleLocation?.current_location) {
      return;
    }

    map.flyTo(
      [
        vehicleLocation.current_location.latitude,
        vehicleLocation.current_location.longitude,
      ],
      15,
      {
        duration: 0.8,
      },
    );
  }, [map, vehicleLocation]);

  return null;
}

function VehicleDetailMap({
  vehicleLocation,
  geofences,
}) {
  const center = vehicleLocation?.current_location
    ? [
        vehicleLocation.current_location.latitude,
        vehicleLocation.current_location.longitude,
      ]
    : FALLBACK_CENTER;

  return (
    <MapContainer
      center={center}
      zoom={14}
      scrollWheelZoom
      className="vehicle-detail-map"
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />

      <MapController
        vehicleLocation={vehicleLocation}
      />

      {geofences.map((geofence) => (
        <Polygon
          key={geofence.id}
          positions={toLeafletCoordinates(
            geofence.coordinates,
          )}
          pathOptions={{
            color: "#7c3aed",
            fillColor: "#8b5cf6",
            fillOpacity: 0.13,
            weight: 2,
          }}
        >
          <Popup>
            <strong>{geofence.name}</strong>
            <br />
            {geofence.category}
          </Popup>
        </Polygon>
      ))}

      {vehicleLocation?.current_location && (
        <CircleMarker
          center={[
            vehicleLocation.current_location.latitude,
            vehicleLocation.current_location.longitude,
          ]}
          radius={10}
          pathOptions={{
            color: "#ffffff",
            fillColor: "#2563eb",
            fillOpacity: 1,
            weight: 3,
          }}
        >
          <Popup>
            <strong>
              {vehicleLocation.vehicle_number}
            </strong>
          </Popup>
        </CircleMarker>
      )}
    </MapContainer>
  );
}

export default VehicleDetailMap;