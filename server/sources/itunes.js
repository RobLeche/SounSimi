// iTunes Search API — free, no key. Used as a fallback for autocomplete.
import { fetchJson } from "../http.js";

export async function searchTracks(q, limit = 8) {
  try {
    const { ok, body } = await fetchJson(`https://itunes.apple.com/search?media=music&entity=song&limit=${limit}&term=${encodeURIComponent(q)}`, {}, 5000);
    if (!ok) return [];
    return (body?.results || []).map((t) => ({
      title: t.trackName,
      artist: t.artistName,
      album: t.collectionName,
      artwork: t.artworkUrl100?.replace("100x100bb", "200x200bb") || null,
      appleId: t.trackId,
    }));
  } catch {
    return [];
  }
}
