import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "crypto";

/**
 * AES-256-GCM secret storage for the AI provider key.
 * Format: v1:<iv b64>:<auth tag b64>:<ciphertext b64>
 * The master key lives only in server env (AI_ASSISTANT_ENCRYPTION_KEY,
 * 32 bytes as base64 or hex) and is shared by the admin app (encrypts)
 * and the student app (decrypts). Never NEXT_PUBLIC_.
 */

function loadMasterKey(): Buffer | null {
  const raw = process.env.AI_ASSISTANT_ENCRYPTION_KEY?.trim();
  if (!raw) return null;

  try {
    if (/^[0-9a-f]{64}$/i.test(raw)) {
      return Buffer.from(raw, "hex");
    }
    const buf = Buffer.from(raw, "base64");
    if (buf.length === 32) return buf;
    return null;
  } catch {
    return null;
  }
}

export function isEncryptionConfigured() {
  return loadMasterKey() !== null;
}

export function encryptSecret(plaintext: string): string {
  const key = loadMasterKey();
  if (!key) {
    throw new Error("AI_ASSISTANT_ENCRYPTION_KEY is not configured.");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptSecret(payload: string): string | null {
  const key = loadMasterKey();
  if (!key) return null;

  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") return null;

  try {
    const iv = Buffer.from(parts[1], "base64");
    const tag = Buffer.from(parts[2], "base64");
    const ciphertext = Buffer.from(parts[3], "base64");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

/** Display-safe hint, e.g. "sk-…7Kp2". Never derived from the ciphertext. */
export function keyHint(plaintext: string): string {
  const clean = plaintext.trim();
  if (clean.length <= 6) return "••••";
  const prefix = clean.slice(0, Math.min(3, clean.length - 4));
  return `${prefix}••••••••${clean.slice(-4)}`;
}
