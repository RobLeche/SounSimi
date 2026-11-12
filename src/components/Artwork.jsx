import { PauseIcon, PlayIcon } from "./Icons.jsx";

// Deterministic gradient so tracks without artwork still look distinct.
function hue(text) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export default function Artwork({ track, size = 72, playing, onTogglePreview }) {
  const h = hue(`${track.song}${track.artist}`);
  return (
    <div className="art" style={{ width: size, height: size }}>
      {track.artwork ? (
        <img src={track.artwork} alt="" loading="lazy" />
      ) : (
        <div className="art-fallback" style={{ background: `linear-gradient(135deg, hsl(${h} 80% 60%), hsl(${(h + 60) % 360} 80% 45%))` }} />
      )}
      {track.previewUrl && (
        <button
          type="button"
          className={`art-play ${playing ? "is-playing" : ""}`}
          onClick={onTogglePreview}
          aria-label={playing ? `Pause preview of ${track.song}` : `Play 30-second preview of ${track.song}`}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
      )}
    </div>
  );
}
