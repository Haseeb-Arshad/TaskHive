import { errorResponse } from "./envelope";

// 401
export function unauthorizedError(detail?: string) {
  return errorResponse(
    401,
    "UNAUTHORIZED",
    detail || "Missing or invalid Authorization header",
    "Include header: Authorization: Bearer th_agent_<your-key>"
  );
}

export function invalidApiKeyError() {
  return errorResponse(
    401,
    "UNAUTHORIZED",
    "Invalid API key",
    "Check your API key or generate a new one at /dashboard/agents"
  );
}

// 403
export function forbiddenError(reason: string, suggestion: string) {
  return errorResponse(403, "FORBIDDEN", reason, suggestion);
}

export function agentSuspendedError() {
  return errorResponse(
    403,
    "FORBIDDEN",
    "Agent is suspended",
    "Contact your account administrator"
  );
}

export function agentPausedError() {
  return errorResponse(
    403,
    "FORBIDDEN",
    "Agent is paused",
    "Reactivate your agent at /dashboard/agents"
  );
}

// 404
export function notFoundError(entity: string, id: number, suggestion: string) {
  return errorResponse(
    404,
    `${entity.toUpperCase()}_NOT_FOUND`,
    `${entity} ${id} does not exist`,
    suggestion
  );
}

export function taskNotFoundError(id: number) {
  return notFoundError(
    "Task",
    id,
    "Use GET /api/v1/tasks to browse available tasks"
  );
}

// 409
export function conflictError(code: string, message: string, suggestion: string) {
  return errorResponse(409, code, message, suggestion);
}

export function taskNotOpenError(taskId: number, currentStatus: string) {
  return conflictError(
    "TASK_NOT_OPEN",
    `Task ${taskId} is not open (current status: ${currentStatus})`,
    "This task has already been claimed. Browse open tasks with GET /api/v1/tasks?status=open"
  );
}

export function duplicateClaimError(taskId: number) {
  return conflictError(
    "DUPLICATE_CLAIM",
    `You already have a pending claim on task ${taskId}`,
    "Check your claims with GET /api/v1/agents/me/claims"
  );
}

export function invalidStatusError(
  taskId: number,
  currentStatus: string,
  suggestion: string
) {
  return conflictError(
    "INVALID_STATUS",
    `Task ${taskId} is not in a deliverable state (status: ${currentStatus})`,
    suggestion
  );
}

export function maxRevisionsError(taskId: number, current: number, max: number) {
  return conflictError(
    "MAX_REVISIONS",
    `Maximum revisions reached (${current} of ${max} deliveries)`,
    "No more revisions allowed. Contact the poster."
  );
}

// 422
export function validationError(message: string, suggestion: string) {
  return errorResponse(422, "VALIDATION_ERROR", message, suggestion);
}

// 400
export function invalidParameterError(message: string, suggestion: string) {
  return errorResponse(400, "INVALID_PARAMETER", message, suggestion);
}

export function invalidCreditsError(proposed: number, budget: number) {
  return errorResponse(
    422,
    "INVALID_CREDITS",
    `proposed_credits (${proposed}) exceeds task budget (${budget})`,
    `Propose credits ≤ ${budget}`
  );
}

// 429
export function rateLimitedError(retryAfterSeconds: number) {
  return errorResponse(
    429,
    "RATE_LIMITED",
    "Rate limit exceeded (100 requests/minute)",
    `Wait ${retryAfterSeconds} seconds before retrying. Check X-RateLimit-Reset header.`
  );
}

// Idempotency errors
export function idempotencyKeyTooLongError() {
  return errorResponse(
    400,
    "IDEMPOTENCY_KEY_TOO_LONG",
    "Idempotency-Key exceeds maximum length of 255 characters",
    "Use a shorter key, such as a UUID (36 characters)"
  );
}

export function idempotencyKeyMismatchError() {
  return errorResponse(
    422,
    "IDEMPOTENCY_KEY_MISMATCH",
    "Idempotency-Key was already used with a different request path or body",
    "Use a unique Idempotency-Key for each distinct request"
  );
}

export function idempotencyKeyInFlightError() {
  return errorResponse(
    409,
    "IDEMPOTENCY_KEY_IN_FLIGHT",
    "A request with this Idempotency-Key is already being processed",
    "Wait for the original request to complete, then retry"
  );
}

// 500
export function internalError() {
  return errorResponse(
    500,
    "INTERNAL_ERROR",
    "An unexpected error occurred",
    "Try again later. If the issue persists, contact support."
  );
}
