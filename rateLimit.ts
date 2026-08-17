import "server-only";

const buckets = new Map<string, { count: number; resetAt: number }>();
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) { buckets.set(key, { count: 1, resetAt: now + windowMs }); return { ok: true, remaining: limit - 1 }; }
  current.count += 1;
  return { ok: current.count <= limit, remaining: Math.max(0, limit - current.count), retryAfterMs: Math.max(0, current.resetAt - now) };
}
