# SoundSimilar

Find songs that share the same soul as one you love, across genres, eras and artists. Each result comes with a match score, why it matches, 30‑second previews and links to Spotify, Apple Music and YouTube Music.

## Why searches were failing

The old version called Google's **`gemini-2.0-flash`** model. **Google shut that model down on June 1, 2026**, so every request now fails. The old code also caught every error and showed one generic "check the spelling" message, which hid the real cause.

The fix:

- The app now uses **`gemini-3.6-flash`** (Google's named replacement). If that model is ever unavailable, it automatically tries `gemini-3.5-flash-lite` and then `gemini-2.5-flash-lite`. You can choose a different model with `GEMINI_MODEL`.
- The API key now stays **on the server** (`/api/recommend`). Before, it was a `VITE_` variable, which Vite builds into the JavaScript bundle, so anyone could copy it from your site.
- Gemini's **structured JSON output** (`responseSchema`) replaces "please return JSON" prompting. The answer can't arrive malformed or cut off halfway.
- **Real error messages:** missing key, rejected key, rate limit, retired model and timeout each get a clear message with a hint for fixing it.

## Run it locally

```bash
npm install
cp .env.example .env      # then paste your key into .env
npm run dev
```

You can get a free Gemini API key at <https://aistudio.google.com/apikey>. Put it in `.env` as `GEMINI_API_KEY=...`. Don't add the `VITE_` prefix: that would expose the key in the browser. The old `VITE_GOOGLE_API_KEY` name still works on the server as a fallback.

## Deploy

The app needs a small server function, so **static-only hosts like GitHub Pages won't work by themselves.**

- **Vercel (easiest):** import the repo, add `GEMINI_API_KEY` under *Settings → Environment Variables*, then deploy. `api/recommend.js` is picked up automatically.
- **Netlify / Cloudflare:** wrap `server/recommend.js`'s `recommend()` in a function for that platform (it's plain Node/fetch).

## Project layout

```
api/recommend.js        Vercel serverless entry point
server/recommend.js     Gemini call, schema, model fallback, iTunes enrichment
vite.config.js          Serves /api/recommend during dev & preview
src/App.jsx             Main UI
src/components/         MatchCard, Artwork (with preview player), TrackLinks, icons
src/styles.css          Glassmorphism theme
```

## Ideas to make it better

1. **Ground results in real listening data.** LLMs sometimes invent songs. Good data sources:
   - **Last.fm API** (free key): `track.getSimilar` and `artist.getSimilar` return real similar tracks based on what millions of people listen to. Combine them with Gemini: get candidates from Last.fm, then have Gemini rank them and explain why each one matches.
   - **ListenBrainz / MusicBrainz** (free, open, no key needed for most reads): similar artists, recordings and canonical IDs.
   - **Deezer API** (no key): related artists, 30‑second previews and artwork.
   - **Spotify Web API:** good for search, artwork and deep links, but Spotify **removed** `recommendations`, `related-artists` and `audio-features` for new apps in late 2024. Don't build on those.
2. **Verify every pick.** The app already checks each song against the iTunes catalog (✓ badge). A next step is to drop or re-ask for any track that isn't found.
3. **Cache results** (Vercel KV, Upstash Redis or Supabase) so popular songs load instantly and use up less of your free Gemini quota.
4. **Rate‑limit `/api/recommend`** per IP so a public deployment can't use up your quota.
5. **Search autocomplete** with the iTunes or Deezer search API, so people pick a real song instead of typing it.
6. **Spotify login** to save results as a playlist with one click.
7. **Filters:** era, "only other genres", energy level, or "only hidden gems".
8. **Shareable result URLs** (`?song=…&artist=…`) and Open Graph images.
