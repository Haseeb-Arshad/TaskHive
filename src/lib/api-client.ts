import { getBackendBaseUrl } from "@/lib/backend-base-url";

export const API_BASE_URL = getBackendBaseUrl();

// How long (ms) to wait for the Python backend before giving up.
// Undici's built-in headersTimeout (~5 s) fires before this when the backend
// is busy with agent work, causing HeadersTimeoutError crashes in SSR.
// An explicit AbortSignal overrides that internal timeout.
const API_TIMEOUT_MS = 30_000;

/**
 * Enhanced fetch wrapper for TaskHive API.
 * Never throws — returns a synthetic 503 Response on network/timeout errors
 * so callers can safely check `res.ok` without try/catch.
 */
export async function apiClient(path: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

    // Merge any caller-supplied signal with our own timeout signal.
    // AbortSignal.any() requires Node 20+; fall back gracefully.
    let signal: AbortSignal;
    const timeoutSignal = AbortSignal.timeout(API_TIMEOUT_MS);
    if (options.signal) {
        try {
            signal = AbortSignal.any([options.signal, timeoutSignal]);
        } catch {
            signal = timeoutSignal;
        }
    } else {
        signal = timeoutSignal;
    }

    try {
        const response = await fetch(url, {
            ...options,
            signal,
            headers: {
                "Content-Type": "application/json",
                ...options.headers,
            },
        });

        return response;
    } catch (error: any) {
        const isTimeout =
            error?.name === "TimeoutError" ||
            error?.cause?.code === "UND_ERR_HEADERS_TIMEOUT" ||
            error?.cause?.code === "UND_ERR_CONNECT_TIMEOUT";

        console.error(
            `[API Client] ${isTimeout ? "Timeout" : "Network error"} fetching ${url}:`,
            isTimeout ? "(backend took too long to respond)" : error
        );

        return new Response(
            JSON.stringify({
                ok: false,
                error: {
                    code: isTimeout ? "timeout" : "network_error",
                    message: isTimeout
                        ? "Backend API timed out — it may be under heavy load"
                        : "Could not connect to backend API",
                    suggestion: "Make sure the Python API is running on port 8000",
                },
            }),
            {
                status: 503,
                statusText: "Service Unavailable",
                headers: { "Content-Type": "application/json" },
            },
        );
    }
}
