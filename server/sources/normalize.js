// Normalize titles/artists so "Dreams (2004 Remaster)" and "Dreams" dedupe together.
export function normTitle(s = "") {
  return String(s)
    .toLowerCase()
    .replace(/\s*[([].*?[)\]]/g, "")
    .replace(/\s+-\s+.*(remaster|version|edit|mix|live|mono|stereo|demo|single).*$/i, "")
    .replace(/\b(feat|ft)\.?\s.*$/i, "")
    .replace(/&/g, "and")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function normArtist(s = "") {
  return String(s)
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/&/g, "and")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function sameArtist(a, b) {
  const x = normArtist(a);
  const y = normArtist(b);
  return !!x && !!y && (x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `));
}

export const trackKey = (title, artist) => `${normArtist(artist)}|${normTitle(title)}`;
