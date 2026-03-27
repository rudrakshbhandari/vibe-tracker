import { z } from "zod";

export const leaderboardWindowSchema = z.enum(["7d", "30d", "90d"]);

export const leaderboardUpdateMessageSchema = z.object({
  type: z.literal("leaderboard-update"),
  accountId: z.string().min(1),
  windows: z.array(leaderboardWindowSchema).min(1).optional(),
});

export const maintenanceCleanupMessageSchema = z.object({
  type: z.literal("maintenance-cleanup"),
});

export const leaderboardRankRebuildMessageSchema = z.object({
  type: z.literal("leaderboard-rank-rebuild"),
  window: leaderboardWindowSchema.optional(),
});

export const queueMessageSchema = z.discriminatedUnion("type", [
  leaderboardUpdateMessageSchema,
  maintenanceCleanupMessageSchema,
  leaderboardRankRebuildMessageSchema,
]);

export type LeaderboardWindow = z.infer<typeof leaderboardWindowSchema>;
export type QueueMessage = z.infer<typeof queueMessageSchema>;

export function parseQueueMessage(input: unknown) {
  return queueMessageSchema.parse(input);
}
