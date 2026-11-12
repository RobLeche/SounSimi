import { configHandler } from "../server/handlers.js";

export default function handler(req, res) {
  return configHandler(req, res, process.env);
}
