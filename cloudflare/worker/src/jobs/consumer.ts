import type { LeaderboardWindow, QueueMessage } from "@/jobs/contracts";
import { parseQueueMessage } from "@/jobs/contracts";
import {
  rebuildLeaderboardRanks,
  recomputeLeaderboardScoresForAccount,
  runMaintenance,
} from "@/jobs/leaderboard";
import { handleInstallationSync, handleRepositorySync } from "@/jobs/sync";
import type { VibeWorkerEnv } from "@/env";

async function handleQueueMessage(
  env: VibeWorkerEnv,
  message: QueueMessage,
  now = new Date(),
) {
  if (message.type === "installation-sync") {
    await handleInstallationSync(env, message);
    return;
  }

  if (message.type === "repository-sync") {
    await handleRepositorySync(env, message);
    return;
  }

  if (message.type === "leaderboard-update") {
    await recomputeLeaderboardScoresForAccount(
      env,
      message.accountId,
      message.windows as LeaderboardWindow[] | undefined,
      now,
    );
    return;
  }

  if (message.type === "maintenance-cleanup") {
    await runMaintenance(env, now);
    return;
  }

  if (message.type === "leaderboard-rank-rebuild") {
    const windows = message.window
      ? [message.window]
      : (["7d", "30d", "90d"] as LeaderboardWindow[]);

    for (const window of windows) {
      await rebuildLeaderboardRanks(env, window, now);
    }

    return;
  }
}

export async function handleQueueBatch(
  env: VibeWorkerEnv,
  batch: MessageBatch<unknown>,
  now = new Date(),
) {
  for (const message of batch.messages) {
    try {
      await handleQueueMessage(env, parseQueueMessage(message.body), now);
      message.ack();
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") {
        message.ack();
        continue;
      }

      message.retry();
    }
  }
}
