// Last.fm API — free key from https://www.last.fm/api/account/create
// Similarity here comes from millions of real listeners' scrobbles.
import { fetchJson } from "../http.js";

const BASE = "https://ws.audioscrobbler.com/2.0/";

async function call(apiKey, params) {
  if (!apiKey) return null;
  const qs = new URLSearchParams({ ...params, api_key: apiKey, format: "json", autocorrect: "1" });
  try {
    const { ok, body } = await fetchJson(`${BASE}?${qs}`, { headers: { "User-Agent": "SoundSimilar/2.1" } }, 7000);
    if (!ok || !body || body.error) return null;
    return body;
  } catch {
    return null;
  }
}

const asArray = (x) => (Array.isArray(x) ? x : x ? [x] : []);

export async function similarTracks(apiKey, title, artist, limit = 60) {
  const body = await call(apiKey, { method: "track.getSimilar", track: title, artist, limit: String(limit) });
  return asArray(body?.similartracks?.track).map((t) => ({
    title: t.name,
    artist: t.artist?.name,
    lastfmMatch: Number(t.match) || 0,
    lastfmUrl: t.url,
  }));
}

export async function artistTopTracks(apiKey, artist, limit = 50) {
  const body = await call(apiKey, { method: "artist.getTopTracks", artist, limit: String(limit) });
  return asArray(body?.toptracks?.track).map((t, i) => ({
    title: t.name,
    artist: t.artist?.name || artist,
    lastfmRank: i + 1,
    listeners: Number(t.listeners) || 0,
    lastfmUrl: t.url,
  }));
}

export async function trackInfo(apiKey, title, artist) {
  const body = await call(apiKey, { method: "track.getInfo", track: title, artist });
  const t = body?.track;
  if (!t) return null;
  return {
    title: t.name,
    artist: t.artist?.name,
    tags: asArray(t.toptags?.tag).map((x) => x.name).slice(0, 5),
  };
}

export async function searchTracks(apiKey, q, limit = 8) {
  const body = await call(apiKey, { method: "track.search", track: q, limit: String(limit) });
  return asArray(body?.results?.trackmatches?.track).map((t) => ({ title: t.name, artist: t.artist }));
}
