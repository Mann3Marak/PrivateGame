import 'server-only';

interface RateLimitWindow {
  count: number;
  resetAt: number;
}

const windows = new Map<string, RateLimitWindow>();

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

export function enforceRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  const current = windows.get(key);

  if (!current || now >= current.resetAt) {
    const next: RateLimitWindow = {
      count: 1,
      resetAt: now + windowMs
    };
    windows.set(key, next);

    return {
      ok: true,
      limit,
      remaining: Math.max(limit - 1, 0),
      resetAt: next.resetAt
    };
  }

  current.count += 1;

  return {
    ok: current.count <= limit,
    limit,
    remaining: Math.max(limit - current.count, 0),
    resetAt: current.resetAt
  };
}
