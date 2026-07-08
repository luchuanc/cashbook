export type UiMode = "legacy" | "mobile-v2";

export const UI_MODE_KEY = "cashbook.ui.mode";
const UI_MODE_MAX_AGE = 60 * 60 * 24 * 365;

const legacyToMobileMap: Record<string, string> = {
  "/": "/m/calendar",
  "/calendar": "/m/calendar",
  "/flows": "/m/flows",
  "/analysis": "/m/analysis",
  "/budget": "/m/budget",
  "/receivable": "/m/receivable",
  "/books": "/m/books",
  "/types": "/m/config",
  "/default-types": "/m/config",
};

const mobileToLegacyMap: Record<string, string> = {
  "/m": "/calendar",
  "/m/calendar": "/calendar",
  "/m/flows": "/flows",
  "/m/analysis": "/analysis",
  "/m/budget": "/budget",
  "/m/receivable": "/receivable",
  "/m/books": "/books",
  "/m/config": "/types",
  "/m/settings": "/calendar",
};

const normalizePath = (path: string) => {
  if (!path || path === "/") return "/";
  return path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path;
};

export const getUiMode = (): UiMode => {
  if (typeof window === "undefined") return "legacy";
  const storedMode = getUiModeStorage() || getUiModeCookie();
  return storedMode === "mobile-v2"
    ? "mobile-v2"
    : "legacy";
};

const getUiModeStorage = () => {
  try {
    return localStorage.getItem(UI_MODE_KEY) || "";
  } catch {
    return "";
  }
};

const getUiModeCookie = () => {
  if (typeof document === "undefined") return "";
  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${UI_MODE_KEY}=`));
  return cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : "";
};

export const setUiMode = (mode: UiMode) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(UI_MODE_KEY, mode);
  } catch {
    // Cookie fallback handles embedded WebView environments with restricted storage.
  }
  document.cookie = `${UI_MODE_KEY}=${encodeURIComponent(mode)}; path=/; max-age=${UI_MODE_MAX_AGE}; SameSite=Lax`;
};

export const getPairedUiPath = (mode: UiMode, path: string) => {
  const cleanPath = normalizePath(path.split("?")[0] || path);
  return mode === "mobile-v2"
    ? legacyToMobileMap[cleanPath]
    : mobileToLegacyMap[cleanPath];
};

export const isUiModeManagedPath = (path: string) => {
  const cleanPath = normalizePath(path.split("?")[0] || path);
  return Boolean(legacyToMobileMap[cleanPath] || mobileToLegacyMap[cleanPath]);
};

export const useUiMode = () => {
  const route = useRoute();

  const switchUiMode = async (mode: UiMode, path = route.path) => {
    setUiMode(mode);
    const target = getPairedUiPath(mode, path);
    await navigateTo(target || (mode === "mobile-v2" ? "/m/calendar" : "/calendar"), {
      replace: true,
    });
  };

  return {
    getUiMode,
    setUiMode,
    getPairedUiPath,
    isUiModeManagedPath,
    switchUiMode,
  };
};
