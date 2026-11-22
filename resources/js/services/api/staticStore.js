import {
  STATIC_ADMIN_USER,
  STATIC_AGENCIES,
  STATIC_CCTV_POINTS,
  STATIC_MAP_SETTINGS
} from "../../data/staticSeed";

const KEYS = {
  cctvs: "webgista_static_cctvs_v1",
  settings: "webgista_static_settings_v1",
  agencies: "webgista_static_agencies_v1",
  user: "webgista_static_user_v1",
  password: "webgista_static_pw_v1",
  auth: "webgista_static_auth_v1",
  tempUpload: "webgista_static_tmp_upload_v1"
};

const memoryFallback = {};

export function isStaticDemoMode() {
  if (typeof window !== "undefined" && window.__WEBGISTA_STATIC_MODE__ === true) {
    return true;
  }
  return process.env.MIX_STATIC_DEMO === "true";
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJson(key, fallbackValue) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        return JSON.parse(raw);
      }
    }
  } catch (_err) {
    // Fallback to in-memory storage if localStorage is restricted
  }

  if (Object.prototype.hasOwnProperty.call(memoryFallback, key)) {
    return clone(memoryFallback[key]);
  }

  return clone(fallbackValue);
}

function writeJson(key, value) {
  memoryFallback[key] = clone(value);
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (_err) {
    // Ignore quota/private-mode storage restrictions
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve) => {
    if (typeof FileReader === "undefined" || !file) {
      resolve("/assets/tf1.jpg");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : "/assets/tf1.jpg");
    reader.onerror = () => resolve("/assets/tf1.jpg");
    reader.readAsDataURL(file);
  });
}

function getDemoPass() {
  return readJson(KEYS.password, "password");
}

