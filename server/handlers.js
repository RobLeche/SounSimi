import { ApiError, getQuery, readJsonBody, route, sendJson } from "./http.js";
import { config } from "./env.js";
import { bumpPopular, cacheGet, cacheSet, getPopular } from "./cache.js";
import { recommend } from "./recommend.js";
import * as deezer from "./sources/deezer.js";
import * as itunes from "./sources/itunes.js";
import { trackKey } from "./sources/normalize.js";
import { appleDeveloperToken } from "./apple.js";

const DAY = 86400;
const cdn = (sMaxAge, swr = sMaxAge * 7) => ({ "Cache-Control": `public, max-age=0, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}` });

// GET /api/recommend?song=…&artist=…
export const recommendHandler = route(async (req, res, env) => {
  const cfg = config(env);
  const input = req.method === "POST" ? await readJsonBody(req) : getQuery(req);
  // Cache key includes which sources are configured, so adding a key later
  // doesn't keep serving older, lower-quality cached results.
  const variant = `${cfg.geminiKey ? "ai" : "raw"}${cfg.lastfmKey ? "+lf" : ""}`;
  const keyFor = (song, artist) => `rec:v3:${variant}:${trackKey(song || "", artist || "")}`;
  const key = keyFor(input.song, input.artist);

  let result = await cacheGet(cfg.redis, key);
  let cacheStatus = "HIT";
  if (!result) {
    cacheStatus = "MISS";
    result = await recommend(cfg, input.song, input.artist);
    // Full AI results are cached for 30 days; listening-data-only results for a
    // shorter time so they upgrade once Gemini quota is available again.
    const ttl = result.meta.model ? 30 * DAY : result.meta.aiNotice ? 3600 : 7 * DAY;
    await cacheSet(cfg.redis, key, result, ttl);
    const canonical = keyFor(result.query.song, result.query.artist);
    if (canonical !== key) await cacheSet(cfg.redis, canonical, result, ttl);
  }
  await bumpPopular(cfg.redis, { song: result.query.song, artist: result.query.artist });

  const edge = result.meta.aiNotice ? cdn(600, 3600) : cdn(DAY, 7 * DAY);
  sendJson(res, 200, { ...result, meta: { ...result.meta, cache: cacheStatus } }, { ...edge, "X-Cache": cacheStatus });
});

// GET /api/search?q=… — autocomplete with real catalog tracks.
export const searchHandler = route(async (req, res, env) => {
  const cfg = config(env);
  const q = String(getQuery(req).q || "").trim().slice(0, 100);
  if (q.length < 2) return sendJson(res, 200, { results: [] });

  const key = `search:v1:${q.toLowerCase()}`;
  let results = await cacheGet(null, key); // memory only — cheap and short-lived
  if (!results) {
    let tracks = await deezer.searchTracks(q, 12);
    if (!tracks.length) tracks = await itunes.searchTracks(q, 10);
    const seen = new Set();
    results = tracks
      .filter((t) => t.title && t.artist)
      .filter((t) => {
        const k = trackKey(t.title, t.artist);
        return !seen.has(k) && seen.add(k);
      })
      .slice(0, 8)
      .map((t) => ({ song: t.title, artist: t.artist, album: t.album || null, artwork: t.artwork || null }));
    await cacheSet(null, key, results, 3600);
  }
  sendJson(res, 200, { results }, cdn(DAY));
});

// GET /api/preview?id=<deezerTrackId> — redirects to a fresh 30s preview
// (Deezer preview URLs are signed and expire, so we never cache them in results).
export const previewHandler = route(async (req, res) => {
  const id = String(getQuery(req).id || "");
  if (!/^\d+$/.test(id)) throw new ApiError(400, "bad_request", "Invalid track id.");
  const track = await deezer.getTrack(id);
  if (!track?.preview) throw new ApiError(404, "no_preview", "No preview available for this track.");
  res.statusCode = 302;
  res.setHeader("Location", track.preview);
  res.setHeader("Cache-Control", "public, max-age=600, s-maxage=900");
  res.end();
});

// GET /api/popular — most-searched songs.
export const popularHandler = route(async (req, res, env) => {
  const cfg = config(env);
  sendJson(res, 200, { results: await getPopular(cfg.redis, 8) }, cdn(300, 3600));
});

// GET /api/config — what the browser needs to know (no secrets).
export const configHandler = route(async (req, res, env) => {
  const cfg = config(env);
  sendJson(res, 200, {
    spotifyClientId: cfg.spotifyClientId,
    appleMusic: !!cfg.apple,
    ai: !!cfg.geminiKey,
    lastfm: !!cfg.lastfmKey,
  }, cdn(300, 3600));
});

// GET /api/apple-token — MusicKit developer token (public by design; it's used in the browser).
export const appleTokenHandler = route(async (req, res, env) => {
  const cfg = config(env);
  if (!cfg.apple) throw new ApiError(404, "not_configured", "Apple Music isn't configured on this server.");
  let token;
  try {
    token = appleDeveloperToken(cfg.apple, env.APPLE_ALLOWED_ORIGINS);
  } catch {
    throw new ApiError(500, "bad_apple_key", "APPLE_PRIVATE_KEY couldn't be read. Paste the whole .p8 file contents, including the BEGIN/END lines.");
  }
  sendJson(res, 200, { token }, { "Cache-Control": "private, max-age=3600" });
});

// GET /api/health — diagnose deployment configuration (never returns secret values).
export const healthHandler = route(async (req, res, env) => {
  const cfg = config(env);
  const hints = [];
  if (!cfg.geminiKey) {
    hints.push(
      cfg.seenGeminiNames.length
        ? `${cfg.seenGeminiNames.join(", ")} exists but is empty.`
        : "No Gemini key found. In Vercel: Settings → Environment Variables → add GEMINI_API_KEY (tick Production AND Preview), then Deployments → ⋯ → Redeploy. New variables only apply to new deployments.",
    );
  } else if (cfg.geminiKeyName !== "GEMINI_API_KEY") {
    hints.push(`Using ${cfg.geminiKeyName}. Renaming it to GEMINI_API_KEY is recommended.`);
  }
  if (!cfg.lastfmKey) hints.push("Add LASTFM_API_KEY (free at last.fm/api/account/create) for much better, listener-based matches.");
  if (!cfg.redis) hints.push("Optional: add Upstash for Redis from the Vercel Marketplace so cached results are shared and survive restarts.");
  sendJson(res, 200, {
    ok: true,
    deployment: env.VERCEL_ENV || "local",
    gemini: { configured: !!cfg.geminiKey, envVar: cfg.geminiKeyName, model: cfg.geminiModel || "gemini-3.6-flash (default)" },
    lastfm: { configured: !!cfg.lastfmKey },
    deezer: { configured: true, note: "No key needed" },
    cache: cfg.redis ? "upstash-redis + memory" : "memory only",
    spotify: { configured: !!cfg.spotifyClientId },
    appleMusic: { configured: !!cfg.apple },
    hints,
  }, { "Cache-Control": "no-store" });
});

export const routes = {
  "/api/recommend": recommendHandler,
  "/api/search": searchHandler,
  "/api/preview": previewHandler,
  "/api/popular": popularHandler,
  "/api/config": configHandler,
  "/api/apple-token": appleTokenHandler,
  "/api/health": healthHandler,
};
