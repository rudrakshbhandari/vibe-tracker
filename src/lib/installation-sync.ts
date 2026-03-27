import type { SyncJob } from "@prisma/client";

import {
  MAX_TRACKED_REPOSITORIES_PER_INSTALLATION,
  completeSyncJob,
  deferSyncJob,
  failSyncJob,
  renewSyncJobLease,
  type SyncJobResult,
} from "@/lib/activity-sync-jobs";
import { db } from "@/lib/db";
import {
  getInstallationRepositories,
  getPullRequestDetail,
  getUserInstallations,
  listMergedPullRequests,
  type GitHubInstallation,
  type GitHubPullRequestDetail,
  type GitHubRequestOptions,
} from "@/lib/github";
import { getStaleRepositoryIds } from "@/lib/repository-sync";
import { refreshLeaderboardSnapshotsForAccount } from "@/lib/social";

const ACTIVITY_SYNC_LOOKBACK_DAYS = 90;
const MERGED_PULL_REQUEST_SCOPE = "merged_prs";

type ActivitySyncStats = {
  selectedRepositoryCount: number;
  skippedRepositoryCount: number;
  syncedRepositoryCount: number;
  fetchedPullRequestCount: number;
  processedPullRequestCount: number;
  githubRetryCount: number;
  githubRetryDelayMs: number;
  repositoryDurationsMs: number[];
};

function getInitialActivitySyncSinceIsoString() {
  return new Date(
    Date.now() - ACTIVITY_SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
}

function getUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getActivitySyncStatsResult(
  stats: ActivitySyncStats,
  input?: {
    createdAt?: Date;
    startedAt?: Date | null;
  },
): SyncJobResult {
  return {
    selectedRepositoryCount: stats.selectedRepositoryCount,
    skippedRepositoryCount: stats.skippedRepositoryCount,
    syncedRepositoryCount: stats.syncedRepositoryCount,
    fetchedPullRequestCount: stats.fetchedPullRequestCount,
    processedPullRequestCount: stats.processedPullRequestCount,
    githubRetryCount: stats.githubRetryCount,
    githubRetryDelayMs: stats.githubRetryDelayMs,
    averageRepositoryDurationMs:
      stats.repositoryDurationsMs.length > 0
        ? Math.round(
            stats.repositoryDurationsMs.reduce((sum, duration) => sum + duration, 0) /
              stats.repositoryDurationsMs.length,
          )
        : undefined,
    queueDelayMs:
      input?.createdAt && input.startedAt
        ? Math.max(0, input.startedAt.getTime() - input.createdAt.getTime())
        : undefined,
    durationMs: input?.startedAt ? Date.now() - input.startedAt.getTime() : undefined,
  };
}

function getGitHubRetryDelayMs(error: unknown) {
  if (!error || typeof error !== "object" || !("response" in error)) {
    return null;
  }

  const response = error.response;

  if (!response || typeof response !== "object" || !("headers" in response)) {
    return null;
  }

  const headers = response.headers;
  const getHeader = (headerName: string) => {
    if (headers instanceof Headers) {
      return headers.get(headerName);
    }

    if (typeof headers === "object") {
      return (
        (headers as Record<string, string>)[headerName] ??
        (headers as Record<string, string>)[headerName.toLowerCase()] ??
        null
      );
    }

    return null;
  };

  const retryAfter = getHeader("retry-after");
  if (retryAfter) {
    const retryAfterSeconds = Number.parseInt(retryAfter, 10);
    if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
      return retryAfterSeconds * 1000;
    }
  }

  const rateLimitReset = getHeader("x-ratelimit-reset");
  if (rateLimitReset) {
    const resetSeconds = Number.parseInt(rateLimitReset, 10);
    if (!Number.isNaN(resetSeconds)) {
      return Math.max(1_000, resetSeconds * 1000 - Date.now() + 1_000);
    }
  }

  return null;
}

function getGitHubRetryObserver(stats: ActivitySyncStats): GitHubRequestOptions {
  return {
    onRateLimitRetry: ({ delayMs }) => {
      stats.githubRetryCount += 1;
      stats.githubRetryDelayMs += delayMs;
    },
  };
}

