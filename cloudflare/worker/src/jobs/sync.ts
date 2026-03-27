import type {
  InstallationMessage,
  QueueMessage,
} from "@/jobs/contracts";
import type { VibeWorkerEnv } from "@/env";
import {
  getInstallationRepositories,
  getPullRequestDetail,
  listMergedPullRequests,
  type GitHubRequestOptions,
} from "@/lib/github";
import {
  applyPullRequestDetail,
  getSyncCursor,
  syncInstallationRepositories,
  upsertSyncCursor,
} from "@/lib/store";

const ACTIVITY_SYNC_LOOKBACK_DAYS = 90;

function getInitialActivitySyncSinceIsoString() {
  return new Date(
    Date.now() - ACTIVITY_SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
}

function getGitHubRetryObserver(): GitHubRequestOptions {
  return {
    onRateLimitRetry() {
      return;
    },
  };
}

async function sendQueueMessage(env: VibeWorkerEnv, message: QueueMessage) {
  if (!env.SYNC_QUEUE) {
    return;
  }

  await env.SYNC_QUEUE.send(message);
}

export async function enqueueInstallationSyncs(
  env: VibeWorkerEnv,
  input: {
    accountId: string;
    installations: InstallationMessage[];
  },
) {
  for (const installation of input.installations) {
    await sendQueueMessage(env, {
      type: "installation-sync",
      accountId: input.accountId,
      installation,
    });
  }
}

export async function handleInstallationSync(
  env: VibeWorkerEnv,
  message: Extract<QueueMessage, { type: "installation-sync" }>,
) {
  const repositories = await getInstallationRepositories(
    env,
    message.installation.githubInstallationId,
    getGitHubRetryObserver(),
  );
  const syncedInstallation = await syncInstallationRepositories(env, {
    accountId: message.accountId,
    installation: {
      id: message.installation.githubInstallationId,
      account: {
        login: message.installation.accountLogin,
        type: message.installation.accountType,
      },
      target_type: message.installation.targetType ?? null,
      permissions: message.installation.permissions,
    },
    repositories,
  });

  for (const repository of syncedInstallation.selectedRepositories) {
    await sendQueueMessage(env, {
      type: "repository-sync",
      accountId: message.accountId,
      installationId: syncedInstallation.installationId,
      githubInstallationId: message.installation.githubInstallationId,
      repositoryId: repository.id,
      owner: repository.owner,
      repo: repository.name,
    });
  }
}

export async function handleRepositorySync(
  env: VibeWorkerEnv,
  message: Extract<QueueMessage, { type: "repository-sync" }>,
) {
  const cursor = await getSyncCursor(env, message.repositoryId);
  const pullRequests = await listMergedPullRequests({
    env,
    owner: message.owner,
    repo: message.repo,
    installationId: message.githubInstallationId,
    updatedSince: cursor?.cursor_value ?? getInitialActivitySyncSinceIsoString(),
    options: getGitHubRetryObserver(),
  });

  if (pullRequests.length === 0) {
    return;
  }

  let latestUpdatedAt = cursor?.cursor_value ?? null;

  for (const pullRequest of pullRequests) {
    const detail = await getPullRequestDetail({
      env,
      owner: message.owner,
      repo: message.repo,
      pullNumber: pullRequest.number,
      installationId: message.githubInstallationId,
      options: getGitHubRetryObserver(),
    });
    await applyPullRequestDetail(env, {
      repositoryId: message.repositoryId,
      detail,
    });

    if (!latestUpdatedAt || new Date(detail.updated_at) > new Date(latestUpdatedAt)) {
      latestUpdatedAt = detail.updated_at;
    }
  }

  if (latestUpdatedAt) {
    await upsertSyncCursor(env, {
      installationId: message.installationId,
      repositoryId: message.repositoryId,
      cursorValue: latestUpdatedAt,
    });
  }

  await sendQueueMessage(env, {
    type: "leaderboard-update",
    accountId: message.accountId,
  });
}
