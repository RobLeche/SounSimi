// Server-side recommendation logic. Runs in Node (Vite dev/preview middleware
// or a Vercel serverless function) so the Gemini API key never reaches the browser.

const DEFAULT_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-2.5-flash-lite"];
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const trackSchema = (withGem) => ({
  type: "OBJECT",
  properties: {
    song: { type: "STRING" },
    artist: { type: "STRING" },
    year: { type: "INTEGER" },
    why: { type: "STRING" },
    matchScore: { type: "INTEGER" },
    ...(withGem ? { hiddenGem: { type: "BOOLEAN" } } : {}),
    tags: {
      type: "OBJECT",
      properties: {
        sound: { type: "BOOLEAN" },
        instruments: { type: "BOOLEAN" },
        emotion: { type: "BOOLEAN" },
        lyrics: { type: "BOOLEAN" },
        energy: { type: "BOOLEAN" },
      },
      required: ["sound", "instruments", "emotion", "lyrics", "energy"],
    },
  },
  required: ["song", "artist", "year", "why", "matchScore", "tags", ...(withGem ? ["hiddenGem"] : [])],
});

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    query: {
      type: "OBJECT",
      properties: {
        song: { type: "STRING" },
        artist: { type: "STRING" },
        year: { type: "INTEGER" },
        genre: { type: "STRING" },
        description: { type: "STRING" },
      },
      required: ["song", "artist", "description"],
    },
    matches: { type: "ARRAY", items: trackSchema(false) },
    sameArtistMatches: { type: "ARRAY", items: trackSchema(true) },
  },
  required: ["query", "matches", "sameArtistMatches"],
};

function buildPrompt(song, artist) {
  return `You are a world-class musicologist with encyclopedic knowledge of every genre and era.
Analyze the song "${song}" by "${artist}". If the spelling is slightly off, use the correctly spelled real title and artist.

Return:
- query: the corrected song and artist, release year, primary genre, and a 2-sentence description of its sonic identity and mood.
- matches: exactly 6 REAL, released songs by DIFFERENT artists that sound similar. At least 2 must come from a different genre. For each: one or two sentences on why it matches, a matchScore from 50-99, and which dimensions match (sound, instruments, emotion, lyrics, energy).
- sameArtistMatches: exactly 5 other REAL songs by "${artist}" with the same sonic DNA. Prefer deep cuts and album tracks over the biggest hits; set hiddenGem true for obscure picks.

Only include songs you are confident actually exist. Never invent titles. Sort each list by matchScore, highest first.`;
}

function geminiErrorToApiError(status, body) {
  const msg = body?.error?.message || `Gemini returned HTTP ${status}`;
  if (status === 400 && /api key/i.test(msg)) return new ApiError(401, "invalid_key", "Your Gemini API key was rejected. Create a new one at aistudio.google.com/apikey.");
  if (status === 403) return new ApiError(403, "forbidden", "The Gemini API key isn't allowed to call this model. Check the key's restrictions in Google AI Studio.");
  if (status === 429) return new ApiError(429, "rate_limited", "Gemini rate limit / free-tier quota hit. Wait a minute and try again.");
  if (status === 404) return new ApiError(404, "model_not_found", msg);
  return new ApiError(502, "upstream_error", msg);
}

async function callGemini({ apiKey, model, prompt }) {
  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
    signal: AbortSignal.timeout(45_000),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) throw geminiErrorToApiError(res.status, body);

  const candidate = body?.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text || "").join("") || "";
  if (!text) {
    const reason = candidate?.finishReason || body?.promptFeedback?.blockReason || "empty response";
    throw new ApiError(502, "empty_response", `Gemini returned no content (${reason}).`);
  }
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    throw new ApiError(502, "bad_json", `Gemini's answer couldn't be parsed (finish reason: ${candidate?.finishReason || "unknown"}).`);
  }
}

// Look up artwork, a 30-second preview and an Apple Music link via the free iTunes Search API.
async function lookupTrack(song, artist) {
  try {
    const url = `https://itunes.apple.com/search?media=music&entity=song&limit=1&term=${encodeURIComponent(`${song} ${artist}`)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const hit = (await res.json())?.results?.[0];
    if (!hit) return null;
    return {
      artwork: hit.artworkUrl100?.replace("100x100bb", "300x300bb") || null,
      previewUrl: hit.previewUrl || null,
      appleUrl: hit.trackViewUrl || null,
      verified: true,
    };
  } catch {
    return null;
  }
}

async function enrich(track) {
  const extra = await lookupTrack(track.song, track.artist);
  return { ...track, ...(extra || { verified: false }) };
}

export async function recommend({ song, artist, env = process.env }) {
  song = String(song || "").trim().slice(0, 200);
  artist = String(artist || "").trim().slice(0, 200);
  if (!song || !artist) throw new ApiError(400, "bad_request", "Please enter both a song and an artist.");

  const apiKey = env.GEMINI_API_KEY || env.GOOGLE_API_KEY || env.VITE_GOOGLE_API_KEY;
  if (!apiKey) {
    throw new ApiError(500, "missing_key", "No Gemini API key configured on the server. Add GEMINI_API_KEY to your .env file (local) or your hosting provider's environment variables.");
  }

  const models = env.GEMINI_MODEL ? [env.GEMINI_MODEL, ...DEFAULT_MODELS] : DEFAULT_MODELS;
  const prompt = buildPrompt(song, artist);
  let data;
  let usedModel;
  let lastErr;
  for (const model of [...new Set(models)]) {
    try {
      data = await callGemini({ apiKey, model, prompt });
      usedModel = model;
      break;
    } catch (err) {
      lastErr = err;
      // Only fall through to the next model when this one is unavailable.
      if (!(err instanceof ApiError) || err.code !== "model_not_found") throw err;
    }
  }
  if (!data) throw lastErr || new ApiError(502, "upstream_error", "No Gemini model was available.");

  const sortByScore = (list) => (Array.isArray(list) ? list : []).sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
  const [queryExtra, matches, sameArtistMatches] = await Promise.all([
    lookupTrack(data.query?.song || song, data.query?.artist || artist),
    Promise.all(sortByScore(data.matches).map(enrich)),
    Promise.all(sortByScore(data.sameArtistMatches).map(enrich)),
  ]);

  return {
    query: { song, artist, ...data.query, ...(queryExtra || {}) },
    matches,
    sameArtistMatches,
    model: usedModel,
  };
}

// Shared Node (req, res) handler used by both the Vite middleware and Vercel.
export async function handleRecommend(req, res, env = process.env) {
  const send = (status, payload) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(payload));
  };
  if (req.method !== "POST") return send(405, { error: "Method not allowed", code: "method_not_allowed" });

  try {
    let body = req.body;
    if (!body || typeof body === "string") {
      let raw = typeof body === "string" ? body : "";
      if (!raw) for await (const chunk of req) raw += chunk;
      body = raw ? JSON.parse(raw) : {};
    }
    const result = await recommend({ song: body.song, artist: body.artist, env });
    send(200, result);
  } catch (err) {
    if (err instanceof ApiError) return send(err.status, { error: err.message, code: err.code });
    if (err?.name === "TimeoutError") return send(504, { error: "Gemini took too long to respond. Try again.", code: "timeout" });
    console.error("[recommend]", err);
    send(500, { error: "Unexpected server error.", code: "internal" });
  }
}
