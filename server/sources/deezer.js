// Deezer public API — free, no key. https://developers.deezer.com/api
import { fetchJson } from "../http.js";
import { normTitle, sameArtist } from "./normalize.js";

const BASE = "https://api.deezer.com";

async function get(path) {
  try {
    const { ok, body } = await fetchJson(`${BASE}${path}`, {}, 6000);
    if (!ok || !body || body.error) return null;
    return body;
  } catch {
    return null;
  }
}

export function toTrack(t) {
  return {
    title: t.title_short || t.title,
    artist: t.artist?.name,
    deezerId: t.id,
    deezerArtistId: t.artist?.id,
    deezerUrl: t.link,
    artwork: t.album?.cover_medium || t.album?.cover || null,
    album: t.album?.title || null,
    rank: t.rank || 0,
    isrc: t.isrc || null,
  };
}

export async function searchTracks(q, limit = 10) {
  const body = await get(`/search?q=${encodeURIComponent(q)}&limit=${limit}`);
  return (body?.data || []).filter((t) => t.type === "track").map(toTrack);
}

// Best Deezer match for a title + artist, or null.
export async function findTrack(title, artist) {
  const results = await searchTracks(`${title} ${artist}`, 10);
  const wantTitle = normTitle(title);
  return (
    results.find((t) => sameArtist(t.artist, artist) && normTitle(t.title) === wantTitle) ||
    results.find((t) => sameArtist(t.artist, artist) && normTitle(t.title).includes(wantTitle)) ||
    null
  );
}

export async function getTrack(id) {
  return get(`/track/${encodeURIComponent(id)}`);
}

// "Radio" for an artist: a real, listening-based mix of similar tracks.
export async function artistRadio(artistId) {
  const body = await get(`/artist/${artistId}/radio?limit=50`);
  return (body?.data || []).map(toTrack);
}

export async function relatedArtists(artistId, limit = 8) {
  const body = await get(`/artist/${artistId}/related?limit=${limit}`);
  return (body?.data || []).map((a) => ({ id: a.id, name: a.name }));
}

export async function artistTop(artistId, limit = 50) {
  const body = await get(`/artist/${artistId}/top?limit=${limit}`);
  return (body?.data || []).map(toTrack);
}
