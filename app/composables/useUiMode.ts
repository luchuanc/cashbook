export type UiMode = "legacy" | "mobile-v2";

export const UI_MODE_KEY = "cashbook.ui.mode";

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
  return localStorage.getItem(UI_MODE_KEY) === "mobile-v2"
    ? "mobile-v2"
    : "legacy";
};

export const setUiMode = (mode: UiMode) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(UI_MODE_KEY, mode);
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
