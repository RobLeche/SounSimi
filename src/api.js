export async function fetchRecommendations(song, artist, signal) {
  let res;
  try {
    res = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ song, artist }),
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw Object.assign(new Error("Couldn't reach the SoundSimilar server. Is `npm run dev` running?"), { code: "network" });
  }

  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    const message =
      data?.error ||
      (res.status === 404
        ? "The /api/recommend endpoint wasn't found. Static hosts (like GitHub Pages) can't run it — deploy to Vercel or run `npm run dev`."
        : `Request failed (HTTP ${res.status}).`);
    throw Object.assign(new Error(message), { code: data?.code || `http_${res.status}` });
  }
  return data;
}

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
