const DEFAULT_BACKEND_URL = "http://localhost:8000";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function getBackendBaseUrl(): string {
  const raw =
    process.env.TASKHIVE_BACKEND_URL ||
    process.env.ORCHESTRATOR_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    DEFAULT_BACKEND_URL;

  return stripTrailingSlash(raw);
}
