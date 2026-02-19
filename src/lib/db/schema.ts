import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  timestamp,
  pgEnum,
  real,
  boolean,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", [
  "poster",
  "operator",
  "both",
  "admin",
]);

export const agentStatusEnum = pgEnum("agent_status", [
  "active",
  "paused",
  "suspended",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "open",
  "claimed",
  "in_progress",
  "delivered",
  "completed",
  "cancelled",
  "disputed",
]);

export const claimStatusEnum = pgEnum("claim_status", [
  "pending",
  "accepted",
  "rejected",
  "withdrawn",
]);

export const deliverableStatusEnum = pgEnum("deliverable_status", [
  "submitted",
  "accepted",
  "rejected",
  "revision_requested",
]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "deposit",
  "bonus",
  "payment",
  "platform_fee",
  "refund",
]);

export const webhookEventEnum = pgEnum("webhook_event", [
  "task.new_match",
  "claim.accepted",
  "claim.rejected",
  "deliverable.accepted",
  "deliverable.revision_requested",
]);

export const llmProviderEnum = pgEnum("llm_provider", [
  "openrouter",
  "openai",
  "anthropic",
]);

export const reviewResultEnum = pgEnum("review_result", [
  "pass",
  "fail",
  "pending",
  "skipped",
]);

export const reviewKeySourceEnum = pgEnum("review_key_source", [
  "poster",
  "freelancer",
  "none",
]);

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull().default("both"),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  bio: text("bio"),
  creditBalance: integer("credit_balance").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  agents: many(agents),
  tasks: many(tasks),
  creditTransactions: many(creditTransactions),
  reviews: many(reviews),
}));

// ─── Agents ──────────────────────────────────────────────────────────────────

export const agents = pgTable(
  "agents",
  {
    id: serial("id").primaryKey(),
    operatorId: integer("operator_id")
      .notNull()
      .references(() => users.id),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description").notNull(),
    capabilities: text("capabilities")
      .array()
      .notNull()
      .default([]),
    categoryIds: integer("category_ids")
      .array()
      .notNull()
      .default([]),
    hourlyRateCredits: integer("hourly_rate_credits"),
    apiKeyHash: varchar("api_key_hash", { length: 64 }),
    apiKeyPrefix: varchar("api_key_prefix", { length: 14 }),
    webhookUrl: varchar("webhook_url", { length: 500 }),
    status: agentStatusEnum("status").notNull().default("active"),
    reputationScore: real("reputation_score").notNull().default(50.0),
    tasksCompleted: integer("tasks_completed").notNull().default(0),
    avgRating: real("avg_rating"),
    // Reviewer Agent: freelancer's LLM key for self-review
    freelancerLlmKeyEncrypted: text("freelancer_llm_key_encrypted"),
    freelancerLlmProvider: llmProviderEnum("freelancer_llm_provider"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("agents_operator_id_idx").on(table.operatorId),
    index("agents_status_idx").on(table.status),
  ]
);

export const agentsRelations = relations(agents, ({ one, many }) => ({
  operator: one(users, {
    fields: [agents.operatorId],
    references: [users.id],
  }),
  claims: many(taskClaims),
  deliverables: many(deliverables),
  reviews: many(reviews),
  webhooks: many(webhooks),
}));

// ─── Categories ──────────────────────────────────────────────────────────────

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ─── Tasks ───────────────────────────────────────────────────────────────────

export const tasks = pgTable(
  "tasks",
  {
    id: serial("id").primaryKey(),
    posterId: integer("poster_id")
      .notNull()
      .references(() => users.id),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description").notNull(),
    requirements: text("requirements"),
    budgetCredits: integer("budget_credits").notNull(),
    categoryId: integer("category_id").references(() => categories.id),
    status: taskStatusEnum("status").notNull().default("open"),
    claimedByAgentId: integer("claimed_by_agent_id").references(
      () => agents.id
    ),
    deadline: timestamp("deadline", { withTimezone: true }),
    maxRevisions: integer("max_revisions").notNull().default(2),
    // Reviewer Agent: automated review settings
    autoReviewEnabled: boolean("auto_review_enabled").notNull().default(false),
    posterLlmKeyEncrypted: text("poster_llm_key_encrypted"),
    posterLlmProvider: llmProviderEnum("poster_llm_provider"),
    posterMaxReviews: integer("poster_max_reviews"),
    posterReviewsUsed: integer("poster_reviews_used").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("tasks_status_idx").on(table.status),
    index("tasks_poster_id_idx").on(table.posterId),
    index("tasks_category_id_idx").on(table.categoryId),
    index("tasks_created_at_idx").on(table.createdAt),
  ]
);

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  poster: one(users, {
    fields: [tasks.posterId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [tasks.categoryId],
    references: [categories.id],
  }),
  claimedByAgent: one(agents, {
    fields: [tasks.claimedByAgentId],
    references: [agents.id],
  }),
  claims: many(taskClaims),
  deliverables: many(deliverables),
  review: one(reviews, {
    fields: [tasks.id],
    references: [reviews.taskId],
  }),
}));

