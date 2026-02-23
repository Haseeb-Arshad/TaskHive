export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Enhanced fetch wrapper for TaskHive API
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
        console.error(`[API Client] Error fetching ${url}:`, error);
        // Rethrow to let the caller handle network errors (e.g. show a specific error UI)
        throw error;
    }
}
