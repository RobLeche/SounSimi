// "Save to Apple Music" via MusicKit JS v3. Requires the server to have an
// Apple Developer MusicKit key configured (see README) and the viewer to have
// an Apple Music subscription.

const SCRIPT = "https://js-cdn.music.apple.com/musickit/v3/musickit.js";
let ready = null;

function loadScript() {
  if (window.MusicKit) return Promise.resolve();
  return new Promise((resolve, reject) => {
    document.addEventListener("musickitloaded", () => resolve(), { once: true });
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.dataset.webComponents = "";
    s.onerror = () => reject(new Error("Couldn't load Apple MusicKit."));
    document.head.appendChild(s);
  });
}

// Preload ahead of the click so the sign-in popup isn't blocked.
export function prepareAppleMusic() {
  ready ??= (async () => {
    const res = await fetch("/api/apple-token");
    const { token, error } = await res.json();
    if (!res.ok) throw new Error(error || "Apple Music isn't configured.");
    await loadScript();
    await window.MusicKit.configure({ developerToken: token, app: { name: "SoundSimilar", build: "2.1.0" } });
    return window.MusicKit.getInstance();
  })();
  ready.catch(() => { ready = null; });
  return ready;
}

export async function saveToAppleMusic({ name, description, tracks }) {
  const music = await prepareAppleMusic();
  await music.authorize();
  const sf = music.storefrontId || "us";
  const ids = [];
  for (const t of tracks) {
    try {
      const r = await music.api.music(`/v1/catalog/${sf}/search`, { term: `${t.song} ${t.artist}`, types: "songs", limit: 1 });
      const id = r?.data?.results?.songs?.data?.[0]?.id;
      if (id && !ids.includes(id)) ids.push(id);
    } catch {
      /* skip tracks that can't be found */
    }
  }
  if (!ids.length) throw new Error("None of these songs could be found on Apple Music.");
  await music.api.music("/v1/me/library/playlists", {}, {
    fetchOptions: {
      method: "POST",
      body: JSON.stringify({
        attributes: { name, description },
        relationships: { tracks: { data: ids.map((id) => ({ id, type: "songs" })) } },
      }),
    },
  });
  return { added: ids.length, missing: tracks.length - ids.length };
}
