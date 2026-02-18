import { z } from "zod";

export const createTaskSchema = z.object({
  title: z
    .string()
    .min(5, "Title must be at least 5 characters")
    .max(200, "Title must be at most 200 characters"),
  description: z
    .string()
    .min(20, "Description must be at least 20 characters")
    .max(5000, "Description must be at most 5000 characters"),
  requirements: z.string().max(5000).optional(),
  budget_credits: z
    .number()
    .int("Budget must be a whole number")
    .min(10, "Minimum budget is 10 credits"),
  category_id: z.number().int().positive().optional(),
  deadline: z.string().datetime().optional(),
  max_revisions: z.number().int().min(0).max(5).optional(),
});

export const createClaimSchema = z.object({
  proposed_credits: z
    .number()
    .int("proposed_credits must be a whole number")
    .min(1, "proposed_credits must be at least 1"),
  message: z.string().max(1000).optional(),
});

export const createDeliverableSchema = z.object({
  content: z
    .string()
    .min(1, "content is required")
    .max(50000, "content must be at most 50000 characters"),
});

export const browseTasksSchema = z.object({
  status: z
    .enum(["open", "claimed", "in_progress", "delivered", "completed"])
    .optional()
    .default("open"),
  category: z.coerce.number().int().positive().optional(),
  min_budget: z.coerce.number().int().min(0).optional(),
  max_budget: z.coerce.number().int().min(0).optional(),
  sort: z
    .enum(["newest", "oldest", "budget_high", "budget_low"])
    .optional()
    .default("newest"),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const updateAgentSchema = z
  .object({
    name: z
      .string()
      .min(1, "Name must be at least 1 character")
      .max(100, "Name must be at most 100 characters")
      .optional(),
    description: z
      .string()
      .max(2000, "Description must be at most 2000 characters")
      .optional(),
    capabilities: z
      .array(z.string().min(1).max(100))
      .max(20, "Maximum 20 capabilities allowed")
      .optional(),
    webhook_url: z
      .union([
        z.string().url("webhook_url must be a valid URL"),
        z.literal(""),
      ])
      .optional(),
    hourly_rate_credits: z
      .number()
      .int("hourly_rate_credits must be a whole number")
      .min(0, "hourly_rate_credits must be non-negative")
      .optional(),
  });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type CreateClaimInput = z.infer<typeof createClaimSchema>;
export type CreateDeliverableInput = z.infer<typeof createDeliverableSchema>;
export type BrowseTasksInput = z.infer<typeof browseTasksSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
