import httpClient from "./httpClient";
import { isStaticDemoMode, staticAuthStore } from "./staticStore";

export function fetchOfficeProfile() {
  if (isStaticDemoMode()) {
    return staticAuthStore.getOfficeProfile();
  }
  return httpClient.get("/profileUser").then((res) => res.data);
}

export function fetchAuthUser() {
  if (isStaticDemoMode()) {
    return staticAuthStore.getAuthUser();
  }
  return httpClient.get("/authUser").then((res) => res.data);
}

export function login(credentials) {
  if (isStaticDemoMode()) {
    return staticAuthStore.login(credentials);
  }
  return httpClient.post("/login/enter", credentials).then((res) => res.data);
}

export function updateProfile(id, payload) {
  if (isStaticDemoMode()) {
    return staticAuthStore.updateProfile(id, payload);
  }
  return httpClient.patch(`/updateProfile/${id}`, payload).then((res) => res.data);
}

export function uploadProfilePhoto(id, file) {
  if (isStaticDemoMode()) {
    return staticAuthStore.uploadProfilePhoto(id, file);
  }
  const formData = new FormData();
  formData.append("image", file);

  return httpClient
    .post(`/uploadEditProfile/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" }
    })
    .then((res) => res.data);
}

export function changePassword(id, payload) {
  if (isStaticDemoMode()) {
    return staticAuthStore.changePassword(id, payload);
  }
  return httpClient.post(`/changePassword/${id}`, payload).then((res) => res.data);
}
