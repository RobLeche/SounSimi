export function readUrlState() {
  const p = new URLSearchParams(window.location.search);
  const song = p.get("song")?.trim();
  const artist = p.get("artist")?.trim();
  return song && artist ? { song, artist, tab: p.get("tab") === "same" ? "same" : "other" } : null;
}

export function shareUrl({ song, artist, tab }) {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set("song", song);
  url.searchParams.set("artist", artist);
  if (tab === "same") url.searchParams.set("tab", "same");
  return url.toString();
}

export function syncUrl(state, { replace = false } = {}) {
  const next = state ? shareUrl(state) : window.location.origin + window.location.pathname;
  if (next === window.location.href) return;
  window.history[replace ? "replaceState" : "pushState"](null, "", next);
}

export async function shareResults(state) {
  const url = shareUrl(state);
  const title = `Songs like "${state.song}" by ${state.artist}`;
  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    try {
      await navigator.share({ title, text: `${title} — found with SoundSimilar`, url });
      return "shared";
    } catch (err) {
      if (err.name === "AbortError") return "cancelled";
    }
  }
  await navigator.clipboard.writeText(url);
  return "copied";
}

export function tracklistText(results) {
  const lines = [results.query, ...results.matches, ...results.sameArtistMatches].map((t) => `${t.song} — ${t.artist}`);
  return `Songs like "${results.query.song}" by ${results.query.artist}\n\n${lines.join("\n")}\n\n${shareUrl({ song: results.query.song, artist: results.query.artist })}`;
}
