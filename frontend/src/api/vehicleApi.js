import apiClient from "./client";

export async function getVehicles() {
  const response = await apiClient.get("/vehicles");
  return response.data;
}

export async function createVehicle(payload) {
  const response = await apiClient.post(
    "/vehicles",
    payload,
  );

  return response.data;
}

export async function getVehicleLocation(vehicleId) {
  const response = await apiClient.get(
    `/vehicles/location/${vehicleId}`,
  );

  return response.data;
}

export async function updateVehicleLocation(payload) {
  const response = await apiClient.post(
    "/vehicles/location",
    payload,
  );

  return response.data;
}