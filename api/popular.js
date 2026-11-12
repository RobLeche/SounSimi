import { popularHandler } from "../server/handlers.js";

export default function handler(req, res) {
  return popularHandler(req, res, process.env);
}
