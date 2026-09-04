/**
 * Fixed-window rate limiter, in memory.
 *
 * The app is a single process serving one dataset, so an in-process counter is
 * sufficient and avoids adding a dependency and a Redis. Behind a load
 * balancer this becomes per-instance rather than global — acceptable for the
 * abuse it is meant to blunt (export flooding, contact-form spam), not a
 * substitute for an edge WAF.
 */
const buckets = new Map();

/** Drop expired buckets so the map cannot grow without bound. */
function sweep(now) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

let lastSweep = 0;

export function rateLimit({ windowMs, max, name }) {
  return function limiter(req, res, next) {
    const now = Date.now();
    if (now - lastSweep > windowMs) {
      sweep(now);
      lastSweep = now;
    }

    // `req.ip` honours trust proxy when the operator configures it.
    const key = `${name}:${req.ip}`;
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    const remaining = Math.max(0, max - bucket.count);
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(Math.ceil((bucket.resetAt - now) / 1000)));

    if (bucket.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      return res.status(429).json({ error: "Too many requests. Please slow down." });
    }
    return next();
  };
}

/** Exposed for tests. */
export function resetRateLimits() {
  buckets.clear();
}
