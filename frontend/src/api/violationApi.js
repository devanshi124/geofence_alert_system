import apiClient from "./client";

export async function getViolations(filters = {}) {
  const params = {};

  if (filters.vehicle_id) {
    params.vehicle_id = filters.vehicle_id;
  }

  if (filters.geofence_id) {
    params.geofence_id = filters.geofence_id;
  }

  if (filters.start_date) {
    params.start_date = filters.start_date;
  }

  if (filters.end_date) {
    params.end_date = filters.end_date;
  }

  if (filters.limit) {
    params.limit = filters.limit;
  }

  const response = await apiClient.get(
    "/violations/history",
    {
      params,
    },
  );

  return response.data;
}