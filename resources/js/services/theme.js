export const THEME_LIGHT = "theme-normal";
export const THEME_DARK = "theme-dark";
export const THEME_STORAGE_KEY = "theme";
export const THEME_EVENT = "webgista:theme-change";

/**
 * Resolve preferred theme from localStorage, active DOM class, or OS preference.
 *
 * @returns {"theme-normal" | "theme-dark"}
 */
export function getTheme() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return THEME_LIGHT;
  }

  try {
    const saved = window.localStorage ? window.localStorage.getItem(THEME_STORAGE_KEY) : null;
    if (saved === THEME_DARK || saved === THEME_LIGHT) {
      return saved;
    }
  } catch (_e) {
    // Ignore storage quota or sandbox restrictions
  }

  if (document.documentElement.classList.contains(THEME_DARK)) {
    return THEME_DARK;
  }

  if (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return THEME_DARK;
  }

  return THEME_LIGHT;
}

/**
 * Return true when active theme is dark mode.
 *
 * @returns {boolean}
 */
export function isDarkTheme() {
  return getTheme() === THEME_DARK;
}

/**
 * Apply theme classes to <html>, persist choice, and notify listeners.
 *
 * @param {"theme-normal" | "theme-dark"} themeName
 * @param {boolean} persist
 * @returns {"theme-normal" | "theme-dark"}
 */
export function applyTheme(themeName, persist = true) {
  const normalized = themeName === THEME_DARK ? THEME_DARK : THEME_LIGHT;

  if (typeof document !== "undefined") {
    document.documentElement.className =
      normalized === THEME_DARK ? `${THEME_DARK} dark` : THEME_LIGHT;
  }

  if (persist && typeof window !== "undefined") {
    try {
      if (window.localStorage) {
        window.localStorage.setItem(THEME_STORAGE_KEY, normalized);
      }
    } catch (_e) {
      // Ignore storage access failures
    }
  }

  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    try {
      window.dispatchEvent(
        new CustomEvent(THEME_EVENT, {
          detail: { theme: normalized, isDark: normalized === THEME_DARK }
        })
      );
    } catch (_e) {
      // Fallback safely in minimal JS environments
    }
  }

  return normalized;
}

/**
 * Toggle between light and dark theme.
 *
 * @returns {"theme-normal" | "theme-dark"}
 */
export function toggleTheme() {
  return applyTheme(isDarkTheme() ? THEME_LIGHT : THEME_DARK, true);
}

/**
 * Subscribe to theme change events and OS preference changes.
 *
 * @param {(payload: { theme: string, isDark: boolean }) => void} handler
 * @returns {() => void}
 */
export function subscribeTheme(handler) {
  if (typeof window === "undefined" || typeof handler !== "function") {
    return () => {};
  }

  const onThemeEvent = (event) => {
    const theme = event && event.detail ? event.detail.theme : getTheme();
    handler({ theme, isDark: theme === THEME_DARK });
  };

  const onStorage = (event) => {
    if (!event || event.key === THEME_STORAGE_KEY) {
      const theme = getTheme();
      applyTheme(theme, false);
      handler({ theme, isDark: theme === THEME_DARK });
    }
  };

  window.addEventListener(THEME_EVENT, onThemeEvent);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(THEME_EVENT, onThemeEvent);
    window.removeEventListener("storage", onStorage);
  };
}
