import { AppleMusicIcon, SpotifyIcon, YouTubeIcon } from "./Icons.jsx";

const q = (song, artist) => encodeURIComponent(`${song} ${artist}`);

export default function TrackLinks({ song, artist, appleUrl }) {
  return (
    <div className="links">
      <a className="pill pill-spotify" href={`https://open.spotify.com/search/${q(song, artist)}`} target="_blank" rel="noreferrer">
        <SpotifyIcon /> Spotify
      </a>
      <a className="pill pill-apple" href={appleUrl || `https://music.apple.com/search?term=${q(song, artist)}`} target="_blank" rel="noreferrer">
        <AppleMusicIcon /> Apple Music
      </a>
      <a className="pill pill-youtube" href={`https://music.youtube.com/search?q=${q(song, artist)}`} target="_blank" rel="noreferrer">
        <YouTubeIcon /> YouTube
      </a>
    </div>
  );
}