// ─── Task Claims ─────────────────────────────────────────────────────────────

export const taskClaims = pgTable(
  "task_claims",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id),
    agentId: integer("agent_id")
      .notNull()
      .references(() => agents.id),
    proposedCredits: integer("proposed_credits").notNull(),
    message: text("message"),
    status: claimStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("task_claims_task_id_idx").on(table.taskId),
    index("task_claims_agent_id_idx").on(table.agentId),
    index("task_claims_task_agent_status_idx").on(
      table.taskId,
      table.agentId,
      table.status
    ),
  ]
);

export const taskClaimsRelations = relations(taskClaims, ({ one }) => ({
  task: one(tasks, {
    fields: [taskClaims.taskId],
    references: [tasks.id],
  }),
  agent: one(agents, {
    fields: [taskClaims.agentId],
    references: [agents.id],
  }),
}));

// ─── Deliverables ────────────────────────────────────────────────────────────

export const deliverables = pgTable(
  "deliverables",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id),
    agentId: integer("agent_id")
      .notNull()
      .references(() => agents.id),
    content: text("content").notNull(),
    status: deliverableStatusEnum("status").notNull().default("submitted"),
    revisionNotes: text("revision_notes"),
    revisionNumber: integer("revision_number").notNull().default(1),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("deliverables_task_id_idx").on(table.taskId),
    index("deliverables_task_agent_idx").on(table.taskId, table.agentId),
  ]
);

export const deliverablesRelations = relations(deliverables, ({ one }) => ({
  task: one(tasks, {
    fields: [deliverables.taskId],
    references: [tasks.id],
  }),
  agent: one(agents, {
    fields: [deliverables.agentId],
    references: [agents.id],
  }),
}));

// ─── Reviews ─────────────────────────────────────────────────────────────────

export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id),
    reviewerId: integer("reviewer_id")
      .notNull()
      .references(() => users.id),
    agentId: integer("agent_id")
      .notNull()
      .references(() => agents.id),
    rating: integer("rating").notNull(),
    qualityScore: integer("quality_score"),
    speedScore: integer("speed_score"),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("reviews_task_id_unique").on(table.taskId)]
);

export const reviewsRelations = relations(reviews, ({ one }) => ({
  task: one(tasks, {
    fields: [reviews.taskId],
    references: [tasks.id],
  }),
  reviewer: one(users, {
    fields: [reviews.reviewerId],
    references: [users.id],
  }),
  agent: one(agents, {
    fields: [reviews.agentId],
    references: [agents.id],
  }),
}));

// ─── Credit Transactions ─────────────────────────────────────────────────────

export const creditTransactions = pgTable(
  "credit_transactions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    amount: integer("amount").notNull(),
    type: transactionTypeEnum("type").notNull(),
    taskId: integer("task_id").references(() => tasks.id),
    counterpartyId: integer("counterparty_id").references(() => users.id),
    description: text("description"),
    balanceAfter: integer("balance_after").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("credit_transactions_user_id_idx").on(table.userId),
    index("credit_transactions_created_at_idx").on(table.createdAt),
  ]
);

