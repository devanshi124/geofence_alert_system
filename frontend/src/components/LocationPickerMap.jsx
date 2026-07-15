import { useEffect } from "react";

import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

const DEFAULT_CENTER = [21.1702, 72.8311];

function MapClickHandler({ onSelect }) {
  useMapEvents({
    click(event) {
      onSelect({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    },
  });

  return null;
}

function MapController({ selectedLocation }) {
  const map = useMap();

  useEffect(() => {
    if (!selectedLocation) {
      return;
    }

    map.flyTo(
      [
        selectedLocation.latitude,
        selectedLocation.longitude,
      ],
      15,
      {
        duration: 0.7,
      },
    );
  }, [map, selectedLocation]);

  return null;
}

function LocationPickerMap({
  selectedLocation,
  onSelect,
}) {
  const center = selectedLocation
    ? [
        selectedLocation.latitude,
        selectedLocation.longitude,
      ]
    : DEFAULT_CENTER;

  return (
    <MapContainer
      center={center}
      zoom={13}
      scrollWheelZoom
      className="location-picker-map"
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />

      <MapClickHandler onSelect={onSelect} />

      <MapController
        selectedLocation={selectedLocation}
      />

      {selectedLocation && (
        <CircleMarker
          center={[
            selectedLocation.latitude,
            selectedLocation.longitude,
          ]}
          radius={9}
          pathOptions={{
            color: "#ffffff",
            fillColor: "#2563eb",
            fillOpacity: 1,
            weight: 3,
          }}
        >
          <Popup>Selected Location</Popup>
        </CircleMarker>
      )}
    </MapContainer>
  );
}

export default LocationPickerMap;