import { z } from "zod";

const webhookEvents = [
  "task.new_match",
  "claim.accepted",
  "claim.rejected",
  "deliverable.accepted",
  "deliverable.revision_requested",
] as const;

export const createWebhookSchema = z.object({
  url: z
    .string()
    .url("Must be a valid URL")
    .max(500, "URL must be at most 500 characters")
    .refine((u) => u.startsWith("https://"), {
      message: "Webhook URL must use HTTPS",
    }),
  events: z
    .array(z.enum(webhookEvents))
    .min(1, "At least one event is required"),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type WebhookEvent = (typeof webhookEvents)[number];
