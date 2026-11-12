import { searchHandler } from "../server/handlers.js";

export default function handler(req, res) {
  return searchHandler(req, res, process.env);
}
