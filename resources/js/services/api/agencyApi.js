import httpClient from "./httpClient";

export function fetchAll() {
  return httpClient.get("/api/agency").then((res) => res.data);
}

export function create(agency) {
  return httpClient.post("/store/agency", { agency }).then((res) => res.data);
}

export function remove(agency) {
  return httpClient.delete(`/destroyAgent/${encodeURIComponent(agency)}`).then((res) => res.data);
}
