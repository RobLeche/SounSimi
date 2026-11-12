export const WaveformIcon = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <rect x="2" y="10" width="3" height="12" rx="1.5" fill="currentColor" opacity="0.6" />
    <rect x="7" y="6" width="3" height="20" rx="1.5" fill="currentColor" />
    <rect x="12" y="3" width="3" height="26" rx="1.5" fill="currentColor" />
    <rect x="17" y="7" width="3" height="18" rx="1.5" fill="currentColor" />
    <rect x="22" y="11" width="3" height="10" rx="1.5" fill="currentColor" opacity="0.8" />
    <rect x="27" y="14" width="3" height="4" rx="1.5" fill="currentColor" opacity="0.5" />
  </svg>
);

export const SpinnerIcon = () => (
  <svg className="spin" width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" strokeDasharray="40" strokeDashoffset="10" strokeLinecap="round" />
  </svg>
);

export const GemIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
    <line x1="12" y1="22" x2="12" y2="15.5" />
    <polyline points="22 8.5 12 15.5 2 8.5" />
  </svg>
);

export const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.6-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14z" /></svg>
);

export const PauseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
);

export const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);

export const SpotifyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

export const AppleMusicIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16.77 8.26l-5.23 1.56v5.89c0 .93-.24 1.72-.77 2.3-.53.59-1.3.9-2.16.9-.87 0-1.58-.32-2.1-.88-.52-.56-.77-1.27-.77-2.05 0-.78.28-1.44.83-1.96.55-.52 1.28-.78 2.15-.78.38 0 .73.05 1.06.15V7.06c0-.49.32-.92.8-1.04l5.55-1.66c.62-.18 1.25.27 1.25.91v1.98c0 .52-.36.97-.88 1.01z" />
  </svg>
);

export const YouTubeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z" />
  </svg>
);

export const LoopIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 2l4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></svg>
);
