async function getJson(url, signal) {
  let res;
  try {
    res = await fetch(url, { signal });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw Object.assign(new Error("Couldn't reach the SoundSimilar server."), { code: "network" });
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    const message =
      data?.error ||
      (res.status === 404 ? "The API route wasn't found. Static hosts (like GitHub Pages) can't run it — deploy to Vercel or run `npm run dev`." : `Request failed (HTTP ${res.status}).`);
    throw Object.assign(new Error(message), { code: data?.code || `http_${res.status}` });
  }
  return data;
}

export const fetchRecommendations = (song, artist, signal) =>
  getJson(`/api/recommend?song=${encodeURIComponent(song)}&artist=${encodeURIComponent(artist)}`, signal);

export const fetchSuggestions = (q, signal) => getJson(`/api/search?q=${encodeURIComponent(q)}`, signal).then((d) => d.results || []);

export const fetchConfig = () => getJson("/api/config").catch(() => ({}));

export const fetchPopular = () => getJson("/api/popular").then((d) => d.results || []).catch(() => []);

export const previewUrl = (track) => (track?.deezerId ? `/api/preview?id=${track.deezerId}` : null);

const RECENT_KEY = "soundsimilar:recent";

export function loadRecent() {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(list) ? list.slice(0, 6) : [];
  } catch {
    return [];
  }
}

export function saveRecent(entry, current) {
  const key = (e) => `${e.song}|${e.artist}`.toLowerCase();
  const next = [entry, ...current.filter((e) => key(e) !== key(entry))].slice(0, 6);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — keep in memory only */
  }
  return next;
}
