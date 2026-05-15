import { useState, useRef } from "react";

// Your API key lives in Vercel's environment variables — never hardcoded here
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

const MATCH_TAGS = {
  sound: { label: "Sound", color: "#FF6B6B" },
  instruments: { label: "Instruments", color: "#4ECDC4" },
  emotion: { label: "Emotion", color: "#FFE66D" },
  lyrics: { label: "Lyrics", color: "#A8E6CF" },
  energy: { label: "Energy", color: "#FF8B94" },
};

const WaveformIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
    <rect x="2" y="10" width="3" height="12" rx="1.5" fill="currentColor" opacity="0.6"/>
    <rect x="7" y="6" width="3" height="20" rx="1.5" fill="currentColor"/>
    <rect x="12" y="3" width="3" height="26" rx="1.5" fill="currentColor"/>
    <rect x="17" y="7" width="3" height="18" rx="1.5" fill="currentColor"/>
    <rect x="22" y="11" width="3" height="10" rx="1.5" fill="currentColor" opacity="0.8"/>
    <rect x="27" y="14" width="3" height="4" rx="1.5" fill="currentColor" opacity="0.5"/>
  </svg>
);

const SpinnerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ animation: "spin 1s linear infinite" }}>
    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" strokeDasharray="40" strokeDashoffset="10" strokeLinecap="round"/>
  </svg>
);

const GemIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
    <line x1="12" y1="22" x2="12" y2="15.5"/>
    <polyline points="22 8.5 12 15.5 2 8.5"/>
  </svg>
);

const SpotifyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const AppleMusicIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.064-2.31-2.16-3.09a5.33 5.33 0 00-1.5-.66c-.538-.144-1.09-.216-1.64-.24-.114-.012-.73-.024-.88-.024H6.326c-.698 0-1.082.012-1.396.036-.41.036-.84.108-1.24.228C2.42 1.01 1.39 1.81.86 3.01a5.51 5.51 0 00-.43 1.44 12.63 12.63 0 00-.18 1.64c-.012.114-.018.73-.018.878v11.347c0 .698.006 1.082.03 1.396.03.41.1.84.22 1.24.318 1.27 1.12 2.3 2.32 2.83.538.24 1.1.37 1.67.4.41.03.84.04 1.24.04h11.348c.698 0 1.082-.01 1.396-.04.41-.03.84-.1 1.24-.22 1.27-.318 2.3-1.12 2.83-2.32.24-.538.37-1.1.4-1.67.03-.41.04-.84.04-1.24V7.002c0-.149-.006-.766-.018-.878zM16.77 8.26l-5.23 1.56v5.89c0 .93-.24 1.72-.77 2.3-.53.59-1.3.9-2.16.9-.87 0-1.58-.32-2.1-.88-.52-.56-.77-1.27-.77-2.05 0-.78.28-1.44.83-1.96.55-.52 1.28-.78 2.15-.78.38 0 .73.05 1.06.15V7.06c0-.49.32-.92.8-1.04l5.55-1.66c.62-.18 1.25.27 1.25.91v1.98c0 .52-.36.97-.88 1.01l.24-.01z"/>
  </svg>
);

function openSpotify(song, artist) {
  const query = encodeURIComponent(`${song} ${artist}`);
  window.open(`https://open.spotify.com/search/${query}`, "_blank");
}

function openAppleMusic(song, artist) {
  const query = encodeURIComponent(`${song} ${artist}`);
  window.open(`https://music.apple.com/search?term=${query}`, "_blank");
}

function PlayButtons({ song, artist }) {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
      <button
        onClick={() => openSpotify(song, artist)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "rgba(30,215,96,0.12)", border: "1px solid rgba(30,215,96,0.25)",
          borderRadius: 8, padding: "6px 12px", cursor: "pointer",
          fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 500,
          color: "#1ED760", transition: "all 0.2s", letterSpacing: "0.3px",
        }}
      >
        <SpotifyIcon /> Spotify
      </button>
      <button
        onClick={() => openAppleMusic(song, artist)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "rgba(252,60,68,0.12)", border: "1px solid rgba(252,60,68,0.25)",
          borderRadius: 8, padding: "6px 12px", cursor: "pointer",
          fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 500,
          color: "#FC3C44", transition: "all 0.2s", letterSpacing: "0.3px",
        }}
      >
        <AppleMusicIcon /> Apple Music
      </button>
    </div>
  );
}

