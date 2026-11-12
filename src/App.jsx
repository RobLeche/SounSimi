import { useEffect, useRef, useState } from "react";
import { fetchRecommendations, loadRecent, saveRecent } from "./api.js";
import Artwork from "./components/Artwork.jsx";
import MatchCard from "./components/MatchCard.jsx";
import TrackLinks from "./components/TrackLinks.jsx";
import { SearchIcon, SpinnerIcon, WaveformIcon } from "./components/Icons.jsx";

const EXAMPLES = [
  { song: "Dreams", artist: "Fleetwood Mac" },
  { song: "Redbone", artist: "Childish Gambino" },
  { song: "Midnight City", artist: "M83" },
  { song: "Pink + White", artist: "Frank Ocean" },
];

const ERROR_HINTS = {
  missing_key: "Create a free key at aistudio.google.com/apikey, put GEMINI_API_KEY=… in a .env file, and restart the dev server.",
  invalid_key: "Double-check the key in your .env file — no quotes or spaces — then restart the dev server.",
  rate_limited: "The free tier has per-minute limits. Waiting ~60 seconds usually fixes it.",
  model_not_found: "Set GEMINI_MODEL in .env to a current model from ai.google.dev/gemini-api/docs/models.",
  network: "Start the app with `npm run dev` so the /api route is available.",
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

export default function App() {
  const [song, setSong] = useState("");
  const [artist, setArtist] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("other");
  const [recent, setRecent] = useState(loadRecent);
  const [playingUrl, setPlayingUrl] = useState(null);
  const audioRef = useRef(null);
  const abortRef = useRef(null);
  const resultsRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

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
    audio.play().then(() => setPlayingUrl(url)).catch(() => setPlayingUrl(null));
  };

  const search = async (s = song, a = artist) => {
    s = s.trim();
    a = a.trim();
    if (!s || !a) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSong(s);
    setArtist(a);
    setLoading(true);
    setError(null);
    setResults(null);
    setActiveTab("other");
    audioRef.current?.pause();
    setPlayingUrl(null);

    try {
      const data = await fetchRecommendations(s, a, controller.signal);
      setResults(data);
      setRecent((cur) => saveRecent({ song: data.query.song, artist: data.query.artist }, cur));
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (err) {
      if (err.name !== "AbortError") setError({ message: err.message, code: err.code });
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    audioRef.current?.pause();
    setPlayingUrl(null);
    setResults(null);
    setError(null);
    setSong("");
    setArtist("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const list = activeTab === "other" ? results?.matches : results?.sameArtistMatches;
  const canSearch = song.trim() && artist.trim() && !loading;

  return (
    <div className="app">
      <div className="bg" aria-hidden="true">
        <span className="blob b1" /><span className="blob b2" /><span className="blob b3" /><span className="blob b4" />
        <div className="noise" />
      </div>
      <audio ref={audioRef} onEnded={() => setPlayingUrl(null)} />

      <header className="hero">
        <div className="logo"><WaveformIcon /></div>
        <h1>Sound<span>Similar</span></h1>
        <p className="muted">Discover songs that share the same soul — across genres, eras, and artists.</p>
      </header>

      <main className="container">
        <form
          className="glass panel search"
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
        >
          <div className="fields">
            <label className="field">
              <span>Song</span>
              <input value={song} onChange={(e) => setSong(e.target.value)} placeholder="Bohemian Rhapsody" autoComplete="off" />
            </label>
            <label className="field">
              <span>Artist</span>
              <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Queen" autoComplete="off" />
            </label>
          </div>
          <button type="submit" className="btn-primary" disabled={!canSearch}>
            {loading ? <><SpinnerIcon /> Listening closely…</> : <><SearchIcon /> Find similar songs</>}
          </button>

          {!results && !loading && (
            <div className="chips">
              <span className="chips-label">{recent.length ? "Recent" : "Try"}</span>
              {(recent.length ? recent : EXAMPLES).map((ex) => (
                <button type="button" key={`${ex.song}-${ex.artist}`} className="chip" onClick={() => search(ex.song, ex.artist)}>
                  {ex.song} <em>· {ex.artist}</em>
                </button>
              ))}
            </div>
          )}
        </form>

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
                playing={playingUrl === results.query.previewUrl}
                onTogglePreview={() => togglePreview(results.query.previewUrl)}
              />
              <div className="now-body">
                <div className="eyebrow">Analyzing</div>
                <h2>{results.query.song}</h2>
                <p className="muted">
                  {results.query.artist}
                  {results.query.year ? ` · ${results.query.year}` : ""}
                  {results.query.genre ? ` · ${results.query.genre}` : ""}
                </p>
                <p className="desc">{results.query.description}</p>
                <TrackLinks song={results.query.song} artist={results.query.artist} appleUrl={results.query.appleUrl} />
              </div>
            </div>

            <div className="glass segmented" role="tablist">
              <button role="tab" aria-selected={activeTab === "other"} className={activeTab === "other" ? "on" : ""} onClick={() => setActiveTab("other")}>
                Other artists <b>{results.matches?.length || 0}</b>
              </button>
              <button role="tab" aria-selected={activeTab === "same"} className={activeTab === "same" ? "on" : ""} onClick={() => setActiveTab("same")}>
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
                  playing={!!m.previewUrl && playingUrl === m.previewUrl}
                  onTogglePreview={() => togglePreview(m.previewUrl)}
                  onExplore={(t) => search(t.song, t.artist)}
                />
              ))}
              {!list?.length && <p className="muted center">No matches in this category.</p>}
            </div>

            <button type="button" className="btn-ghost" onClick={reset}>Start a new search</button>
            <p className="footnote">
              Recommendations by Google Gemini{results.model ? ` (${results.model})` : ""}. Artwork &amp; previews via iTunes. AI picks can occasionally be off — a ✓ means the track was found in the iTunes catalog.
            </p>
          </section>
        )}
      </main>

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
