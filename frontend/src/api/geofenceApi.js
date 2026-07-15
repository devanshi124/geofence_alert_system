import apiClient from "./client";

export async function getGeofences() {
  const response = await apiClient.get("/geofences");
  return response.data;
}

export async function createGeofence(payload) {
  const response = await apiClient.post("/geofences", payload);
  return response.data;
}