function getTrackedRepositories<T extends { syncEnabled: boolean }>(repositories: T[]) {
  const selectedRepositories = repositories.filter((repository) => repository.syncEnabled);
  return {
    selectedRepositories: selectedRepositories.slice(
      0,
      MAX_TRACKED_REPOSITORIES_PER_INSTALLATION,
    ),
    skippedRepositoryCount: Math.max(
      0,
      repositories.length -
        Math.min(
          selectedRepositories.length,
          MAX_TRACKED_REPOSITORIES_PER_INSTALLATION,
        ),
    ),
  };
}

async function upsertInstallationAndRepositories(input: {
  installation: GitHubInstallation;
  accountId: string;
}) {
  const installation = await db.installation.upsert({
    where: {
      githubInstallId: input.installation.id,
    },
    update: {
      accountLogin: input.installation.account.login,
      accountType: input.installation.account.type,
      targetType: input.installation.target_type ?? null,
      permissionsJson: JSON.stringify(input.installation.permissions ?? {}),
    },
    create: {
      githubInstallId: input.installation.id,
      accountLogin: input.installation.account.login,
      accountType: input.installation.account.type,
      targetType: input.installation.target_type ?? null,
      permissionsJson: JSON.stringify(input.installation.permissions ?? {}),
    },
  });

  await db.installationGrant.upsert({
    where: {
      accountId_installationId: {
        accountId: input.accountId,
        installationId: installation.id,
      },
    },
    update: {},
    create: {
      accountId: input.accountId,
      installationId: installation.id,
    },
  });

  return installation;
}

async function syncInstallationRepositories(input: {
  installation: GitHubInstallation;
  accountId: string;
}) {
  const installation = await upsertInstallationAndRepositories({
    installation: input.installation,
    accountId: input.accountId,
  });

  const githubRepositories = await getInstallationRepositories(input.installation.id);
  const persistedRepositories = await db.repository.findMany({
    where: {
      installationId: installation.id,
    },
    select: {
      id: true,
      githubRepoId: true,
      syncEnabled: true,
    },
  });

  const staleRepositoryIds = getStaleRepositoryIds({
    persistedRepositories,
    githubRepositoryIds: githubRepositories.map((repository) => repository.id),
  });

  if (staleRepositoryIds.length > 0) {
    await db.$transaction([
      db.dailyUserRepoStats.deleteMany({
        where: {
          repositoryId: {
            in: staleRepositoryIds,
          },
        },
      }),
      db.pullRequest.deleteMany({
        where: {
          repositoryId: {
            in: staleRepositoryIds,
          },
        },
      }),
      db.syncCursor.deleteMany({
        where: {
          repositoryId: {
            in: staleRepositoryIds,
          },
        },
      }),
      db.repository.deleteMany({
        where: {
          id: {
            in: staleRepositoryIds,
          },
        },
      }),
    ]);
  }

  const persistedRepositoryMap = new Map(
    persistedRepositories.map((repository) => [repository.githubRepoId, repository]),
  );
  let enabledRepositoryCount = persistedRepositories.filter(
    (repository) => repository.syncEnabled,
  ).length;

  const sortedGithubRepositories = [...githubRepositories].sort((left, right) =>
    left.full_name.localeCompare(right.full_name),
  );

  for (const repository of sortedGithubRepositories) {
    const persistedRepository = persistedRepositoryMap.get(repository.id);
    const nextSyncEnabled =
      persistedRepository?.syncEnabled ??
      enabledRepositoryCount < MAX_TRACKED_REPOSITORIES_PER_INSTALLATION;

    if (!persistedRepository && nextSyncEnabled) {
      enabledRepositoryCount += 1;
    }

    await db.repository.upsert({
      where: {
        githubRepoId: repository.id,
      },
      update: {
        owner: repository.owner.login,
        name: repository.name,
        defaultBranch: repository.default_branch,
        isPrivate: repository.private,
        installationId: installation.id,
        syncEnabled: nextSyncEnabled,
      },
      create: {
        githubRepoId: repository.id,
        owner: repository.owner.login,
        name: repository.name,
        defaultBranch: repository.default_branch,
        isPrivate: repository.private,
        installationId: installation.id,
        syncEnabled: nextSyncEnabled,
      },
    });
  }

  const repositories = await db.repository.findMany({
    where: {
      installationId: installation.id,
    },
    orderBy: {
      name: "asc",
    },
  });

  return {
    installation,
    repositories,
  };
}