export const staticCctvStore = {
  list() {
    return Promise.resolve(readJson(KEYS.cctvs, STATIC_CCTV_POINTS));
  },
  getById(id) {
    const targetId = Number(id);
    const rows = readJson(KEYS.cctvs, STATIC_CCTV_POINTS);
    const found = rows.find((item) => Number(item.id) === targetId) || null;
    return Promise.resolve(found);
  },
  create(payload) {
    const rows = readJson(KEYS.cctvs, STATIC_CCTV_POINTS);
    const maxId = rows.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0);
    const category = payload.category || "Regular";
    const url = payload.url ? String(payload.url).trim() : null;
    const tempImage = readJson(KEYS.tempUpload, null);
    writeJson(KEYS.tempUpload, null);

    const record = {
      id: maxId + 1,
      name: payload.name,
      category,
      address: payload.address,
      lattitude: String(payload.lattitude),
      longitude: String(payload.longitude),
      agency: payload.agency,
      url,
      path_image: tempImage || "tf1.jpg",
      keterangan: category === "Analytic" && url ? "Great" : "No Data",
      roi_polygon: null,
      updated_at: new Date().toISOString()
    };

    const next = [record, ...rows];
    writeJson(KEYS.cctvs, next);
    return Promise.resolve({ data: record });
  },
  update(id, payload) {
    const targetId = Number(id);
    const rows = readJson(KEYS.cctvs, STATIC_CCTV_POINTS);
    const idx = rows.findIndex((item) => Number(item.id) === targetId);
    if (idx === -1) {
      return Promise.reject(new Error("CCTV not found"));
    }

    const existing = rows[idx];
    const nextCategory = payload.category || existing.category;
    const nextUrl = payload.url ? String(payload.url).trim() : null;
    const nextKeterangan =
      nextCategory !== "Analytic" || !nextUrl
        ? "No Data"
        : existing.keterangan && existing.keterangan !== "No Data"
          ? existing.keterangan
          : "Great";

    const updated = {
      ...existing,
      ...payload,
      category: nextCategory,
      url: nextUrl,
      lattitude: String(payload.lattitude ?? existing.lattitude),
      longitude: String(payload.longitude ?? existing.longitude),
      keterangan: nextKeterangan,
      updated_at: new Date().toISOString()
    };

    rows[idx] = updated;
    writeJson(KEYS.cctvs, rows);
    return Promise.resolve({ data: updated });
  },
  remove(id) {
    const targetId = Number(id);
    const rows = readJson(KEYS.cctvs, STATIC_CCTV_POINTS);
    const next = rows.filter((item) => Number(item.id) !== targetId);
    writeJson(KEYS.cctvs, next);
    return Promise.resolve({ message: "Deleted" });
  },
  uploadTempImage(file) {
    return fileToDataUrl(file).then((dataUrl) => {
      writeJson(KEYS.tempUpload, dataUrl);
      return { path: dataUrl };
    });
  },
  uploadEditImage(id, file) {
    const targetId = Number(id);
    return fileToDataUrl(file).then((dataUrl) => {
      const rows = readJson(KEYS.cctvs, STATIC_CCTV_POINTS);
      const idx = rows.findIndex((item) => Number(item.id) === targetId);
      if (idx !== -1) {
        rows[idx] = {
          ...rows[idx],
          path_image: dataUrl,
          updated_at: new Date().toISOString()
        };
        writeJson(KEYS.cctvs, rows);
      }
      return { path: dataUrl };
    });
  },
  updateTrafficCondition(id, keterangan) {
    const targetId = Number(id);
    const rows = readJson(KEYS.cctvs, STATIC_CCTV_POINTS);
    const idx = rows.findIndex((item) => Number(item.id) === targetId);
    if (idx === -1) {
      return Promise.reject(new Error("CCTV not found"));
    }
    rows[idx] = {
      ...rows[idx],
      keterangan,
      updated_at: new Date().toISOString()
    };
    writeJson(KEYS.cctvs, rows);
    return Promise.resolve({ message: "success", keterangan });
  },
  updateRoi(id, payload) {
    const targetId = Number(id);
    const rows = readJson(KEYS.cctvs, STATIC_CCTV_POINTS);
    const idx = rows.findIndex((item) => Number(item.id) === targetId);
    if (idx === -1) {
      return Promise.reject(new Error("CCTV not found"));
    }

    let roiPolygon = Array.isArray(payload.points) ? payload.points : null;
    const legacyFields = {};
    if (!roiPolygon && payload.rec1x !== undefined) {
      roiPolygon = [];
      for (let i = 1; i <= 5; i += 1) {
        roiPolygon.push({ x: Number(payload[`rec${i}x`]), y: Number(payload[`rec${i}y`]) });
        legacyFields[`rec${i}x`] = Number(payload[`rec${i}x`]);
        legacyFields[`rec${i}y`] = Number(payload[`rec${i}y`]);
      }
    } else if (roiPolygon && roiPolygon.length === 5) {
      roiPolygon.forEach((pt, idxPt) => {
        legacyFields[`rec${idxPt + 1}x`] = Number(pt.x);
        legacyFields[`rec${idxPt + 1}y`] = Number(pt.y);
      });
    } else {
      for (let i = 1; i <= 5; i += 1) {
        legacyFields[`rec${i}x`] = null;
        legacyFields[`rec${i}y`] = null;
      }
    }

    const updated = {
      ...rows[idx],
      ...legacyFields,
      roi_polygon: roiPolygon,
      updated_at: new Date().toISOString()
    };
    rows[idx] = updated;
    writeJson(KEYS.cctvs, rows);
    return Promise.resolve({ message: "ROI updated", data: updated });
  }
};

