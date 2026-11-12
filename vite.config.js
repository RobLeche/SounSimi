import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { handleRecommend } from "./server/recommend.js";

// Serves POST /api/recommend during `npm run dev` and `npm run preview`,
// so the Gemini key stays on the server side.
function apiPlugin(env) {
  const mount = (server) => {
    server.middlewares.use("/api/recommend", (req, res) => handleRecommend(req, res, env));
  };
  return { name: "soundsimilar-api", configureServer: mount, configurePreviewServer: mount };
}

export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), "") };
  return { plugins: [react(), apiPlugin(env)] };
});
