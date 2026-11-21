import { fetchAuthUser } from "./authApi";
import { fetchAll as fetchAllCctv } from "./cctvApi";
import { fetchAll as fetchAllMapSettings } from "./mapSettingApi";
import { isStaticDemoMode } from "./staticStore";

export function extractUrlId() {
  if (typeof window === "undefined") {
    return null;
  }
  const match = window.location.pathname.match(/\/(\d+)\/?$/);
  return match ? Number(match[1]) : null;
}

export async function ensureStaticAdmin() {
  if (!isStaticDemoMode()) {
    return { allowed: true, user: null };
  }
  const auth = await fetchAuthUser();
  if (!auth || !auth.isAuth || !auth.user || auth.user.role !== "admin") {
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
    return { allowed: false, user: null };
  }
  return { allowed: true, user: auth.user };
}

export async function resolveStaticCctv() {
  const rows = await fetchAllCctv();
  const id = extractUrlId();
  if (id !== null) {
    const found = rows.find((item) => Number(item.id) === id);
    if (found) {
      return found;
    }
  }
  return rows[0] || {};
}

export async function resolveStaticMapSetting() {
  const rows = await fetchAllMapSettings();
  const id = extractUrlId();
  if (id !== null) {
    const found = rows.find((item) => Number(item.id) === id);
    if (found) {
      return found;
    }
  }
  return rows[0] || {};
}