function MatchCard({ match, index, accentColor, badgeBg, badgeBorder }) {
  return (
    <div
      className="match-card card-in"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16, padding: "18px", marginBottom: 12,
        animationDelay: `${index * 0.08}s`, opacity: 0,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 700, marginBottom: 2 }}>
            {match.song}
          </div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "#8A8070" }}>
            {match.artist} · {match.year}
          </div>
        </div>
        <div style={{
          background: badgeBg, border: `1px solid ${badgeBorder}`,
          borderRadius: 8, padding: "4px 10px",
          fontFamily: "'DM Sans',sans-serif", fontSize: 13,
          color: accentColor, fontWeight: 500, flexShrink: 0, marginLeft: 12,
        }}>
          {match.matchScore}%
        </div>
      </div>

      <div style={{ height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 1, marginBottom: 10, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${match.matchScore}%`, background: `linear-gradient(90deg, ${accentColor}, #E8D5A3)`, borderRadius: 1 }}/>
      </div>

      <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "#A89880", lineHeight: 1.6, marginBottom: 10 }}>
        {match.why}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 4 }}>
        {match.hiddenGem && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            background: "rgba(109,207,184,0.1)", border: "1px solid rgba(109,207,184,0.25)",
            borderRadius: 20, padding: "3px 10px",
            fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#6DCFB8",
            letterSpacing: "0.5px", textTransform: "uppercase", fontWeight: 500,
          }}>
            <GemIcon /> Hidden Gem
          </span>
        )}
        {Object.entries(match.tags || {}).map(([key, active]) =>
          active ? (
            <span key={key} style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "3px 10px", borderRadius: 20, fontSize: 11,
              fontFamily: "'DM Sans',sans-serif", fontWeight: 500,
              letterSpacing: "0.5px", textTransform: "uppercase",
              background: `${MATCH_TAGS[key]?.color}18`,
              color: MATCH_TAGS[key]?.color,
              border: `1px solid ${MATCH_TAGS[key]?.color}30`,
            }}>
              {MATCH_TAGS[key]?.label}
            </span>
          ) : null
        )}
      </div>

      <PlayButtons song={match.song} artist={match.artist} />
    </div>
  );
}

