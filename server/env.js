// Reads settings from the environment, tolerating common naming mistakes
// (old VITE_ names, stray quotes or spaces pasted into the Vercel dashboard).

const clean = (v) => (typeof v === "string" ? v.trim().replace(/^["']|["']$/g, "").trim() : "");

const GEMINI_NAMES = ["GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "VITE_GEMINI_API_KEY", "VITE_GOOGLE_API_KEY"];

export function pick(env, names) {
  for (const name of names) {
    const value = clean(env[name]);
    if (value) return { name, value };
  }
  return null;
}

export function config(env = process.env) {
  const gemini = pick(env, GEMINI_NAMES);
  const lastfm = pick(env, ["LASTFM_API_KEY", "LAST_FM_API_KEY"]);
  const redisUrl = pick(env, ["KV_REST_API_URL", "UPSTASH_REDIS_REST_URL"]);
  const redisToken = pick(env, ["KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN"]);
  const spotify = pick(env, ["SPOTIFY_CLIENT_ID", "VITE_SPOTIFY_CLIENT_ID"]);
  const appleTeam = pick(env, ["APPLE_TEAM_ID"]);
  const appleKeyId = pick(env, ["APPLE_KEY_ID"]);
  const appleKey = pick(env, ["APPLE_PRIVATE_KEY"]);
  return {
    geminiKey: gemini?.value || null,
    geminiKeyName: gemini?.name || null,
    geminiModel: clean(env.GEMINI_MODEL) || null,
    lastfmKey: lastfm?.value || null,
    redis: redisUrl && redisToken ? { url: redisUrl.value.replace(/\/$/, ""), token: redisToken.value } : null,
    spotifyClientId: spotify?.value || null,
    apple: appleTeam && appleKeyId && appleKey
      ? { teamId: appleTeam.value, keyId: appleKeyId.value, privateKey: appleKey.value.replace(/\\n/g, "\n") }
      : null,
    seenGeminiNames: GEMINI_NAMES.filter((n) => n in env),
  };
}