export const staticMapSettingStore = {
  list() {
    return Promise.resolve(readJson(KEYS.settings, STATIC_MAP_SETTINGS));
  },
  create(payload) {
    const rows = readJson(KEYS.settings, STATIC_MAP_SETTINGS);
    const record = { id: 1, ...payload };
    writeJson(KEYS.settings, [record, ...rows.slice(1)]);
    return Promise.resolve({ data: record });
  },
  update(id, payload) {
    const targetId = Number(id);
    const rows = readJson(KEYS.settings, STATIC_MAP_SETTINGS);
    const idx = rows.findIndex((item) => Number(item.id) === targetId);
    if (idx === -1) {
      return Promise.resolve({ data: null });
    }
    rows[idx] = { ...rows[idx], ...payload };
    writeJson(KEYS.settings, rows);
    return Promise.resolve({ data: rows[idx] });
  }
};

export const staticAgencyStore = {
  list() {
    return Promise.resolve(readJson(KEYS.agencies, STATIC_AGENCIES));
  },
  create(agency) {
    const trimmed = typeof agency === "string" ? agency.trim() : "";
    if (!trimmed) {
      return Promise.reject(new Error("Agency required"));
    }
    const rows = readJson(KEYS.agencies, STATIC_AGENCIES);
    const maxId = rows.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0);
    const created = { id: maxId + 1, agency: trimmed };
    writeJson(KEYS.agencies, [...rows, created]);
    return Promise.resolve({ data: created });
  },
  remove(agency) {
    const rows = readJson(KEYS.agencies, STATIC_AGENCIES);
    const next = rows.filter((item) => item.agency !== agency);
    writeJson(KEYS.agencies, next);
    return Promise.resolve({ message: "Deleted" });
  }
};

export const staticAuthStore = {
  getOfficeProfile() {
    const user = readJson(KEYS.user, STATIC_ADMIN_USER);
    return Promise.resolve({
      user: {
        name: user.name,
        address: user.address,
        lattitude: user.lattitude,
        longitude: user.longitude,
        description: user.description,
        profile_photo_path: user.profile_photo_path
      }
    });
  },
  getAuthUser() {
    const isAuth = Boolean(readJson(KEYS.auth, false));
    if (!isAuth) {
      return Promise.resolve({ isAuth: false, user: null });
    }
    return Promise.resolve({
      isAuth: true,
      user: readJson(KEYS.user, STATIC_ADMIN_USER)
    });
  },
  login({ email, password }) {
    const user = readJson(KEYS.user, STATIC_ADMIN_USER);
    const expectedPass = getDemoPass();
    if (
      String(email || "")
        .trim()
        .toLowerCase() === String(user.email).toLowerCase() &&
      String(password || "") === String(expectedPass)
    ) {
      writeJson(KEYS.auth, true);
      return Promise.resolve({ isAuth: true, user });
    }
    return Promise.resolve({ isAuth: false });
  },
  logout() {
    writeJson(KEYS.auth, false);
    return Promise.resolve({ isAuth: false });
  },
  updateProfile(_id, payload) {
    const current = readJson(KEYS.user, STATIC_ADMIN_USER);
    const updated = {
      ...current,
      name: payload.name ?? current.name,
      email: payload.email ?? current.email,
      address: payload.address ?? current.address,
      lattitude: String(payload.lattitude ?? current.lattitude),
      longitude: String(payload.longitude ?? current.longitude),
      description: payload.description ?? current.description
    };
    writeJson(KEYS.user, updated);
    return Promise.resolve({ user: updated });
  },
  uploadProfilePhoto(_id, file) {
    return fileToDataUrl(file).then((dataUrl) => {
      const current = readJson(KEYS.user, STATIC_ADMIN_USER);
      const updated = { ...current, profile_photo_path: dataUrl };
      writeJson(KEYS.user, updated);
      return { path: dataUrl, user: updated };
    });
  },
  changePassword(_id, { curPas, newPas, confirm }) {
    if (!curPas || curPas !== getDemoPass() || !newPas || newPas !== confirm) {
      return Promise.resolve({ status: 400 });
    }
    writeJson(KEYS.password, String(newPas));
    return Promise.resolve({ status: 200 });
  }
};
