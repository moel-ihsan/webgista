import httpClient from "./httpClient";

export function fetchAll() {
  return httpClient.get("/api/setting").then((res) => res.data);
}

export function create(payload) {
  return httpClient.post("/store/mapSetting", payload).then((res) => res.data);
}

export function update(id, payload) {
  return httpClient.patch(`/updateSetting/${id}`, payload).then((res) => res.data);
}
