// "Save to Spotify" using Authorization Code + PKCE (no client secret needed).
// Note: Spotify apps in Development Mode are limited to 5 allow-listed users
// and the app owner needs Spotify Premium (Feb 2026 policy).

const AUTH = "https://accounts.spotify.com";
const API = "https://api.spotify.com/v1";
const SCOPES = "playlist-modify-private playlist-modify-public";
const K = { verifier: "sp:verifier", state: "sp:state", pending: "sp:pending", token: "sp:token" };

const redirectUri = () => `${window.location.origin}/`;
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const randomString = (n = 64) => b64url(crypto.getRandomValues(new Uint8Array(n))).slice(0, n);
const ss = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } },
  del: (k) => { try { sessionStorage.removeItem(k); } catch { /* ignore */ } },
};

function storedToken() {
  try {
    const t = JSON.parse(ss.get(K.token) || "null");
    return t && t.expiresAt > Date.now() + 60_000 ? t.accessToken : null;
  } catch {
    return null;
  }
}

export async function startSpotifySave(clientId, playlist) {
  const token = storedToken();
  if (token) return savePlaylist(token, playlist);

  const verifier = randomString(64);
  const state = randomString(16);
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  ss.set(K.verifier, verifier);
  ss.set(K.state, state);
  ss.set(K.pending, JSON.stringify({ ...playlist, returnUrl: window.location.href }));
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: challenge,
    redirect_uri: redirectUri(),
    state,
  });
  window.location.assign(`${AUTH}/authorize?${params}`);
  return new Promise(() => {}); // navigating away
}

// Call on page load. Returns the pending playlist if we just came back from Spotify.
export async function completeSpotifyLogin(clientId) {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");
  if (!code && !error) return null;
  if (!state || state !== ss.get(K.state)) return null; // not our redirect

  const pending = JSON.parse(ss.get(K.pending) || "null");
  window.history.replaceState(null, "", pending?.returnUrl || "/");
  ss.del(K.state);
  if (error) throw new Error(error === "access_denied" ? "Spotify access was cancelled." : `Spotify login failed (${error}).`);

  const res = await fetch(`${AUTH}/api/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      client_id: clientId,
      code_verifier: ss.get(K.verifier) || "",
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Spotify login failed: ${body.error_description || body.error || res.status}`);
  ss.set(K.token, JSON.stringify({ accessToken: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 }));
  ss.del(K.verifier);
  ss.del(K.pending);
  return pending ? { pending, token: body.access_token } : null;
}

async function api(token, path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (res.status === 401) {
    ss.del(K.token);
    throw new Error("Your Spotify session expired — click Save to Spotify again.");
  }
  if (res.status === 403) {
    throw new Error("Spotify refused access. This app is in Spotify Development Mode, so the app owner must add your Spotify account under User Management in the Spotify developer dashboard (max 5 users).");
  }
  if (res.status === 429) throw new Error("Spotify is rate-limiting requests. Try again in a minute.");
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || `Spotify error ${res.status}`);
  return body;
}

async function findUri(token, { song, artist }) {
  const strict = await api(token, `/search?type=track&limit=1&q=${encodeURIComponent(`track:${song} artist:${artist}`)}`);
  const hit = strict?.tracks?.items?.[0];
  if (hit) return hit.uri;
  const loose = await api(token, `/search?type=track&limit=1&q=${encodeURIComponent(`${song} ${artist}`)}`);
  return loose?.tracks?.items?.[0]?.uri || null;
}

export async function savePlaylist(token, { name, description, tracks }) {
  const uris = [];
  for (const t of tracks) {
    const uri = await findUri(token, t).catch((e) => { if (/refused|rate|expired/.test(e.message)) throw e; return null; });
    if (uri && !uris.includes(uri)) uris.push(uri);
  }
  if (!uris.length) throw new Error("None of these songs could be found on Spotify.");
  const playlist = await api(token, "/me/playlists", {
    method: "POST",
    body: JSON.stringify({ name, description, public: false }),
  });
  await api(token, `/playlists/${playlist.id}/items`, { method: "POST", body: JSON.stringify({ uris }) });
  return { url: playlist.external_urls?.spotify, added: uris.length, missing: tracks.length - uris.length };
}
