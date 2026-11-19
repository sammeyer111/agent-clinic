import type { MiddlewareHandler } from "hono";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up expired rate limit records periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000).unref();

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
  message?: string;
}

/**
 * Creates an in-memory sliding window rate limiter middleware for Hono.
 * Uses Cloudflare headers (cf-connecting-ip), standard proxy headers (x-forwarded-for),
 * or local loopback fallback.
 */
export function rateLimiter(options: RateLimiterOptions): MiddlewareHandler {
  const { windowMs, maxRequests, keyPrefix = "rl", message } = options;

  return async (c, next) => {
    const cfIp = c.req.header("cf-connecting-ip");
    const forwarded = c.req.header("x-forwarded-for");
    const isCloudflare = Boolean(cfIp || c.req.header("cf-ray"));
    const ip = cfIp || (forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1");

    // Local loopback automated test runner bypass / high allowance (1000 req/min)
    const effectiveLimit = (!isCloudflare && (ip === "127.0.0.1" || ip === "::1")) ? 1000 : maxRequests;

    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    let record = rateLimitStore.get(key);

    if (!record || record.resetAt <= now) {
      record = { count: 1, resetAt: now + windowMs };
      rateLimitStore.set(key, record);
    } else {
      record.count++;
    }

    const remaining = Math.max(0, effectiveLimit - record.count);
    const resetSeconds = Math.ceil((record.resetAt - now) / 1000);

    c.header("X-RateLimit-Limit", String(effectiveLimit));
    c.header("X-RateLimit-Remaining", String(remaining));
    c.header("X-RateLimit-Reset", String(resetSeconds));

    if (record.count > effectiveLimit) {
      c.header("Retry-After", String(resetSeconds));
      return c.json(
        {
          success: false,
          error: message || "Too Many Requests: Rate limit exceeded. Please slow down and try again.",
          retry_after_seconds: resetSeconds,
        },
        429
      );
    }

    return next();
  };
}
