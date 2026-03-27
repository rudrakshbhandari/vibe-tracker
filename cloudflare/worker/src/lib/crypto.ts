const ENCRYPTED_SECRET_PREFIX = "enc:v1";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function toUint8Array(value: string) {
  return new TextEncoder().encode(value);
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function sha256Bytes(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", toUint8Array(value));
  return new Uint8Array(digest);
}

async function getAesKey(secret: string) {
  const keyBytes = await sha256Bytes(secret);
  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function hashSha256Hex(value: string) {
  const bytes = await sha256Bytes(value);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function encryptSecret(secret: string, encryptionKey: string) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await getAesKey(encryptionKey);
  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    toUint8Array(secret),
  );

  const ciphertext = new Uint8Array(ciphertextBuffer);
  const encrypted = ciphertext.slice(0, ciphertext.length - AUTH_TAG_LENGTH);
  const authTag = ciphertext.slice(ciphertext.length - AUTH_TAG_LENGTH);

  return [
    ENCRYPTED_SECRET_PREFIX,
    bytesToBase64(iv),
    bytesToBase64(authTag),
    bytesToBase64(encrypted),
  ].join(":");
}

export async function decryptSecret(value: string, encryptionKey: string) {
  if (!value.startsWith(`${ENCRYPTED_SECRET_PREFIX}:`)) {
    return value;
  }

  const [, , ivBase64, authTagBase64, encryptedBase64] = value.split(":");

  if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new Error("Encrypted secret is malformed");
  }

  const iv = base64ToBytes(ivBase64);
  const authTag = base64ToBytes(authTagBase64);
  const encrypted = base64ToBytes(encryptedBase64);
  const ciphertext = new Uint8Array(encrypted.length + authTag.length);
  ciphertext.set(encrypted);
  ciphertext.set(authTag, encrypted.length);

  const key = await getAesKey(encryptionKey);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(plaintext);
}
