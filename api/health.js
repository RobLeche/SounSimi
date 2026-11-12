import { healthHandler } from "../server/handlers.js";

export default function handler(req, res) {
  return healthHandler(req, res, process.env);
}
