// Vercel serverless function: POST /api/recommend { song, artist }
import { handleRecommend } from "../server/recommend.js";

export default function handler(req, res) {
  return handleRecommend(req, res, process.env);
}
