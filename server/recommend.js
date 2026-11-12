// Recommendation pipeline:
//   1. Resolve the seed song on Deezer (+ Last.fm tags)
//   2. Gather REAL candidates: Last.fm similar tracks, Deezer artist radio,
//      Deezer related artists' top tracks, and the artist's own catalog
//   3. Gemini ranks + explains them (it can only pick from candidate ids)
//      — if Gemini isn't configured or fails, fall back to listening-data ranking
import { ApiError } from "./http.js";
import * as deezer from "./sources/deezer.js";
import * as lastfm from "./sources/lastfm.js";
import { rankCandidates, suggestTracks } from "./gemini.js";
import { normTitle, sameArtist, trackKey } from "./sources/normalize.js";

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(n)));

function addCandidate(map, t, source, extra = {}) {
  if (!t?.title || !t?.artist) return;
  const key = trackKey(t.title, t.artist);
  const cur = map.get(key) || { title: t.title, artist: t.artist, sources: new Set() };
  for (const [k, v] of Object.entries({ ...t, ...extra })) {
    if (v != null && cur[k] == null) cur[k] = v;
  }
  // Keep the strongest signals when the same track shows up twice.
  if (extra.radioPos != null) cur.radioPos = Math.min(cur.radioPos ?? 999, extra.radioPos);
  if (t.lastfmMatch) cur.lastfmMatch = Math.max(cur.lastfmMatch || 0, t.lastfmMatch);
  if (extra.popularityRank) cur.popularityRank = Math.min(cur.popularityRank ?? 999, extra.popularityRank);
  cur.sources.add(source);
  map.set(key, cur);
}

function heuristicScore(c) {
  let s = 0;
  if (c.lastfmMatch) s = 58 + 40 * c.lastfmMatch;
  if (c.radioPos != null) s = Math.max(s, 80 - c.radioPos * 0.6);
  if (c.sources.has("deezer-related")) s = Math.max(s, 64);
  if (c.sources.has("gemini")) s = Math.max(s, 66);
  if (c.popularityRank) s = Math.max(s, 74 - Math.min(c.popularityRank, 40) * 0.4);
  s += (c.sources.size - 1) * 4;
  return clamp(s, 50, 97);
}

function heuristicWhy(c, seed) {
  if (c.lastfmMatch) return `Listeners who play "${seed.title}" also play this — ${Math.round(c.lastfmMatch * 100)}% listener similarity on Last.fm.`;
  if (c.radioPos != null) return `Part of Deezer's ${seed.artist} radio, a mix built from tracks with a similar sound and audience.`;
  if (c.sources.has("deezer-related")) return `${c.artist} is one of the artists most closely related to ${seed.artist} on Deezer — this is one of their signature tracks.`;
  if (c.popularityRank) return `A ${c.popularityRank > 15 ? "lesser-known" : "fan-favorite"} ${seed.artist} track (#${c.popularityRank} by popularity).`;
  return `Suggested as a sonic match for "${seed.title}" and verified on Deezer.`;
}

function diverse(list, maxPerArtist) {
  const counts = new Map();
  return list.filter((c) => {
    const k = c.artist.toLowerCase();
    const n = counts.get(k) || 0;
    if (n >= maxPerArtist) return false;
    counts.set(k, n + 1);
    return true;
  });
}

function shape(c, seed, pick) {
  return {
    song: c.title,
    artist: c.artist,
    year: pick?.year || null,
    why: pick?.why || heuristicWhy(c, seed),
    matchScore: clamp(pick?.matchScore ?? heuristicScore(c), 40, 99),
    tags: pick?.tags || {},
    hiddenGem: pick ? !!pick.hiddenGem : (c.popularityRank || 0) > 15,
    artwork: c.artwork || null,
    deezerId: c.deezerId || null,
    deezerUrl: c.deezerUrl || null,
    lastfmUrl: c.lastfmUrl || null,
    sources: [...c.sources],
  };
}

async function gatherCandidates(cfg, seed) {
  const artistId = seed.deezerArtistId;
  const [lfSimilar, radio, related, dzTop, lfTop] = await Promise.all([
    lastfm.similarTracks(cfg.lastfmKey, seed.title, seed.artist),
    artistId ? deezer.artistRadio(artistId) : [],
    artistId ? deezer.relatedArtists(artistId, 8) : [],
    artistId ? deezer.artistTop(artistId, 50) : [],
    lastfm.artistTopTracks(cfg.lastfmKey, seed.artist, 50),
  ]);
  const relatedTops = (await Promise.all(related.map((a) => deezer.artistTop(a.id, 3)))).flat();

  const map = new Map();
  lfSimilar.forEach((t) => addCandidate(map, t, "lastfm"));
  radio.forEach((t, i) => addCandidate(map, t, "deezer-radio", { radioPos: i }));
  relatedTops.forEach((t) => addCandidate(map, t, "deezer-related"));
  dzTop.forEach((t, i) => addCandidate(map, t, "deezer-top", { popularityRank: i + 1 }));
  lfTop.forEach((t) => addCandidate(map, t, "lastfm-top", { popularityRank: t.lastfmRank }));
  return map;
}

