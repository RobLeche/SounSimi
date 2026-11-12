# SoundSimilar

Find **real** songs that share the same soul as one you love, across genres, eras and artists. Start typing, pick a real track from the autocomplete, and get:

- **6 sonic matches by other artists** and **5 deep cuts by the same artist**
- 30-second previews, artwork, match scores and the reason each song matches
- Links to Spotify, Apple Music, YouTube Music and Deezer
- **Save as a playlist** to Spotify or Apple Music, or copy the tracklist
- **Shareable links**: every result page has its own URL (`?song=…&artist=…`)

## How it finds real songs (not made-up ones)

```
 your pick ──► Deezer (resolve the exact track)
                 │
                 ├─► Last.fm track.getSimilar      "listeners who play X also play Y"
                 ├─► Deezer artist radio            similar-sounding mix
                 ├─► Deezer related artists → top tracks
                 └─► Deezer + Last.fm artist top tracks (for deep cuts)
                          │
                          ▼
             ~40 real candidate tracks (each has an id)
                          │
                          ▼
   Gemini ranks + explains them ── it can ONLY return ids from the list,
                                    so it can't invent songs
```

- With **no Gemini key** (or once the free quota runs out), the app still works. It ranks by listening data and shows a notice instead of failing.
- For very obscure songs with no listening data, Gemini suggests songs, and **only those found on Deezer are kept**.

## Setup

```bash
npm install
cp .env.example .env   # fill in keys
npm run dev            # → http://127.0.0.1:5173
```

| Variable | Needed? | Where to get it |
|---|---|---|
| `GEMINI_API_KEY` | For AI explanations | <https://aistudio.google.com/apikey> (free) |
| `LASTFM_API_KEY` | Strongly recommended | <https://www.last.fm/api/account/create> (free, instant) |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Optional cache | Vercel → Storage → **Upstash for Redis** (free tier). Added automatically when connected |
| `SPOTIFY_CLIENT_ID` | Optional | <https://developer.spotify.com/dashboard> |
| `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | Optional | Apple Developer → Keys → MusicKit (paid account) |

Deezer and iTunes need no key.

## Deploying on Vercel

1. **Settings → Environment Variables**: add `GEMINI_API_KEY` and `LASTFM_API_KEY`. Tick **Production and Preview**.
2. **Redeploy.** Vercel only gives variables to deployments made after you add them. Go to Deployments → ⋯ → Redeploy.
3. Open **`https://<your-app>.vercel.app/api/health`**. It lists which keys the server can see (never their values) and what's missing.

## Caching (saves your free quota)

1. **Vercel's CDN** caches every `/api/recommend?song=…&artist=…` response for a day, then serves it stale for up to a week while refreshing in the background. Popular searches never reach the function or Gemini.
2. **Upstash Redis** (optional, free tier) stores AI results for 30 days, shared across all server instances.
3. **In-memory cache** inside each running function.

Results ranked without AI are cached for only an hour, so they're upgraded once Gemini is available again. The home screen shows **Popular** searches, tracked in Redis when it's connected.

## Save to Spotify

1. Create an app at <https://developer.spotify.com/dashboard> and choose **Web API**.
2. Add these Redirect URIs exactly (with the trailing slash):
   - `https://<your-app>.vercel.app/`
   - `http://127.0.0.1:5173/` (Spotify no longer accepts `localhost`)
3. Put the Client ID in `SPOTIFY_CLIENT_ID`. It isn't secret, and no client secret is needed (PKCE login).
4. **Spotify's 2026 limits for unapproved ("Development Mode") apps:** the app owner needs **Spotify Premium**, and only **5 users** can log in. Add them under *User Management* in the dashboard. Allowing everyone requires applying for Extended Quota, which Spotify only grants to established businesses. For everyone else, **Copy tracklist** works: paste it into TuneMyMusic or Soundiiz to import it anywhere.

## Save to Apple Music

1. Requires the **Apple Developer Program** ($99/yr).
2. Create a **Media ID**, then a **Key** with MusicKit enabled. Download the `.p8` file.
3. Set `APPLE_TEAM_ID`, `APPLE_KEY_ID` and `APPLE_PRIVATE_KEY` (the whole `.p8` contents; `\n` line breaks are fine). Optionally set `APPLE_ALLOWED_ORIGINS` to your domain.
4. The server signs a MusicKit developer token at `/api/apple-token`. Listeners need an Apple Music subscription, and the playlist goes into their library.

The button only appears when this is configured.

## Free music data sources

| Source | Key | Good for | Used here |
|---|---|---|---|
| **Last.fm API** | free key | Similar tracks and artists from real listening data, tags, top tracks | ✅ |
| **Deezer API** | none | Search/autocomplete, artist radio (similar mix), related artists, 30 s previews, artwork, ISRCs | ✅ |
| **iTunes Search API** | none | Search fallback, artwork, previews (~20 req/min limit) | ✅ fallback |
| **ListenBrainz** (labs API) | none | Open similar-artist and similar-recording data from scrobbles | Good next addition |
| **MusicBrainz** | none (1 req/s, needs a User-Agent) | Canonical IDs, release dates, ISRC lookups | Good for exact years |
| **TheAudioDB** | free test key | Artist bios, genres, mood, artwork | Nice extra |
| **Discogs** | free token | Release details, credits, styles (great for vinyl and older music) | Nice extra |
| **Spotify Web API** | OAuth | Saving playlists and deep links only. Its recommendations, related artists and audio features were removed for new apps | ✅ playlists |
| ~~AcousticBrainz~~ | — | Shut down in 2022 | ❌ |

## API routes

| Route | What it does |
|---|---|
| `GET /api/recommend?song=&artist=` | Recommendations (CDN-cacheable) |
| `GET /api/search?q=` | Autocomplete (real catalog tracks) |
| `GET /api/preview?id=` | Redirects to a fresh Deezer preview |
| `GET /api/popular` | Most-searched songs |
| `GET /api/config` | Which optional features are on |
| `GET /api/apple-token` | MusicKit developer token |
| `GET /api/health` | Configuration diagnostics |

## Project layout

```
api/                 Vercel functions (thin wrappers)
server/handlers.js   Route handlers + caching headers
server/recommend.js  Candidate gathering, ranking, fallbacks
server/gemini.js     Gemini ranking (constrained to real candidate ids)
server/sources/      Deezer, Last.fm, iTunes clients
server/cache.js      Memory + Upstash Redis cache, popular searches
src/                 React app (SearchBox autocomplete, results, playlists, sharing)
```