export const creditTransactionsRelations = relations(
  creditTransactions,
  ({ one }) => ({
    user: one(users, {
      fields: [creditTransactions.userId],
      references: [users.id],
    }),
    task: one(tasks, {
      fields: [creditTransactions.taskId],
      references: [tasks.id],
    }),
  })
);

// ─── Webhooks ───────────────────────────────────────────────────────────────

export const webhooks = pgTable(
  "webhooks",
  {
    id: serial("id").primaryKey(),
    agentId: integer("agent_id")
      .notNull()
      .references(() => agents.id),
    url: varchar("url", { length: 500 }).notNull(),
    secret: varchar("secret", { length: 64 }).notNull(),
    events: webhookEventEnum("events").array().notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("webhooks_agent_id_idx").on(table.agentId)]
);

export const webhooksRelations = relations(webhooks, ({ one, many }) => ({
  agent: one(agents, {
    fields: [webhooks.agentId],
    references: [agents.id],
  }),
  deliveries: many(webhookDeliveries),
}));

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: serial("id").primaryKey(),
    webhookId: integer("webhook_id")
      .notNull()
      .references(() => webhooks.id),
    event: webhookEventEnum("event").notNull(),
    payload: text("payload").notNull(),
    responseStatus: integer("response_status"),
    responseBody: text("response_body"),
    success: boolean("success").notNull().default(false),
    attemptedAt: timestamp("attempted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    durationMs: integer("duration_ms"),
  },
  (table) => [
    index("webhook_deliveries_webhook_id_idx").on(table.webhookId),
    index("webhook_deliveries_attempted_at_idx").on(table.attemptedAt),
  ]
);

export const webhookDeliveriesRelations = relations(
  webhookDeliveries,
  ({ one }) => ({
    webhook: one(webhooks, {
      fields: [webhookDeliveries.webhookId],
      references: [webhooks.id],
    }),
  })
);

// ─── Idempotency Keys ──────────────────────────────────────────────────────

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: serial("id").primaryKey(),
    agentId: integer("agent_id")
      .notNull()
      .references(() => agents.id),
    idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull(),
    requestPath: varchar("request_path", { length: 500 }).notNull(),
    requestBodyHash: varchar("request_body_hash", { length: 64 }).notNull(),
    responseStatus: integer("response_status"),
    responseBody: text("response_body"),
    lockedAt: timestamp("locked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idempotency_keys_agent_key_idx").on(
      table.agentId,
      table.idempotencyKey
    ),
    index("idempotency_keys_expires_at_idx").on(table.expiresAt),
  ]
);

// ─── Submission Attempts (Reviewer Agent) ────────────────────────────────────

export const submissionAttempts = pgTable(
  "submission_attempts",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id),
    agentId: integer("agent_id")
      .notNull()
      .references(() => agents.id),
    deliverableId: integer("deliverable_id").references(() => deliverables.id),
    attemptNumber: integer("attempt_number").notNull(),
    content: text("content").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewResult: reviewResultEnum("review_result").notNull().default("pending"),
    reviewFeedback: text("review_feedback"),
    reviewScores: jsonb("review_scores"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewKeySource: reviewKeySourceEnum("review_key_source")
      .notNull()
      .default("none"),
    llmModelUsed: varchar("llm_model_used", { length: 200 }),
  },
  (table) => [
    index("submission_attempts_task_id_idx").on(table.taskId),
    index("submission_attempts_agent_id_idx").on(table.agentId),
    index("submission_attempts_task_agent_idx").on(table.taskId, table.agentId),
  ]
);

export const submissionAttemptsRelations = relations(
  submissionAttempts,
  ({ one }) => ({
    task: one(tasks, {
      fields: [submissionAttempts.taskId],
      references: [tasks.id],
    }),
    agent: one(agents, {
      fields: [submissionAttempts.agentId],
      references: [agents.id],
    }),
    deliverable: one(deliverables, {
      fields: [submissionAttempts.deliverableId],
      references: [deliverables.id],
    }),
  })
);
