// Gemini is used to RANK and EXPLAIN real candidate tracks found by Last.fm /
// Deezer. It can only pick from candidate ids we give it, so it can't invent songs.
import { ApiError } from "./http.js";

const DEFAULT_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-2.5-flash-lite"];
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const TAGS = {
  type: "OBJECT",
  properties: {
    sound: { type: "BOOLEAN" },
    instruments: { type: "BOOLEAN" },
    emotion: { type: "BOOLEAN" },
    lyrics: { type: "BOOLEAN" },
    energy: { type: "BOOLEAN" },
  },
  required: ["sound", "instruments", "emotion", "lyrics", "energy"],
};

const pickSchema = (extra = {}) => ({
  type: "OBJECT",
  properties: {
    id: { type: "STRING" },
    why: { type: "STRING" },
    matchScore: { type: "INTEGER" },
    year: { type: "INTEGER" },
    tags: TAGS,
    ...extra,
  },
  required: ["id", "why", "matchScore", "tags"],
});

const RANK_SCHEMA = {
  type: "OBJECT",
  properties: {
    query: {
      type: "OBJECT",
      properties: { description: { type: "STRING" }, genre: { type: "STRING" }, year: { type: "INTEGER" } },
      required: ["description"],
    },
    matches: { type: "ARRAY", items: pickSchema() },
    sameArtistMatches: { type: "ARRAY", items: pickSchema({ hiddenGem: { type: "BOOLEAN" } }) },
  },
  required: ["query", "matches", "sameArtistMatches"],
};

const SUGGEST_SCHEMA = {
  type: "OBJECT",
  properties: {
    tracks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { title: { type: "STRING" }, artist: { type: "STRING" } },
        required: ["title", "artist"],
      },
    },
  },
  required: ["tracks"],
};

function toApiError(status, body) {
  const msg = body?.error?.message || `Gemini returned HTTP ${status}`;
  if (status === 400 && /api key/i.test(msg)) return new ApiError(401, "invalid_key", "Your Gemini API key was rejected.");
  if (status === 403) return new ApiError(403, "forbidden", "This Gemini API key isn't allowed to use the model (check key restrictions).");
  if (status === 429) return new ApiError(429, "rate_limited", "Gemini free-tier quota reached.");
  if (status === 404) return new ApiError(404, "model_not_found", msg);
  return new ApiError(502, "upstream_error", msg);
}

async function generate(cfg, prompt, schema, temperature = 0.4) {
  const models = [...new Set([cfg.geminiModel, ...DEFAULT_MODELS].filter(Boolean))];
  let lastErr;
  for (const model of models) {
    try {
      const res = await fetch(`${BASE}/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.geminiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature, maxOutputTokens: 8192, responseMimeType: "application/json", responseSchema: schema },
        }),
        signal: AbortSignal.timeout(40_000),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw toApiError(res.status, body);
      const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
      if (!text) throw new ApiError(502, "empty_response", `Gemini returned no content (${body?.candidates?.[0]?.finishReason || "unknown"}).`);
      return { data: JSON.parse(text.replace(/```json|```/g, "").trim()), model };
    } catch (err) {
      lastErr = err;
      if (!(err instanceof ApiError) || err.code !== "model_not_found") throw err;
    }
  }
  throw lastErr;
}

export async function rankCandidates(cfg, seed, others, same) {
  const line = (c) =>
    `${c.id} | "${c.title}" — ${c.artist}${c.lastfmMatch ? ` | listener-similarity ${Math.round(c.lastfmMatch * 100)}%` : ""}${c.popularityRank ? ` | popularity rank #${c.popularityRank}` : ""}`;

  const prompt = `You are a world-class musicologist. The user loves "${seed.title}" by ${seed.artist}${seed.tags?.length ? ` (tags: ${seed.tags.join(", ")})` : ""}.

Below are REAL tracks pulled from Last.fm and Deezer listening data. You may ONLY choose from these ids.

OTHER-ARTIST CANDIDATES:
${others.map(line).join("\n") || "(none)"}

SAME-ARTIST CANDIDATES (${seed.artist}):
${same.map(line).join("\n") || "(none)"}

Return:
- query: a 2-sentence description of "${seed.title}"'s sonic identity and mood, its primary genre, and original release year.
- matches: the 6 best sonic matches from OTHER-ARTIST candidates, each by a different artist; include at least 2 from a different genre if available. Use listener-similarity as a strong hint but judge the actual sound.
- sameArtistMatches: the 5 best from SAME-ARTIST candidates that share the seed's sonic DNA. Prefer deep cuts (higher popularity rank number) over the biggest hits; set hiddenGem true for obscure picks.
For each pick: its id, 1–2 sentences on why it matches (specific: tempo, instrumentation, production, vocal style, mood), matchScore 50–99, original release year if you know it, and which dimensions match.`;

  return generate(cfg, prompt, RANK_SCHEMA);
}

// Last resort for very obscure songs with no listening data: ask Gemini for
// suggestions, which the caller then verifies against Deezer (unverified ones are dropped).
export async function suggestTracks(cfg, title, artist) {
  const prompt = `List 14 real, released songs by OTHER artists that sound similar to "${title}" by ${artist}, and 8 other real songs by ${artist} with similar sound. Only include songs you are certain exist. Put the other-artist songs first.`;
  return generate(cfg, prompt, SUGGEST_SCHEMA, 0.5);
}
