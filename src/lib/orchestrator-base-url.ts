const DEFAULT_BACKEND_URL = "http://localhost:8000";

function stripApiV1Suffix(url: string): string {
  return url.replace(/\/api\/v1\/?$/i, "");
}

export function getOrchestratorBaseUrl(): string {
  const raw =
    process.env.ORCHESTRATOR_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    DEFAULT_BACKEND_URL;
  const trimmed = raw.trim().replace(/\/+$/, "");
  return stripApiV1Suffix(trimmed);
}
