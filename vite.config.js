import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { routes } from "./server/handlers.js";

// Serves the /api/* routes during `npm run dev` and `npm run preview`
// (on Vercel the files in /api are deployed as serverless functions instead).
function apiPlugin(env) {
  const mount = (server) => {
    server.middlewares.use((req, res, next) => {
      const path = (req.url || "").split("?")[0];
      const handler = routes[path];
      if (!handler) return next();
      return handler(req, res, env);
    });
  };
  return { name: "soundsimilar-api", configureServer: mount, configurePreviewServer: mount };
}

export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), "") };
  return {
    plugins: [react(), apiPlugin(env)],
    // Spotify no longer accepts "localhost" redirect URIs — use 127.0.0.1.
    server: { host: "127.0.0.1", port: 5173 },
    preview: { host: "127.0.0.1", port: 4173 },
  };
});
