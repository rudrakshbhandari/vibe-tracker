import { db } from "@/lib/db";
import {
  getInstallationRepositories,
  getPullRequestDetail,
  getUserInstallations,
  listMergedPullRequests,
  type GitHubInstallation,
  type GitHubPullRequestDetail,
} from "@/lib/github";
import { getStaleRepositoryIds } from "@/lib/repository-sync";
import { refreshLeaderboardSnapshotsForAccount } from "@/lib/social";

const ACTIVITY_SYNC_LOOKBACK_DAYS = 90;
const MERGED_PULL_REQUEST_SCOPE = "merged_prs";

function getInitialActivitySyncSinceIsoString() {
  return new Date(
    Date.now() - ACTIVITY_SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
}

function getUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
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

  await Promise.all(
    githubRepositories.map((repository) =>
      db.repository.upsert({
        where: {
          githubRepoId: repository.id,
        },
        update: {
          owner: repository.owner.login,
          name: repository.name,
          defaultBranch: repository.default_branch,
          isPrivate: repository.private,
          installationId: installation.id,
        },
        create: {
          githubRepoId: repository.id,
          owner: repository.owner.login,
          name: repository.name,
          defaultBranch: repository.default_branch,
          isPrivate: repository.private,
          installationId: installation.id,
        },
      }),
    ),
  );

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
}) {
  const cursor = await db.syncCursor.findUnique({
    where: {
      repositoryId_scope: {
        repositoryId: input.repositoryId,
        scope: MERGED_PULL_REQUEST_SCOPE,
      },
    },
  });

  const mergedPullRequests = await listMergedPullRequests({
    owner: input.owner,
    repo: input.repo,
    installationId: input.githubInstallationId,
    updatedSince: cursor?.cursorValue ?? getInitialActivitySyncSinceIsoString(),
  });

  if (mergedPullRequests.length === 0) {
    return;
  }

  let latestUpdatedAt = cursor?.cursorValue ?? null;

  for (const pullRequest of mergedPullRequests) {
    const detail = await getPullRequestDetail({
      owner: input.owner,
      repo: input.repo,
      pullNumber: pullRequest.number,
      installationId: input.githubInstallationId,
    });

    await applyPullRequestToDailyStats({
      repositoryId: input.repositoryId,
      detail,
    });

    if (!latestUpdatedAt || new Date(detail.updated_at) > new Date(latestUpdatedAt)) {
      latestUpdatedAt = detail.updated_at;
    }
  }

  if (!latestUpdatedAt) {
    return;
  }

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

export async function syncUserActivityForAccount(input: {
  accountId: string;
  userAccessToken: string;
}) {
  const installationSyncs = await syncAllInstallationMetadataForAccount({
    accountId: input.accountId,
    userAccessToken: input.userAccessToken,
  });

  const syncJobs = await Promise.all(
    installationSyncs.map(({ installation }) =>
      db.syncJob.create({
        data: {
          installationId: installation.id,
          scope: "activity",
          status: "queued",
        },
      }),
    ),
  );

  try {
    for (const syncJob of syncJobs) {
      await db.syncJob.update({
        where: {
          id: syncJob.id,
        },
        data: {
          status: "running",
          startedAt: new Date(),
        },
      });

      const installationSync = installationSyncs.find(
        (entry) => entry.installation.id === syncJob.installationId,
      );

      if (!installationSync) {
        continue;
      }

      for (const repository of installationSync.repositories) {
        await syncMergedPullRequestsForRepository({
          repositoryId: repository.id,
          githubInstallationId: installationSync.installation.githubInstallId,
          owner: repository.owner,
          repo: repository.name,
          installationId: installationSync.installation.id,
        });
      }

      await db.syncJob.update({
        where: {
          id: syncJob.id,
        },
        data: {
          status: "completed",
          finishedAt: new Date(),
        },
      });
    }
    await refreshLeaderboardSnapshotsForAccount();
  } catch (error) {
    await Promise.all(
      syncJobs.map((syncJob) =>
        db.syncJob.update({
          where: {
            id: syncJob.id,
          },
          data: {
            status: "failed",
            finishedAt: new Date(),
            errorMessage:
              error instanceof Error ? error.message : "Activity sync failed",
          },
        }),
      ),
    );
    throw error;
  }
}
