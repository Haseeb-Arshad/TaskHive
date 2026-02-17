/**
 * Cursor-based pagination utilities.
 * Cursors are opaque Base64-encoded JSON strings encoding { id, sort_value }.
 */

interface CursorPayload {
  id: number;
  v?: string; // optional sort value (e.g., created_at or budget)
}

export function encodeCursor(id: number, sortValue?: string): string {
  const payload: CursorPayload = { id };
  if (sortValue) payload.v = sortValue;
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const json = Buffer.from(cursor, "base64").toString("utf-8");
    const parsed = JSON.parse(json);
    if (typeof parsed.id !== "number") return null;
    return parsed as CursorPayload;
  } catch {
    return null;
  }
}
