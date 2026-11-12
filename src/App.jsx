import { useCallback, useEffect, useRef, useState } from "react";
import { fetchConfig, fetchPopular, fetchRecommendations, loadRecent, previewUrl, saveRecent } from "./api.js";
import { readUrlState, shareResults, syncUrl, tracklistText } from "./lib/share.js";
import { completeSpotifyLogin, savePlaylist, startSpotifySave } from "./lib/spotify.js";
import { prepareAppleMusic, saveToAppleMusic } from "./lib/appleMusic.js";
import Artwork from "./components/Artwork.jsx";
import MatchCard, { SOURCE_LABELS } from "./components/MatchCard.jsx";
import SearchBox from "./components/SearchBox.jsx";
import TrackLinks from "./components/TrackLinks.jsx";
import { AppleMusicIcon, CopyIcon, ShareIcon, SpinnerIcon, SpotifyIcon, WaveformIcon } from "./components/Icons.jsx";

const EXAMPLES = [
  { song: "Dreams", artist: "Fleetwood Mac" },
  { song: "Redbone", artist: "Childish Gambino" },
  { song: "Midnight City", artist: "M83" },
  { song: "Pink + White", artist: "Frank Ocean" },
];

const ERROR_HINTS = {
  not_found: "Pick the song from the dropdown so we search the exact catalog entry.",
  network: "Check your connection, or start the app with `npm run dev` so the /api routes are available.",
  timeout: "One of the music services was slow. Trying again usually works.",
};

function SkeletonCard({ i }) {
  return (
    <div className="glass card skeleton" style={{ animationDelay: `${i * 0.1}s` }}>
      <div className="sk sk-art" />
      <div className="sk-lines">
        <div className="sk sk-line" style={{ width: "60%" }} />
        <div className="sk sk-line" style={{ width: "35%" }} />
        <div className="sk sk-line" style={{ width: "85%" }} />
      </div>
    </div>
  );
}

function ChipRow({ label, items, onPick }) {
  if (!items.length) return null;
  return (
    <div className="chips">
      <span className="chips-label">{label}</span>
      {items.map((ex) => (
        <button type="button" key={`${ex.song}-${ex.artist}`} className="chip" onClick={() => onPick(ex)}>
          {ex.song} <em>· {ex.artist}</em>
        </button>
      ))}
    </div>
  );
}

const playlistFrom = (results) => ({
  name: `SoundSimilar: ${results.query.song} – ${results.query.artist}`,
  description: `Songs that sound like "${results.query.song}" by ${results.query.artist}, found with SoundSimilar.`,
  tracks: [results.query, ...results.matches, ...results.sameArtistMatches].map((t) => ({ song: t.song, artist: t.artist })),
});

