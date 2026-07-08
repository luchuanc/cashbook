export default defineEventHandler((event) => {
  const origin = getHeader(event, "origin") || "*";

  setHeaders(event, {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Admin,Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  });

  if (getMethod(event) === "OPTIONS") {
    return "";
  }
});