function splitCandidates(map, seed) {
  const seedTitle = normTitle(seed.title);
  const all = [...map.values()];
  const others = diverse(
    all.filter((c) => !sameArtist(c.artist, seed.artist)).sort((a, b) => heuristicScore(b) - heuristicScore(a)),
    2,
  ).slice(0, 40);
  const same = all
    .filter((c) => sameArtist(c.artist, seed.artist) && normTitle(c.title) !== seedTitle)
    .sort((a, b) => (a.popularityRank ?? 500) - (b.popularityRank ?? 500))
    .slice(0, 35);
  others.forEach((c, i) => (c.id = `o${i + 1}`));
  same.forEach((c, i) => (c.id = `s${i + 1}`));
  return { others, same };
}

export async function recommend(cfg, song, artist) {
  song = String(song || "").trim().slice(0, 200);
  artist = String(artist || "").trim().slice(0, 200);
  if (!song || !artist) throw new ApiError(400, "bad_request", "Pick a song from the search suggestions.");

  // 1. Resolve the seed track.
  const [dzSeed, lfInfo] = await Promise.all([deezer.findTrack(song, artist), lastfm.trackInfo(cfg.lastfmKey, song, artist)]);
  const seed = {
    ...(dzSeed || {}),
    title: dzSeed?.title || lfInfo?.title || song,
    artist: dzSeed?.artist || lfInfo?.artist || artist,
    tags: lfInfo?.tags || [],
  };

  // 2. Real candidates.
  let map = await gatherCandidates(cfg, seed);
  let { others, same } = splitCandidates(map, seed);

  // Obscure song with no listening data: let Gemini suggest, then keep only
  // the suggestions that actually exist on Deezer.
  if (others.length < 3 && cfg.geminiKey) {
    try {
      const { data } = await suggestTracks(cfg, seed.title, seed.artist);
      const verified = await Promise.all((data.tracks || []).slice(0, 22).map((t) => deezer.findTrack(t.title, t.artist)));
      verified.filter(Boolean).forEach((t) => addCandidate(map, t, "gemini"));
      ({ others, same } = splitCandidates(map, seed));
    } catch {
      /* fall through with whatever we have */
    }
  }

  if (!dzSeed && !lfInfo && others.length === 0) {
    throw new ApiError(404, "not_found", `Couldn't find "${song}" by ${artist} in the Deezer or Last.fm catalogs. Try picking it from the search suggestions.`);
  }
  if (others.length === 0 && same.length === 0) {
    throw new ApiError(404, "no_matches", "Found the song, but no similar tracks yet. Adding a Last.fm API key gives much better coverage.");
  }

  // 3. Rank + explain.
  let picksOther = null;
  let picksSame = null;
  let queryInfo = {};
  let model = null;
  let aiNotice = null;

  if (cfg.geminiKey) {
    try {
      const { data, model: used } = await rankCandidates(cfg, seed, others, same);
      const byId = new Map([...others, ...same].map((c) => [c.id, c]));
      const resolve = (list, allowed) => {
        const seen = new Set();
        return (list || [])
          .filter((p) => byId.has(p.id) && allowed.includes(byId.get(p.id)) && !seen.has(p.id) && seen.add(p.id))
          .map((p) => shape(byId.get(p.id), seed, p));
      };
      picksOther = resolve(data.matches, others);
      picksSame = resolve(data.sameArtistMatches, same);
      queryInfo = data.query || {};
      model = used;
    } catch (err) {
      aiNotice = `AI explanations unavailable (${err.message}) — showing matches ranked by listening data.`;
    }
  }

  // Fill (or fully build) lists from listening data.
  const fill = (picked, pool, n, sortFn) => {
    const have = new Set((picked || []).map((p) => trackKey(p.song, p.artist)));
    const extra = [...pool].sort(sortFn).filter((c) => !have.has(trackKey(c.title, c.artist)));
    return [...(picked || []), ...extra.map((c) => shape(c, seed))].slice(0, n);
  };
  const otherArtistsUsed = new Set((picksOther || []).map((p) => p.artist.toLowerCase()));
  const matches = fill(
    picksOther,
    diverse(others.filter((c) => !otherArtistsUsed.has(c.artist.toLowerCase())), 1),
    6,
    (a, b) => heuristicScore(b) - heuristicScore(a),
  );
  // Deep cuts: skip the very biggest hits when we're choosing without AI.
  const deep = same.length > 10 ? same.filter((c) => (c.popularityRank ?? 99) > 4) : same;
  const sameArtistMatches = fill(picksSame, deep, 5, (a, b) => heuristicScore(b) - heuristicScore(a));

  // Attach Deezer artwork/previews to Last.fm-only picks.
  await Promise.all(
    [...matches, ...sameArtistMatches].filter((t) => !t.deezerId).map(async (t) => {
      const hit = await deezer.findTrack(t.song, t.artist);
      if (hit) Object.assign(t, { artwork: hit.artwork, deezerId: hit.deezerId, deezerUrl: hit.deezerUrl });
    }),
  );

  const sources = new Set();
  [...matches, ...sameArtistMatches].forEach((t) => t.sources.forEach((s) => sources.add(s.split("-")[0])));

  return {
    query: {
      song: seed.title,
      artist: seed.artist,
      year: queryInfo.year || null,
      genre: queryInfo.genre || seed.tags[0] || null,
      description: queryInfo.description || (seed.tags.length ? `Listeners tag this as ${seed.tags.slice(0, 4).join(", ")}.` : null),
      artwork: seed.artwork || null,
      deezerId: seed.deezerId || null,
      deezerUrl: seed.deezerUrl || null,
    },
    matches,
    sameArtistMatches,
    meta: { model, aiNotice, sources: [...sources], generatedAt: new Date().toISOString() },
  };
}
