import httpClient from "./httpClient";
import { isStaticDemoMode, staticCctvStore } from "./staticStore";

export function fetchAll() {
  if (isStaticDemoMode()) {
    return staticCctvStore.list();
  }
  return httpClient.get("/api/table").then((res) => res.data);
}

export function create(payload) {
  if (isStaticDemoMode()) {
    return staticCctvStore.create(payload);
  }
  return httpClient.post("/store", payload).then((res) => res.data);
}

export function update(id, payload) {
  if (isStaticDemoMode()) {
    return staticCctvStore.update(id, payload);
  }
  return httpClient.patch(`/update/${id}`, payload).then((res) => res.data);
}

export function remove(id) {
  if (isStaticDemoMode()) {
    return staticCctvStore.remove(id);
  }
  return httpClient.delete(`/destroy/${id}`).then((res) => res.data);
}

export function uploadTempImage(file) {
  if (isStaticDemoMode()) {
    return staticCctvStore.uploadTempImage(file);
  }
  const formData = new FormData();
  formData.append("image", file);

  return httpClient
    .post("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    })
    .then((res) => res.data);
}

export function uploadEditImage(id, file) {
  if (isStaticDemoMode()) {
    return staticCctvStore.uploadEditImage(id, file);
  }
  const formData = new FormData();
  formData.append("image", file);

  return httpClient
    .post(`/uploadEdit/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" }
    })
    .then((res) => res.data);
}

export function updateTrafficCondition(id, keterangan) {
  if (isStaticDemoMode()) {
    return staticCctvStore.updateTrafficCondition(id, keterangan);
  }
  return httpClient.post(`/api/traffic/${id}`, { keterangan }).then((res) => res.data);
}

export function updateRoi(id, payload) {
  if (isStaticDemoMode()) {
    return staticCctvStore.updateRoi(id, payload);
  }
  return httpClient.patch(`/update/roi/${id}`, payload).then((res) => res.data);
}
