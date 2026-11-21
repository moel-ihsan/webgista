import httpClient from "./httpClient";

export function fetchAll() {
  return httpClient.get("/api/table").then((res) => res.data);
}

export function create(payload) {
  return httpClient.post("/store", payload).then((res) => res.data);
}

export function update(id, payload) {
  return httpClient.patch(`/update/${id}`, payload).then((res) => res.data);
}

export function remove(id) {
  return httpClient.delete(`/destroy/${id}`).then((res) => res.data);
}

export function uploadTempImage(file) {
  const formData = new FormData();
  formData.append("image", file);

  return httpClient
    .post("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    })
    .then((res) => res.data);
}

export function uploadEditImage(id, file) {
  const formData = new FormData();
  formData.append("image", file);

  return httpClient
    .post(`/uploadEdit/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" }
    })
    .then((res) => res.data);
}

export function updateTrafficCondition(id, keterangan) {
  return httpClient.post(`/update/keterangan/${id}`, { keterangan }).then((res) => res.data);
}

export function updateRoi(id, roiPayload) {
  return httpClient.patch(`/update/roi/${id}`, roiPayload).then((res) => res.data);
}
