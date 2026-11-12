import { recommendHandler } from "../server/handlers.js";

export default function handler(req, res) {
  return recommendHandler(req, res, process.env);
}