export default function App() {
  const [song, setSong] = useState("");
  const [artist, setArtist] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [inputFocus, setInputFocus] = useState(null);
  const [activeTab, setActiveTab] = useState("other");
  const resultsRef = useRef(null);

  const findSimilar = async () => {
    if (!song.trim() || !artist.trim()) return;
    setLoading(true);
    setResults(null);
    setError(null);
    setActiveTab("other");

    const prompt = `You are a world-class musicologist and music critic with encyclopedic knowledge of all genres and eras.

Analyze the song "${song}" by "${artist}" across these dimensions:
- Sound texture & production style
- Instrumentation & arrangement
- Emotional tone & mood
- Lyrical themes & storytelling
- Energy level & tempo feel
- Vocal style

Return ONLY a valid JSON object. No markdown, no backticks, no extra text. Use this exact structure:

{
  "query": {
    "song": "${song}",
    "artist": "${artist}",
    "description": "2-sentence description of this song's sonic identity, mood, and defining qualities"
  },
  "matches": [
    {
      "song": "Song Title",
      "artist": "Different Artist Name",
      "year": 1990,
      "why": "1-2 sentences on why this is a strong sonic/emotional match",
      "tags": { "sound": true, "instruments": false, "emotion": true, "lyrics": false, "energy": true },
      "matchScore": 85
    }
  ],
  "sameArtistMatches": [
    {
      "song": "Another Song Title",
      "artist": "${artist}",
      "year": 1995,
      "why": "1-2 sentences explaining how this deep cut shares the same sonic DNA",
      "hiddenGem": true,
      "tags": { "sound": true, "instruments": true, "emotion": false, "lyrics": true, "energy": false },
      "matchScore": 78
    }
  ]
}

Rules:
- "matches": exactly 6 songs from DIFFERENT artists. At least 2 from a different genre. Cross-genre surprises encouraged.
- "sameArtistMatches": exactly 5 songs ALL by "${artist}". Focus on deep cuts, B-sides, overlooked album tracks NOT their biggest hits. Set "hiddenGem": true for genuinely obscure picks. Be honest with matchScore.`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await response.json();
      const text = data.content?.map(i => i.text || "").join("") || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setResults(parsed);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (err) {
      setError("Couldn't find matches — check the song/artist spelling and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => { if (e.key === "Enter") findSimilar(); };
  const reset = () => { setResults(null); setSong(""); setArtist(""); setError(null); };

  const tabStyle = (tab) => ({
    flex: 1, padding: "10px 12px",
    fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 500,
    border: "none", borderRadius: 10, cursor: "pointer", transition: "all 0.2s",
    background: activeTab === tab
      ? (tab === "other" ? "rgba(200,149,42,0.2)" : "rgba(109,207,184,0.15)")
      : "transparent",
    color: activeTab === tab ? (tab === "other" ? "#C8952A" : "#6DCFB8") : "#5A5450",
    letterSpacing: "0.3px",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0F", fontFamily: "Georgia, serif", color: "#E8E4DC", position: "relative", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        .card-in { animation: fadeUp 0.5s ease forwards; }
        .orb { position:absolute; border-radius:50%; filter:blur(80px); pointer-events:none; }
        input:focus { outline: none; }
        .match-card { transition: transform 0.2s ease; }
        .match-card:hover { transform: translateY(-2px) !important; }
        .search-btn:hover:not(:disabled) { background: #D4A843 !important; }
        .search-btn:active:not(:disabled) { transform: scale(0.98); }
      `}</style>

      <div className="orb" style={{ width:500, height:500, background:"rgba(180,120,40,0.12)", top:-100, right:-100 }}/>
      <div className="orb" style={{ width:400, height:400, background:"rgba(80,60,140,0.15)", bottom:-80, left:-80 }}/>

      {/* Header */}
      <div style={{ padding: "40px 24px 0", textAlign: "center" }}>
        <div style={{ color: "#C8952A", marginBottom: 12, animation: "float 4s ease-in-out infinite" }}>
          <WaveformIcon />
        </div>
        <h1 style={{
          fontFamily: "'Playfair Display', serif", fontSize: "clamp(2rem, 6vw, 3.2rem)",
          fontWeight: 900, letterSpacing: "-1px", lineHeight: 1.1,
          background: "linear-gradient(135deg, #E8D5A3 0%, #C8952A 50%, #E8D5A3 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 10,
        }}>
          SoundSimilar
        </h1>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: "#8A8070", maxWidth: 440, margin: "0 auto" }}>
          Discover songs that share the same soul — across genres, eras, and artists
        </p>
      </div>

      {/* Search box */}
      <div style={{ maxWidth: 580, margin: "36px auto 0", padding: "0 20px" }}>
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(200,149,42,0.2)", borderRadius: 20, padding: 24, backdropFilter: "blur(12px)" }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#8A8070", letterSpacing: "1.5px", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Song Title</label>
            <input
              value={song} onChange={e => setSong(e.target.value)} onKeyDown={handleKey}
              onFocus={() => setInputFocus("song")} onBlur={() => setInputFocus(null)}
              placeholder="e.g. Bohemian Rhapsody"
              style={{
                width: "100%", background: "rgba(255,255,255,0.05)",
                border: `1px solid ${inputFocus === "song" ? "rgba(200,149,42,0.6)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 12, padding: "12px 16px", color: "#E8E4DC",
                fontSize: 16, fontFamily: "'Playfair Display', serif", transition: "border-color 0.2s",
              }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#8A8070", letterSpacing: "1.5px", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Artist</label>
            <input
              value={artist} onChange={e => setArtist(e.target.value)} onKeyDown={handleKey}
              onFocus={() => setInputFocus("artist")} onBlur={() => setInputFocus(null)}
              placeholder="e.g. Queen"
              style={{
                width: "100%", background: "rgba(255,255,255,0.05)",
                border: `1px solid ${inputFocus === "artist" ? "rgba(200,149,42,0.6)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 12, padding: "12px 16px", color: "#E8E4DC",
                fontSize: 16, fontFamily: "'Playfair Display', serif", transition: "border-color 0.2s",
              }}
            />
          </div>
          <button
            className="search-btn" onClick={findSimilar}
            disabled={loading || !song.trim() || !artist.trim()}
            style={{
              width: "100%",
              background: song && artist && !loading ? "#C8952A" : "rgba(255,255,255,0.07)",
              color: song && artist && !loading ? "#0A0A0F" : "#4A4440",
              border: "none", borderRadius: 12, padding: 14, fontSize: 15,
              fontFamily: "'DM Sans',sans-serif", fontWeight: 500,
              cursor: song && artist && !loading ? "pointer" : "not-allowed",
              transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {loading ? <><SpinnerIcon /> Analyzing...</> : "Find Similar Songs →"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ maxWidth: 580, margin: "16px auto 0", padding: "0 20px" }}>
          <div style={{ background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.2)", borderRadius: 12, padding: "12px 16px", fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: "#FF8888" }}>
            {error}
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div ref={resultsRef} style={{ maxWidth: 580, margin: "32px auto 60px", padding: "0 20px" }}>

          {/* Query card */}
          <div className="card-in" style={{
            background: "linear-gradient(135deg, rgba(200,149,42,0.15), rgba(200,149,42,0.05))",
            border: "1px solid rgba(200,149,42,0.3)", borderRadius: 16, padding: 20, marginBottom: 24,
          }}>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#C8952A", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 6 }}>Analyzing</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              "{results.query.song}" <span style={{ color: "#8A8070", fontWeight: 400, fontSize: 16 }}>by {results.query.artist}</span>
            </div>
            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: "#A89880", lineHeight: 1.6, marginBottom: 14 }}>{results.query.description}</p>
            <PlayButtons song={results.query.song} artist={results.query.artist} />
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 4, marginBottom: 20 }}>
            <button style={tabStyle("other")} onClick={() => setActiveTab("other")}>
              🎵 Other Artists ({results.matches?.length || 0})
            </button>
            <button style={tabStyle("same")} onClick={() => setActiveTab("same")}>
              💎 Same Artist ({results.sameArtistMatches?.length || 0})
            </button>
          </div>

          {activeTab === "other" && (
            <div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#5A5450", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 14 }}>
                Songs from different artists with similar sound
              </div>
              {results.matches?.map((match, i) => (
                <MatchCard key={i} match={match} index={i}
                  accentColor="#C8952A" badgeBg="rgba(200,149,42,0.15)" badgeBorder="rgba(200,149,42,0.25)"
                />
              ))}
            </div>
          )}

          {activeTab === "same" && (
            <div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#5A5450", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 6 }}>
                Hidden gems & deep cuts by {results.query.artist}
              </div>
              <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "#5A5450", marginBottom: 16, lineHeight: 1.6 }}>
                Other {results.query.artist} songs that share the same sonic DNA as "{results.query.song}" — tracks most fans have never heard.
              </p>
              {results.sameArtistMatches?.map((match, i) => (
                <MatchCard key={i} match={match} index={i}
                  accentColor="#6DCFB8" badgeBg="rgba(109,207,184,0.12)" badgeBorder="rgba(109,207,184,0.25)"
                />
              ))}
            </div>
          )}

          <button onClick={reset} style={{
            width: "100%", marginTop: 16, background: "transparent",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 12,
            color: "#5A5450", fontFamily: "'DM Sans',sans-serif", fontSize: 14, cursor: "pointer",
          }}>
            Search Again
          </button>
        </div>
      )}
    </div>
  );
}
