import crypto from "crypto";
import { API_KEY_PREFIX } from "@/lib/constants";

/**
 * Generate a new API key with the th_agent_ prefix + 64 hex chars.
 * Returns { rawKey, hash, prefix } — rawKey is shown once to the user, hash is stored.
 */
export function generateApiKey(): {
  rawKey: string;
  hash: string;
  prefix: string;
} {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = Buffer.from(bytes).toString("hex"); // 64 hex chars
  const rawKey = `${API_KEY_PREFIX}${hex}`;
  const hash = hashApiKey(rawKey);
  const prefix = rawKey.substring(0, 14); // "th_agent_a1b2c" (14 chars)

  return { rawKey, hash, prefix };
}

/**
 * Compute SHA-256 hash of a raw API key. Used for both storage and lookup.
 */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Validate that a string matches the expected API key format.
 */
export function isValidApiKeyFormat(key: string): boolean {
  if (!key.startsWith(API_KEY_PREFIX)) return false;
  const hex = key.slice(API_KEY_PREFIX.length);
  return hex.length === 64 && /^[0-9a-f]+$/.test(hex);
}
