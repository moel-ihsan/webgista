import httpClient from "./httpClient";

export function fetchOfficeProfile() {
  return httpClient.get("/profileUser").then((res) => res.data);
}

export function fetchAuthUser() {
  return httpClient.get("/authUser").then((res) => res.data);
}

export function login(credentials) {
  return httpClient.post("/login/enter", credentials).then((res) => res.data);
}

export function updateProfile(id, payload) {
  return httpClient.patch(`/updateProfile/${id}`, payload).then((res) => res.data);
}

export function uploadProfilePhoto(id, file) {
  const formData = new FormData();
  formData.append("image", file);

  return httpClient
    .post(`/uploadEditProfile/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" }
    })
    .then((res) => res.data);
}

export function changePassword(id, payload) {
  return httpClient.post(`/changePassword/${id}`, payload).then((res) => res.data);
}
