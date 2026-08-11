/** A minimal fixed-window rate limiter. In-memory (per instance) — demo-grade. */
export function createRateLimiter(opts: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return function isLimited(key: string, now: number): boolean {
    const rec = hits.get(key);
    if (!rec || now > rec.resetAt) {
      hits.set(key, { count: 1, resetAt: now + opts.windowMs });
      return false;
    }
    rec.count += 1;
    return rec.count > opts.max;
  };
}
