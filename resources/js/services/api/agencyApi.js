import httpClient from "./httpClient";
import { isStaticDemoMode, staticAgencyStore } from "./staticStore";

export function fetchAll() {
  if (isStaticDemoMode()) {
    return staticAgencyStore.list();
  }
  return httpClient.get("/api/agency").then((res) => res.data);
}

export function create(agency) {
  if (isStaticDemoMode()) {
    return staticAgencyStore.create(agency);
  }
  return httpClient.post("/store/agency", { agency }).then((res) => res.data);
}

export function remove(agency) {
  if (isStaticDemoMode()) {
    return staticAgencyStore.remove(agency);
  }
  return httpClient.delete(`/destroyAgent/${encodeURIComponent(agency)}`).then((res) => res.data);
}
