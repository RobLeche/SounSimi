// Two-level cache: an in-memory map (per server instance) plus optional
// Upstash Redis (Vercel Marketplace → "Upstash for Redis", free tier) so cached
// results survive cold starts and are shared across all instances.

const mem = new Map();
const MAX_MEM = 500;

function memGet(key) {
  const hit = mem.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    mem.delete(key);
    return undefined;
  }
  return hit.value;
}

function memSet(key, value, ttlSec) {
  if (mem.size >= MAX_MEM) mem.delete(mem.keys().next().value);
  mem.set(key, { value, expires: Date.now() + ttlSec * 1000 });
}

async function redis(redisCfg, command) {
  if (!redisCfg) return null;
  try {
    const res = await fetch(redisCfg.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${redisCfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    return (await res.json())?.result ?? null;
  } catch {
    return null; // Cache is best-effort; never fail a request because of it.
  }
}

export async function cacheGet(redisCfg, key) {
  const local = memGet(key);
  if (local !== undefined) return local;
  const raw = await redis(redisCfg, ["GET", key]);
  if (raw == null) return undefined;
  try {
    const value = JSON.parse(raw);
    memSet(key, value, 600);
    return value;
  } catch {
    return undefined;
  }
}

export async function cacheSet(redisCfg, key, value, ttlSec) {
  memSet(key, value, Math.min(ttlSec, 6 * 3600));
  await redis(redisCfg, ["SET", key, JSON.stringify(value), "EX", String(ttlSec)]);
}

// ---- Popular searches (sorted set in Redis, or in-memory fallback) ----
const memPopular = new Map();

export async function bumpPopular(redisCfg, entry) {
  const member = JSON.stringify({ song: entry.song, artist: entry.artist });
  memPopular.set(member, (memPopular.get(member) || 0) + 1);
  await redis(redisCfg, ["ZINCRBY", "popular:v1", "1", member]);
}

export async function getPopular(redisCfg, n = 8) {
  const fromRedis = await redis(redisCfg, ["ZREVRANGE", "popular:v1", "0", String(n - 1)]);
  const members = Array.isArray(fromRedis) && fromRedis.length
    ? fromRedis
    : [...memPopular.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([m]) => m);
  return members.map((m) => { try { return JSON.parse(m); } catch { return null; } }).filter(Boolean);
}
