import httpClient from "./httpClient";
import { isStaticDemoMode, staticMapSettingStore } from "./staticStore";

export function fetchAll() {
  if (isStaticDemoMode()) {
    return staticMapSettingStore.list();
  }
  return httpClient.get("/api/setting").then((res) => res.data);
}

export function create(payload) {
  if (isStaticDemoMode()) {
    return staticMapSettingStore.create(payload);
  }
  return httpClient.post("/store/mapSetting", payload).then((res) => res.data);
}

export function update(id, payload) {
  if (isStaticDemoMode()) {
    return staticMapSettingStore.update(id, payload);
  }
  return httpClient.patch(`/updateSetting/${id}`, payload).then((res) => res.data);
}