async function upsertPullRequestAuthor(detail: GitHubPullRequestDetail) {
  if (!detail.user) {
    return null;
  }

  return db.gitHubAccount.upsert({
    where: {
      githubUserId: detail.user.id,
    },
    update: {
      login: detail.user.login,
      avatarUrl: detail.user.avatar_url,
    },
    create: {
      githubUserId: detail.user.id,
      login: detail.user.login,
      avatarUrl: detail.user.avatar_url,
    },
  });
}

async function applyDailyStatsDelta(input: {
  accountId: string;
  repositoryId: string;
  day: Date;
  additionsDelta: number;
  deletionsDelta: number;
  mergedPrCountDelta: number;
  commitCountDelta: number;
}) {
  if (
    input.additionsDelta === 0 &&
    input.deletionsDelta === 0 &&
    input.mergedPrCountDelta === 0 &&
    input.commitCountDelta === 0
  ) {
    return;
  }

  const existing = await db.dailyUserRepoStats.findUnique({
    where: {
      accountId_repositoryId_day: {
        accountId: input.accountId,
        repositoryId: input.repositoryId,
        day: input.day,
      },
    },
  });

  const nextAdditions = (existing?.additions ?? 0) + input.additionsDelta;
  const nextDeletions = (existing?.deletions ?? 0) + input.deletionsDelta;
  const nextMergedPrCount =
    (existing?.mergedPrCount ?? 0) + input.mergedPrCountDelta;
  const nextCommitCount = (existing?.commitCount ?? 0) + input.commitCountDelta;

  if (
    nextAdditions <= 0 &&
    nextDeletions <= 0 &&
    nextMergedPrCount <= 0 &&
    nextCommitCount <= 0
  ) {
    if (existing) {
      await db.dailyUserRepoStats.delete({
        where: {
          id: existing.id,
        },
      });
    }

    return;
  }

  await db.dailyUserRepoStats.upsert({
    where: {
      accountId_repositoryId_day: {
        accountId: input.accountId,
        repositoryId: input.repositoryId,
        day: input.day,
      },
    },
    update: {
      additions: nextAdditions,
      deletions: nextDeletions,
      mergedPrCount: nextMergedPrCount,
      commitCount: nextCommitCount,
    },
    create: {
      accountId: input.accountId,
      repositoryId: input.repositoryId,
      day: input.day,
      additions: nextAdditions,
      deletions: nextDeletions,
      mergedPrCount: nextMergedPrCount,
      commitCount: nextCommitCount,
    },
  });
}

