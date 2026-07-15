import {
  MapContainer,
  Polygon,
  TileLayer,
} from "react-leaflet";

function convertCoordinates(
  coordinates = [],
) {
  return coordinates.map(
    ([lat, lng]) => [lat, lng],
  );
}

function MiniGeofenceMap({
  coordinates,
}) {
  if (
    !coordinates ||
    coordinates.length === 0
  ) {
    return (
      <div className="mini-map-placeholder">
        No Preview
      </div>
    );
  }

  const center =
    convertCoordinates(coordinates)[0];

  return (
    <MapContainer
      center={center}
      zoom={16}
      zoomControl={false}
      attributionControl={false}
      dragging={false}
      doubleClickZoom={false}
      scrollWheelZoom={false}
      touchZoom={false}
      keyboard={false}
      className="mini-geofence-map"
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <Polygon
        positions={convertCoordinates(
          coordinates,
        )}
        pathOptions={{
          color: "#34113F",
          fillColor: "#BEB7DF",
          fillOpacity: 0.35,
          weight: 2,
        }}
      />
    </MapContainer>
  );
}

export default MiniGeofenceMap;