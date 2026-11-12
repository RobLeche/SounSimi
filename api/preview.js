import { previewHandler } from "../server/handlers.js";

export default function handler(req, res) {
  return previewHandler(req, res, process.env);
}
