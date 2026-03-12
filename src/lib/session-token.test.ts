import { describe, expect, it } from "vitest";

import {
  getSessionTokenLookupValues,
  hashSessionToken,
} from "@/lib/session-token";

describe("session token hashing", () => {
  it("hashes tokens before persistence", () => {
    const rawToken = "session-token";
    const hashedToken = hashSessionToken(rawToken);

    expect(hashedToken).not.toBe(rawToken);
    expect(hashedToken).toHaveLength(64);
  });

  it("supports hashed and legacy plaintext lookups", () => {
    const rawToken = "session-token";

    expect(getSessionTokenLookupValues(rawToken)).toEqual([
      hashSessionToken(rawToken),
      rawToken,
    ]);
  });
});