async function applyPullRequestToDailyStats(input: {
  repositoryId: string;
  detail: GitHubPullRequestDetail;
}) {
  if (!input.detail.merged_at) {
    return;
  }

  const author = await upsertPullRequestAuthor(input.detail);
  const mergedAt = new Date(input.detail.merged_at);
  const day = getUtcDay(mergedAt);
  const existing = await db.pullRequest.findUnique({
    where: {
      repositoryId_githubPrNumber: {
        repositoryId: input.repositoryId,
        githubPrNumber: input.detail.number,
      },
    },
  });

  if (existing?.authorId) {
    await applyDailyStatsDelta({
      accountId: existing.authorId,
      repositoryId: input.repositoryId,
      day: getUtcDay(existing.mergedAt ?? existing.openedAt),
      additionsDelta: -existing.additions,
      deletionsDelta: -existing.deletions,
      mergedPrCountDelta: -1,
      commitCountDelta: -existing.commitCount,
    });
  }

  const pullRequest = await db.pullRequest.upsert({
    where: {
      repositoryId_githubPrNumber: {
        repositoryId: input.repositoryId,
        githubPrNumber: input.detail.number,
      },
    },
    update: {
      authorId: author?.id ?? null,
      title: input.detail.title,
      baseBranch: input.detail.base.ref,
      headBranch: input.detail.head.ref,
      state: input.detail.state,
      additions: input.detail.additions,
      deletions: input.detail.deletions,
      commitCount: input.detail.commits,
      openedAt: new Date(input.detail.created_at),
      mergedAt,
    },
    create: {
      repositoryId: input.repositoryId,
      githubPrNumber: input.detail.number,
      authorId: author?.id ?? null,
      title: input.detail.title,
      baseBranch: input.detail.base.ref,
      headBranch: input.detail.head.ref,
      state: input.detail.state,
      additions: input.detail.additions,
      deletions: input.detail.deletions,
      commitCount: input.detail.commits,
      openedAt: new Date(input.detail.created_at),
      mergedAt,
    },
  });

  if (!pullRequest.authorId) {
    return;
  }

  await applyDailyStatsDelta({
    accountId: pullRequest.authorId,
    repositoryId: input.repositoryId,
    day,
    additionsDelta: pullRequest.additions,
    deletionsDelta: pullRequest.deletions,
    mergedPrCountDelta: 1,
    commitCountDelta: pullRequest.commitCount,
  });
}

async function syncMergedPullRequestsForRepository(input: {
  repositoryId: string;
  githubInstallationId: number;
  owner: string;
  repo: string;
  installationId: string;
  jobId: string;
  leaseToken: string;
  stats: ActivitySyncStats;
}) {
  const startedAt = Date.now();
  const cursor = await db.syncCursor.findUnique({
    where: {
      repositoryId_scope: {
        repositoryId: input.repositoryId,
        scope: MERGED_PULL_REQUEST_SCOPE,
      },
    },
  });

  await renewSyncJobLease({
    jobId: input.jobId,
    leaseToken: input.leaseToken,
  });

  const mergedPullRequests = await listMergedPullRequests({
    owner: input.owner,
    repo: input.repo,
    installationId: input.githubInstallationId,
    updatedSince: cursor?.cursorValue ?? getInitialActivitySyncSinceIsoString(),
    options: getGitHubRetryObserver(input.stats),
  });

  input.stats.fetchedPullRequestCount += mergedPullRequests.length;

  if (mergedPullRequests.length === 0) {
    input.stats.syncedRepositoryCount += 1;
    input.stats.repositoryDurationsMs.push(Date.now() - startedAt);
    return;
  }

  let latestUpdatedAt = cursor?.cursorValue ?? null;

  for (const pullRequest of mergedPullRequests) {
    await renewSyncJobLease({
      jobId: input.jobId,
      leaseToken: input.leaseToken,
    });

    const detail = await getPullRequestDetail({
      owner: input.owner,
      repo: input.repo,
      pullNumber: pullRequest.number,
      installationId: input.githubInstallationId,
      options: getGitHubRetryObserver(input.stats),
    });

    await applyPullRequestToDailyStats({
      repositoryId: input.repositoryId,
      detail,
    });

    input.stats.processedPullRequestCount += 1;

    if (!latestUpdatedAt || new Date(detail.updated_at) > new Date(latestUpdatedAt)) {
      latestUpdatedAt = detail.updated_at;
    }
  }

  if (latestUpdatedAt) {
    await db.syncCursor.upsert({
      where: {
        repositoryId_scope: {
          repositoryId: input.repositoryId,
          scope: MERGED_PULL_REQUEST_SCOPE,
        },
      },
      update: {
        installationId: input.installationId,
        cursorValue: latestUpdatedAt,
      },
      create: {
        installationId: input.installationId,
        repositoryId: input.repositoryId,
        scope: MERGED_PULL_REQUEST_SCOPE,
        cursorValue: latestUpdatedAt,
      },
    });
  }

  input.stats.syncedRepositoryCount += 1;
  input.stats.repositoryDurationsMs.push(Date.now() - startedAt);
}

