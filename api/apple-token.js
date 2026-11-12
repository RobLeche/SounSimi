import { appleTokenHandler } from "../server/handlers.js";

export default function handler(req, res) {
  return appleTokenHandler(req, res, process.env);
}
