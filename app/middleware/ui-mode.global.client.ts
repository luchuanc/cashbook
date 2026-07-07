export default defineNuxtRouteMiddleware((to) => {
  const path = to.path;

  if (
    path.startsWith("/login") ||
    path.startsWith("/admin") ||
    path.startsWith("/api-docs") ||
    path.startsWith("/500")
  ) {
    return;
  }

  if (!isUiModeManagedPath(path)) return;

  const mode = getUiMode();
  const target = getPairedUiPath(mode, path);

  if (target && target !== path) {
    return navigateTo(target, { replace: true });
  }
});