export async function syncInstallationMetadataForAccount(input: {
  githubInstallationId: number;
  accountId: string;
  userAccessToken: string;
}) {
  const accessibleInstallations = await getUserInstallations(input.userAccessToken);
  const targetInstallation = accessibleInstallations.find(
    (installation) => installation.id === input.githubInstallationId,
  );

  if (!targetInstallation) {
    throw new Error("Installation not accessible to the current user");
  }

  return syncInstallationRepositories({
    installation: targetInstallation,
    accountId: input.accountId,
  });
}

export async function syncAllInstallationMetadataForAccount(input: {
  accountId: string;
  userAccessToken: string;
}) {
  const accessibleInstallations = await getUserInstallations(input.userAccessToken);

  return Promise.all(
    accessibleInstallations.map((installation) =>
      syncInstallationRepositories({
        installation,
        accountId: input.accountId,
      }),
    ),
  );
}

export async function updateTrackedRepositoriesForInstallation(input: {
  installationId: string;
  repositoryIds: string[];
}) {
  const repositories = await db.repository.findMany({
    where: {
      installationId: input.installationId,
    },
    select: {
      id: true,
    },
  });

  const allowedRepositoryIds = new Set(repositories.map((repository) => repository.id));
  const selectedRepositoryIds = Array.from(
    new Set(
      input.repositoryIds.filter((repositoryId) => allowedRepositoryIds.has(repositoryId)),
    ),
  );

  if (selectedRepositoryIds.length > MAX_TRACKED_REPOSITORIES_PER_INSTALLATION) {
    throw new Error(
      `Select at most ${MAX_TRACKED_REPOSITORIES_PER_INSTALLATION} repositories per installation.`,
    );
  }

  await db.$transaction([
    db.repository.updateMany({
      where: {
        installationId: input.installationId,
      },
      data: {
        syncEnabled: false,
      },
    }),
    ...(selectedRepositoryIds.length > 0
      ? [
          db.repository.updateMany({
            where: {
              installationId: input.installationId,
              id: {
                in: selectedRepositoryIds,
              },
            },
            data: {
              syncEnabled: true,
            },
          }),
        ]
      : []),
    db.installation.update({
      where: {
        id: input.installationId,
      },
      data: {
        syncSelectionUpdatedAt: new Date(),
      },
    }),
  ]);
}

export async function enqueueActivitySyncForAccount(input: {
  accountId: string;
  userAccessToken: string;
}) {
  const installationSyncs = await syncAllInstallationMetadataForAccount({
    accountId: input.accountId,
    userAccessToken: input.userAccessToken,
  });

  let queuedJobCount = 0;

  for (const installationSync of installationSyncs) {
    const { selectedRepositories, skippedRepositoryCount } = getTrackedRepositories(
      installationSync.repositories,
    );

    if (selectedRepositories.length === 0) {
      continue;
    }

    const existingJob = await db.syncJob.findFirst({
      where: {
        accountId: input.accountId,
        installationId: installationSync.installation.id,
        scope: "activity",
        status: {
          in: ["queued", "running"],
        },
      },
      select: {
        id: true,
      },
    });

    if (existingJob) {
      continue;
    }

    await db.syncJob.create({
      data: {
        accountId: input.accountId,
        installationId: installationSync.installation.id,
        scope: "activity",
        status: "queued",
        resultJson: JSON.stringify({
          selectedRepositoryCount: selectedRepositories.length,
          skippedRepositoryCount,
        } satisfies SyncJobResult),
      },
    });
    queuedJobCount += 1;
  }

  return {
    queuedJobCount,
    installationCount: installationSyncs.length,
  };
}

async function enqueueLeaderboardRefreshJob(input: {
  accountId: string;
  installationId: string;
}) {
  const existingJob = await db.syncJob.findFirst({
    where: {
      accountId: input.accountId,
      installationId: input.installationId,
      scope: "leaderboard",
      status: {
        in: ["queued", "running"],
      },
    },
    select: {
      id: true,
    },
  });

  if (existingJob) {
    return;
  }

  await db.syncJob.create({
    data: {
      accountId: input.accountId,
      installationId: input.installationId,
      scope: "leaderboard",
      status: "queued",
    },
  });
}

