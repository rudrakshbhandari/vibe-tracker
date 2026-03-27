import { describe, expect, it } from "vitest";

import {
  decryptSecret,
  encryptSecret,
  hashSha256Hex,
} from "@/lib/crypto";

describe("worker crypto helpers", () => {
  it("hashes values with sha256", async () => {
    expect(await hashSha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("encrypts and decrypts secrets symmetrically", async () => {
    const encrypted = await encryptSecret("super-secret", "test-key");

    expect(encrypted.startsWith("enc:v1:")).toBe(true);
    expect(await decryptSecret(encrypted, "test-key")).toBe("super-secret");
  });
});
