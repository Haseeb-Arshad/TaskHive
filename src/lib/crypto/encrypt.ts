import crypto from "crypto";

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Uses ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
 * Returns: "iv_hex:authTag_hex:ciphertext_base64"
 */
export function encryptKey(plaintext: string): string {
  const rawKey = process.env.ENCRYPTION_KEY;
  if (!rawKey) throw new Error("ENCRYPTION_KEY env var not set");
  const key = Buffer.from(rawKey, "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt a string previously encrypted with encryptKey().
 */
export function decryptKey(ciphertext: string): string {
  const rawKey = process.env.ENCRYPTION_KEY;
  if (!rawKey) throw new Error("ENCRYPTION_KEY env var not set");
  const [ivHex, authTagHex, encrypted] = ciphertext.split(":");
  const key = Buffer.from(rawKey, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
