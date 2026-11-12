import Artwork from "./Artwork.jsx";
import TrackLinks from "./TrackLinks.jsx";
import { GemIcon, LoopIcon } from "./Icons.jsx";

export const SOURCE_LABELS = { lastfm: "Last.fm", deezer: "Deezer", gemini: "Gemini (verified on Deezer)" };

export const MATCH_TAGS = {
  sound: { label: "Sound", color: "#ff7a9a" },
  instruments: { label: "Instruments", color: "#5ee7df" },
  emotion: { label: "Emotion", color: "#ffd56b" },
  lyrics: { label: "Lyrics", color: "#a3f7bf" },
  energy: { label: "Energy", color: "#b49cff" },
};

function ScoreRing({ score }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score || 0));
  return (
    <div className="score" title={`${pct}% match`}>
      <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true">
        <circle cx="23" cy="23" r={r} stroke="rgba(255,255,255,0.12)" strokeWidth="4" fill="none" />
        <circle cx="23" cy="23" r={r} stroke="url(#scoreGrad)" strokeWidth="4" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 23 23)" />
      </svg>
      <span>{pct}</span>
    </div>
  );
}

export default function MatchCard({ match, index, playing, onTogglePreview, onExplore }) {
  return (
    <article className="glass card match-card card-in" style={{ animationDelay: `${index * 0.06}s` }}>
      <div className="match-top">
        <Artwork track={match} playing={playing} onTogglePreview={onTogglePreview} />
        <div className="match-meta">
          <h3>
            {match.song}
            <span className="verified" title={`Real track — found via ${(match.sources || []).map((x) => SOURCE_LABELS[x.split("-")[0]] || x).filter((v, i, a) => a.indexOf(v) === i).join(" + ")}`}>✓</span>
          </h3>
          <p className="muted">
            {match.artist}
            {match.year ? ` · ${match.year}` : ""}
          </p>
          <div className="tags">
            {match.hiddenGem && (
              <span className="tag tag-gem"><GemIcon /> Hidden gem</span>
            )}
            {Object.entries(match.tags || {}).map(([key, on]) =>
              on && MATCH_TAGS[key] ? (
                <span key={key} className="tag" style={{ "--tag": MATCH_TAGS[key].color }}>{MATCH_TAGS[key].label}</span>
              ) : null,
            )}
          </div>
        </div>
        <ScoreRing score={match.matchScore} />
      </div>
      <p className="why">{match.why}</p>
      <div className="card-actions">
        <TrackLinks song={match.song} artist={match.artist} deezerUrl={match.deezerUrl} />
        <button type="button" className="pill pill-ghost" onClick={() => onExplore(match)}>
          <LoopIcon /> More like this
        </button>
      </div>
    </article>
  );
}
