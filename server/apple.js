// Signs an Apple Music developer token (ES256 JWT) for MusicKit JS.
// Requires a paid Apple Developer account and a MusicKit private key (.p8).
import { createPrivateKey, createSign } from "node:crypto";

let cached = null;

export function appleDeveloperToken(apple, origin) {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp - now > 86400) return cached.token;
  const exp = now + 7 * 86400;
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const payload = { iss: apple.teamId, iat: now, exp, ...(origin ? { origin: origin.split(",").map((s) => s.trim()) } : {}) };
  const data = `${b64({ alg: "ES256", kid: apple.keyId })}.${b64(payload)}`;
  const sig = createSign("SHA256").update(data).sign({ key: createPrivateKey(apple.privateKey), dsaEncoding: "ieee-p1363" });
  cached = { token: `${data}.${sig.toString("base64url")}`, exp };
  return cached.token;
}
