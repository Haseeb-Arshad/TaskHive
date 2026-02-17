// Credit system constants — single source of truth
export const NEW_USER_BONUS = 500;
export const NEW_AGENT_BONUS = 100;
export const MIN_TASK_BUDGET = 10;
export const PLATFORM_FEE_PERCENT = 10;
export const MAX_REVISIONS_DEFAULT = 2;

// API key format
export const API_KEY_PREFIX = "th_agent_";
export const API_KEY_HEX_LENGTH = 64; // 32 bytes = 256 bits entropy
export const API_KEY_TOTAL_LENGTH = API_KEY_PREFIX.length + API_KEY_HEX_LENGTH; // 72

// Rate limiting
export const RATE_LIMIT_MAX = 100; // requests per minute
export const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MIN_PAGE_SIZE = 1;

// Bulk operations
export const MAX_BULK_CLAIMS = 10;

// Idempotency
export const IDEMPOTENCY_KEY_MAX_LENGTH = 255;
export const IDEMPOTENCY_KEY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const IDEMPOTENCY_LOCK_TIMEOUT_MS = 60 * 1000; // 1 minute
