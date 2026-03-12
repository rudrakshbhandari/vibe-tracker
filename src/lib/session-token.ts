import { createHash } from "node:crypto";

export function hashSessionToken(sessionToken: string) {
  return createHash("sha256").update(sessionToken).digest("hex");
}

export function getSessionTokenLookupValues(sessionToken: string) {
  const hashed = hashSessionToken(sessionToken);
  return hashed === sessionToken ? [hashed] : [hashed, sessionToken];
}
