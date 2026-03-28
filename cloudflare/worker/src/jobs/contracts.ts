import { z } from "zod";

export const leaderboardWindowSchema = z.enum(["7d", "30d", "90d"]);

export const installationMessageSchema = z.object({
  githubInstallationId: z.number().int().positive(),
  accountLogin: z.string().min(1),
  accountType: z.string().min(1),
  targetType: z.string().min(1).nullable().optional(),
  permissions: z.record(z.string(), z.string()).optional(),
});

export const installationSyncMessageSchema = z.object({
  type: z.literal("installation-sync"),
  accountId: z.string().min(1),
  installation: installationMessageSchema,
});

export const repositorySyncMessageSchema = z.object({
  type: z.literal("repository-sync"),
  accountId: z.string().min(1),
  installationId: z.string().min(1),
  githubInstallationId: z.number().int().positive(),
  repositoryId: z.string().min(1),
  owner: z.string().min(1),
  repo: z.string().min(1),
});

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
  installationSyncMessageSchema,
  repositorySyncMessageSchema,
  leaderboardUpdateMessageSchema,
  maintenanceCleanupMessageSchema,
  leaderboardRankRebuildMessageSchema,
]);

export type LeaderboardWindow = z.infer<typeof leaderboardWindowSchema>;
export type InstallationMessage = z.infer<typeof installationMessageSchema>;
export type QueueMessage = z.infer<typeof queueMessageSchema>;

export function parseQueueMessage(input: unknown) {
  return queueMessageSchema.parse(input);
}