export default function App() {
  const [current, setCurrent] = useState(() => readUrlState());
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(() => readUrlState()?.tab || "other");
  const [recent, setRecent] = useState(loadRecent);
  const [popular, setPopular] = useState([]);
  const [config, setConfig] = useState({});
  const [playingUrl, setPlayingUrl] = useState(null);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(null);
  const audioRef = useRef(null);
  const abortRef = useRef(null);
  const resultsRef = useRef(null);
  const toastTimer = useRef(null);

  const notify = useCallback((message, opts = {}) => {
    clearTimeout(toastTimer.current);
    setToast({ message, ...opts });
    toastTimer.current = setTimeout(() => setToast(null), opts.link ? 9000 : 4500);
  }, []);

  const search = useCallback(async ({ song, artist }, { push = true, tab = "other" } = {}) => {
    song = song?.trim();
    artist = artist?.trim();
    if (!song || !artist) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setCurrent({ song, artist });
    setLoading(true);
    setError(null);
    setResults(null);
    setActiveTab(tab);
    audioRef.current?.pause();
    setPlayingUrl(null);
    if (push) syncUrl({ song, artist, tab });

    try {
      const data = await fetchRecommendations(song, artist, controller.signal);
      setResults(data);
      setCurrent({ song: data.query.song, artist: data.query.artist });
      syncUrl({ song: data.query.song, artist: data.query.artist, tab }, { replace: true });
      setRecent((cur) => saveRecent({ song: data.query.song, artist: data.query.artist }, cur));
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (err) {
      if (err.name !== "AbortError") setError({ message: err.message, code: err.code });
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  }, []);

  // Startup: config, popular list, return from Spotify login, shared links.
  useEffect(() => {
    let alive = true;
    fetchPopular().then((p) => alive && setPopular(p));
    fetchConfig().then(async (cfg) => {
      if (!alive) return;
      setConfig(cfg);
      if (!cfg.spotifyClientId) return;
      const params = new URLSearchParams(window.location.search);
      const returningFromSpotify = params.has("state") && (params.has("code") || params.has("error"));
      try {
        const done = await completeSpotifyLogin(cfg.spotifyClientId);
        // completeSpotifyLogin restored the pre-login URL — reload those results.
        const restored = returningFromSpotify && readUrlState();
        if (restored) search(restored, { push: false, tab: restored.tab });
        if (done?.pending) {
          setSaving("spotify");
          const r = await savePlaylist(done.token, done.pending);
          notify(`Saved ${r.added} songs to Spotify${r.missing ? ` (${r.missing} not found)` : ""}.`, { link: r.url, linkLabel: "Open playlist" });
        }
      } catch (err) {
        notify(err.message, { error: true });
      } finally {
        setSaving(null);
      }
    });

    const initial = readUrlState();
    if (initial) search(initial, { push: false, tab: initial.tab });

    const onPop = () => {
      const s = readUrlState();
      if (s) search(s, { push: false, tab: s.tab });
      else {
        abortRef.current?.abort();
        setResults(null);
        setCurrent(null);
        setError(null);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => {
      alive = false;
      window.removeEventListener("popstate", onPop);
      abortRef.current?.abort();
    };
  }, [search, notify]);

  useEffect(() => {
    if (results && config.appleMusic) prepareAppleMusic().catch(() => {});
  }, [results, config.appleMusic]);

  const togglePreview = (url) => {
    const audio = audioRef.current;
    if (!audio || !url) return;
    if (playingUrl === url) {
      audio.pause();
      setPlayingUrl(null);
      return;
    }
    audio.src = url;
    audio.volume = 0.6;
    audio.play().then(() => setPlayingUrl(url)).catch(() => {
      setPlayingUrl(null);
      notify("Preview isn't available for this track.", { error: true });
    });
  };

  const changeTab = (tab) => {
    setActiveTab(tab);
    if (results) syncUrl({ song: results.query.song, artist: results.query.artist, tab }, { replace: true });
  };

  const reset = () => {
    abortRef.current?.abort();
    audioRef.current?.pause();
    setPlayingUrl(null);
    setResults(null);
    setError(null);
    setCurrent(null);
    syncUrl(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onShare = async () => {
    try {
      const how = await shareResults({ song: results.query.song, artist: results.query.artist, tab: activeTab });
      if (how === "copied") notify("Link copied — anyone who opens it sees these results.");
    } catch {
      notify("Couldn't copy the link.", { error: true });
    }
  };

  const onCopyList = async () => {
    try {
      await navigator.clipboard.writeText(tracklistText(results));
      notify("Tracklist copied. Paste it into TuneMyMusic or Soundiiz to import it into any streaming service.");
    } catch {
      notify("Couldn't copy the tracklist.", { error: true });
    }
  };

  const onSpotify = async () => {
    setSaving("spotify");
    try {
      const r = await startSpotifySave(config.spotifyClientId, playlistFrom(results));
      notify(`Saved ${r.added} songs to Spotify${r.missing ? ` (${r.missing} not found)` : ""}.`, { link: r.url, linkLabel: "Open playlist" });
    } catch (err) {
      notify(err.message, { error: true });
    } finally {
      setSaving(null);
    }
  };

  const onApple = async () => {
    setSaving("apple");
    try {
      const r = await saveToAppleMusic(playlistFrom(results));
      notify(`Saved ${r.added} songs to your Apple Music library${r.missing ? ` (${r.missing} not found)` : ""}.`);
    } catch (err) {
      notify(err?.message || "Apple Music sign-in was cancelled.", { error: true });
    } finally {
      setSaving(null);
    }
  };

  const list = activeTab === "other" ? results?.matches : results?.sameArtistMatches;
  const popularChips = popular.length >= 3 ? popular.slice(0, 6) : EXAMPLES;
  const sourceNames = (results?.meta?.sources || []).map((s) => SOURCE_LABELS[s] || s);

  return (
    <div className="app">
      <div className="bg" aria-hidden="true">
        <span className="blob b1" /><span className="blob b2" /><span className="blob b3" /><span className="blob b4" />
        <div className="noise" />
      </div>
      <audio ref={audioRef} onEnded={() => setPlayingUrl(null)} />

      <header className="hero">
        <button type="button" className="logo" onClick={reset} aria-label="SoundSimilar home"><WaveformIcon /></button>
        <h1>Sound<span>Similar</span></h1>
        <p className="muted">Discover real songs that share the same soul — across genres, eras, and artists.</p>
      </header>

      <main className="container">
        <section className="glass panel search">
          <SearchBox onPick={(t) => search(t)} busy={loading} initial={current} />
          {!results && !loading && (
            <>
              <ChipRow label="Recent" items={recent} onPick={(t) => search(t)} />
              <ChipRow label={popular.length >= 3 ? "Popular" : "Try"} items={popularChips} onPick={(t) => search(t)} />
            </>
          )}
        </section>

        {error && (
          <div className="glass panel error card-in" role="alert">
            <strong>Search failed</strong>
            <p>{error.message}</p>
            {ERROR_HINTS[error.code] && <p className="muted small">{ERROR_HINTS[error.code]}</p>}
          </div>
        )}

        {loading && (
          <section className="results" aria-busy="true">
            {[0, 1, 2].map((i) => <SkeletonCard key={i} i={i} />)}
          </section>
        )}

        {results && (
          <section ref={resultsRef} className="results">
            <div className="glass panel now card-in">
              <Artwork
                track={results.query}
                size={112}
                playing={playingUrl === previewUrl(results.query)}
                onTogglePreview={() => togglePreview(previewUrl(results.query))}
              />
              <div className="now-body">
                <div className="eyebrow">Analyzing</div>
                <h2>{results.query.song}</h2>
                <p className="muted">
                  {results.query.artist}
                  {results.query.year ? ` · ${results.query.year}` : ""}
                  {results.query.genre ? ` · ${results.query.genre}` : ""}
                </p>
                {results.query.description && <p className="desc">{results.query.description}</p>}
                <TrackLinks song={results.query.song} artist={results.query.artist} deezerUrl={results.query.deezerUrl} />
              </div>
            </div>

            <div className="toolbar card-in">
              <button type="button" className="pill pill-ghost" onClick={onShare}><ShareIcon /> Share results</button>
              {config.spotifyClientId && (
                <button type="button" className="pill pill-spotify" onClick={onSpotify} disabled={!!saving}>
                  {saving === "spotify" ? <SpinnerIcon /> : <SpotifyIcon />} Save to Spotify
                </button>
              )}
              {config.appleMusic && (
                <button type="button" className="pill pill-apple" onClick={onApple} disabled={!!saving}>
                  {saving === "apple" ? <SpinnerIcon /> : <AppleMusicIcon />} Save to Apple Music
                </button>
              )}
              <button type="button" className="pill pill-ghost" onClick={onCopyList}><CopyIcon /> Copy tracklist</button>
            </div>

            {results.meta?.aiNotice && <p className="notice">{results.meta.aiNotice}</p>}

            <div className="glass segmented" role="tablist">
              <button role="tab" aria-selected={activeTab === "other"} className={activeTab === "other" ? "on" : ""} onClick={() => changeTab("other")}>
                Other artists <b>{results.matches?.length || 0}</b>
              </button>
              <button role="tab" aria-selected={activeTab === "same"} className={activeTab === "same" ? "on" : ""} onClick={() => changeTab("same")}>
                Deep cuts by {results.query.artist} <b>{results.sameArtistMatches?.length || 0}</b>
              </button>
              <span className="seg-indicator" style={{ transform: `translateX(${activeTab === "other" ? 0 : 100}%)` }} />
            </div>

            <div key={activeTab}>
              {list?.map((m, i) => (
                <MatchCard
                  key={`${m.song}-${m.artist}-${i}`}
                  match={m}
                  index={i}
                  playing={!!previewUrl(m) && playingUrl === previewUrl(m)}
                  onTogglePreview={() => togglePreview(previewUrl(m))}
                  onExplore={(t) => search({ song: t.song, artist: t.artist })}
                />
              ))}
              {!list?.length && <p className="muted center">No matches in this category.</p>}
            </div>

            <button type="button" className="btn-ghost" onClick={reset}>Start a new search</button>
            <p className="footnote">
              Every song is a real catalog track{sourceNames.length ? `, found via ${sourceNames.join(" + ")}` : ""}.
              {results.meta?.model ? ` Ranked and explained by Google Gemini (${results.meta.model}).` : ""} Previews via Deezer.
            </p>
          </section>
        )}
      </main>

      {toast && (
        <div className={`toast glass ${toast.error ? "toast-error" : ""}`} role="status">
          <span>{toast.message}</span>
          {toast.link && <a href={toast.link} target="_blank" rel="noreferrer">{toast.linkLabel || "Open"}</a>}
          <button type="button" aria-label="Dismiss" onClick={() => setToast(null)}>×</button>
        </div>
      )}

      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7cf2ff" />
            <stop offset="100%" stopColor="#c08bff" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
