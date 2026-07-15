import {
  CircleMarker,
  MapContainer,
  Polygon,
  Popup,
  TileLayer,
} from "react-leaflet";

import MapResizeController
  from "../components/map/MapResizeController";

const FALLBACK_CENTER = [37.779, -122.414];

const polygonStyles = [
  {
    color: "#7c3aed",
    fillColor: "#8b5cf6",
  },
  {
    color: "#dc2626",
    fillColor: "#ef4444",
  },
  {
    color: "#2563eb",
    fillColor: "#3b82f6",
  },
  {
    color: "#16a34a",
    fillColor: "#22c55e",
  },
];

function normalizeCoordinates(coordinates = []) {
  return coordinates.map(
    ([longitude, latitude]) => [
      latitude,
      longitude,
    ],
  );
}

function DashboardMap({
  geofences = [],
  vehicleLocations = [],
}) {
  const firstVehicle = vehicleLocations.find(
    (vehicle) =>
      vehicle.current_location?.latitude != null &&
      vehicle.current_location?.longitude != null,
  );

  const firstGeofence =
    geofences[0]?.coordinates?.[0];

  const center = firstVehicle
    ? [
        firstVehicle.current_location.latitude,
        firstVehicle.current_location.longitude,
      ]
    : firstGeofence
      ? [firstGeofence[1], firstGeofence[0]]
      : FALLBACK_CENTER;

  return (
    <MapContainer
      center={center}
      zoom={13}
      scrollWheelZoom
      className="dashboard-map"
    >
      {/* Fix Leaflet map resizing */}
      <MapResizeController />

      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />

      {geofences.map((geofence, index) => {
        const style =
          polygonStyles[
            index % polygonStyles.length
          ];

        return (
          <Polygon
            key={geofence.id}
            positions={normalizeCoordinates(
              geofence.coordinates,
            )}
            pathOptions={{
              color: style.color,
              fillColor: style.fillColor,
              fillOpacity: 0.18,
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
        const location =
          vehicle.current_location;

        if (
          location?.latitude == null ||
          location?.longitude == null
        ) {
          return null;
        }

        return (
          <CircleMarker
            key={vehicle.vehicle_id}
            center={[
              location.latitude,
              location.longitude,
            ]}
            radius={8}
            pathOptions={{
              color: "#ffffff",
              fillColor: "#101828",
              fillOpacity: 1,
              weight: 3,
            }}
          >
            <Popup>
              <strong>
                {vehicle.vehicle_number}
              </strong>

              <br />

              {vehicle.current_geofences?.length >
              0
                ? vehicle.current_geofences
                    .map(
                      (item) =>
                        item.geofence_name,
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

export default DashboardMap;