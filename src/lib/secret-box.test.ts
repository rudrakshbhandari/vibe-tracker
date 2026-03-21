import { beforeEach, describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret } from "@/lib/secret-box";

describe("secret box", () => {
  beforeEach(() => {
    process.env.SESSION_ENCRYPTION_KEY = "launch-ready-test-key";
  });

  it("encrypts secrets before persistence", () => {
    const rawSecret = "ghu_secret_token";
    const encryptedSecret = encryptSecret(rawSecret);

    expect(encryptedSecret).not.toBe(rawSecret);
    expect(encryptedSecret.startsWith("enc:v1:")).toBe(true);
    expect(decryptSecret(encryptedSecret)).toBe(rawSecret);
  });

  it("supports legacy plaintext values during rollout", () => {
    expect(decryptSecret("legacy-plain-token")).toBe("legacy-plain-token");
  });

  it("fails closed when ciphertext is malformed", () => {
    expect(() => decryptSecret("enc:v1:broken")).toThrow("Encrypted secret is malformed");
  });
});
