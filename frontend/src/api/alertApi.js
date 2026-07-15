import apiClient from "./client";

export async function getAlerts(filters = {}) {
  const params = {};

  if (filters.geofence_id) {
    params.geofence_id = filters.geofence_id;
  }

  if (filters.vehicle_id) {
    params.vehicle_id = filters.vehicle_id;
  }

  const response = await apiClient.get("/alerts", {
    params,
  });

  return response.data;
}

export async function createAlertConfig(payload) {
  const response = await apiClient.post(
    "/alerts/configure",
    payload,
  );

  return response.data;
}