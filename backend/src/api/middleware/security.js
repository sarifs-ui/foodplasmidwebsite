/**
 * Baseline security headers.
 *
 * Written by hand rather than pulling in helmet: the policy has to name the
 * three external origins this app actually uses, so it is clearer to state it
 * in one place than to configure a library around it.
 */

/** External origins the frontend legitimately loads from. */
const FONT_CSS = "https://fonts.googleapis.com";
const FONT_FILES = "https://fonts.gstatic.com";
const MAP_DATA = "https://cdn.jsdelivr.net";

const CSP = [
  "default-src 'self'",
  // Vite emits no inline scripts in the production build.
  "script-src 'self'",
  // Tailwind's build output plus the inline <style> block the app injects.
  `style-src 'self' 'unsafe-inline' ${FONT_CSS}`,
  `font-src 'self' ${FONT_FILES}`,
  "img-src 'self' data:",
  // The world map fetches its TopoJSON geometry at runtime.
  `connect-src 'self' ${MAP_DATA}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export function securityHeaders(req, res, next) {
  res.setHeader("Content-Security-Policy", CSP);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  // Only meaningful over TLS; harmless otherwise, and correct once deployed
  // behind HTTPS.
  if (req.secure || req.get("x-forwarded-proto") === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
}

/**
 * CORS policy.
 *
 * The API used to answer every origin with `Access-Control-Allow-Origin: *`,
 * which let any website call the state-changing endpoints from a visitor's
 * browser. Reads stay open (this is public data); anything else is same-origin
 * unless an operator opts specific origins in through CORS_ORIGINS.
 */
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export function corsPolicy(req, res, next) {
  const origin = req.get("origin");
  const isSafeMethod = req.method === "GET" || req.method === "HEAD";

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  } else if (isSafeMethod) {
    // Public read-only data: any origin may read it, but no credentials ride
    // along and no unsafe method is permitted cross-origin.
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  if (req.method === "OPTIONS") return res.sendStatus(204);
  return next();
}
