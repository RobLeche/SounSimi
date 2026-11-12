export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function sendJson(res, status, payload, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(payload));
}

export function getQuery(req) {
  return Object.fromEntries(new URL(req.url || "/", "http://localhost").searchParams);
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = typeof req.body === "string" ? req.body : "";
  if (!raw) for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

// Wrap a handler so thrown ApiErrors become JSON responses.
export function route(fn) {
  return async (req, res, env = process.env) => {
    try {
      await fn(req, res, env);
    } catch (err) {
      if (err instanceof ApiError) return sendJson(res, err.status, { error: err.message, code: err.code }, { "Cache-Control": "no-store" });
      if (err?.name === "TimeoutError") return sendJson(res, 504, { error: "An upstream music service took too long. Try again.", code: "timeout" }, { "Cache-Control": "no-store" });
      console.error("[api]", err);
      sendJson(res, 500, { error: "Unexpected server error.", code: "internal" }, { "Cache-Control": "no-store" });
    }
  };
}

export async function fetchJson(url, opts = {}, timeout = 8000) {
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(timeout) });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
}