async function processActivitySyncJob(input: {
  job: SyncJob;
  leaseToken: string;
}) {
  const installation = await db.installation.findUnique({
    where: {
      id: input.job.installationId,
    },
    include: {
      repositories: {
        where: {
          syncEnabled: true,
        },
        orderBy: {
          name: "asc",
        },
      },
    },
  });

  if (!installation) {
    await failSyncJob({
      job: input.job,
      errorMessage: "Installation no longer exists.",
    });
    return {
      status: "failed" as const,
    };
  }

  const { selectedRepositories, skippedRepositoryCount } = getTrackedRepositories(
    installation.repositories,
  );
  const stats: ActivitySyncStats = {
    selectedRepositoryCount: selectedRepositories.length,
    skippedRepositoryCount,
    syncedRepositoryCount: 0,
    fetchedPullRequestCount: 0,
    processedPullRequestCount: 0,
    githubRetryCount: 0,
    githubRetryDelayMs: 0,
    repositoryDurationsMs: [],
  };

  if (selectedRepositories.length === 0) {
    await completeSyncJob({
      jobId: input.job.id,
      leaseToken: input.leaseToken,
      result: getActivitySyncStatsResult(stats, {
        createdAt: input.job.createdAt,
        startedAt: input.job.startedAt,
      }),
    });
    return {
      status: "completed" as const,
    };
  }

  try {
    for (const repository of selectedRepositories) {
      await syncMergedPullRequestsForRepository({
        repositoryId: repository.id,
        githubInstallationId: installation.githubInstallId,
        owner: repository.owner,
        repo: repository.name,
        installationId: installation.id,
        jobId: input.job.id,
        leaseToken: input.leaseToken,
        stats,
      });
    }

    await completeSyncJob({
      jobId: input.job.id,
      leaseToken: input.leaseToken,
      result: getActivitySyncStatsResult(stats, {
        createdAt: input.job.createdAt,
        startedAt: input.job.startedAt,
      }),
    });

    if (input.job.accountId) {
      await enqueueLeaderboardRefreshJob({
        accountId: input.job.accountId,
        installationId: input.job.installationId,
      });
    }

    return {
      status: "completed" as const,
    };
  } catch (error) {
    const result = getActivitySyncStatsResult(stats, {
      createdAt: input.job.createdAt,
      startedAt: input.job.startedAt,
    });
    const retryDelayMs = getGitHubRetryDelayMs(error);

    if (retryDelayMs) {
      await deferSyncJob({
        jobId: input.job.id,
        leaseToken: input.leaseToken,
        resumeAt: new Date(Date.now() + retryDelayMs),
        errorMessage:
          error instanceof Error ? error.message : "GitHub API rate limited",
        result,
      });
      return {
        status: "deferred" as const,
      };
    }

    await failSyncJob({
      job: input.job,
      errorMessage:
        error instanceof Error ? error.message : "Activity sync failed",
      result,
    });
    return {
      status: "failed" as const,
    };
  }
}

async function processLeaderboardSyncJob(input: {
  job: SyncJob;
  leaseToken: string;
}) {
  try {
    await refreshLeaderboardSnapshotsForAccount();
    await completeSyncJob({
      jobId: input.job.id,
      leaseToken: input.leaseToken,
    });
    return {
      status: "completed" as const,
    };
  } catch (error) {
    await failSyncJob({
      job: input.job,
      errorMessage:
        error instanceof Error ? error.message : "Leaderboard refresh failed",
    });
    return {
      status: "failed" as const,
    };
  }
}

export async function processClaimedSyncJob(input: {
  job: SyncJob;
  leaseToken: string;
}) {
  if (input.job.scope === "leaderboard") {
    return processLeaderboardSyncJob(input);
  }

  return processActivitySyncJob(input);
}
