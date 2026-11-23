// ============================================================
// JEE Practice Hub — Centralized Rate Limiter & Abuse Prevention
// Mitigates credential stuffing, registration spam, and email flood attacks
// ============================================================

export interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const RATE_LIMIT_PREFIX = 'jph_rate_limit:';

/**
 * Checks if a specific bucket has capacity without incrementing its counter.
 */
export function checkRateLimit(
  bucket: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const key = RATE_LIMIT_PREFIX + bucket;
  const now = Date.now();

  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    if (!raw) {
      return { allowed: true, remaining: maxAttempts, retryAfterSeconds: 0 };
    }

    const record: RateLimitRecord = JSON.parse(raw);
    if (now >= record.resetAt) {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
      return { allowed: true, remaining: maxAttempts, retryAfterSeconds: 0 };
    }

    if (record.count >= maxAttempts) {
      const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    return { allowed: true, remaining: maxAttempts - record.count, retryAfterSeconds: 0 };
  } catch {
    return { allowed: true, remaining: maxAttempts, retryAfterSeconds: 0 };
  }
}

/**
 * Records a hit against a specific rate-limit bucket and returns the new capacity status.
 */
export function hitRateLimit(
  bucket: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const key = RATE_LIMIT_PREFIX + bucket;
  const now = Date.now();

  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    let record: RateLimitRecord = raw
      ? JSON.parse(raw)
      : { count: 0, resetAt: now + windowMs };

    if (now >= record.resetAt) {
      record = { count: 0, resetAt: now + windowMs };
    }

    record.count += 1;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(record));
    }

    if (record.count > maxAttempts) {
      const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    return { allowed: true, remaining: maxAttempts - record.count, retryAfterSeconds: 0 };
  } catch {
    return { allowed: true, remaining: maxAttempts, retryAfterSeconds: 0 };
  }
}

/**
 * Resets/clears a rate limit bucket.
 */
export function resetRateLimitBucket(bucket: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(RATE_LIMIT_PREFIX + bucket);
    }
  } catch {
    // ignore
  }
}
