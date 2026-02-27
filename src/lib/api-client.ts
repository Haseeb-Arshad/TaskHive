export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Enhanced fetch wrapper for TaskHive API.
 * Never throws — returns a synthetic 503 Response on network errors
 * so callers can safely check `res.ok` without try/catch.
 */
export async function apiClient(path: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...options.headers,
            },
        });

        return response;
    } catch (error) {
        console.error(`[API Client] Network error fetching ${url}:`, error);
        // Return a synthetic Response so callers can check res.ok without try/catch
        return new Response(
            JSON.stringify({
                ok: false,
                error: {
                    code: "network_error",
                    message: "Could not connect to backend API",
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
