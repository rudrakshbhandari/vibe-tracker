import { db } from "@/lib/db";
import {
  getAssociatedPullRequests,
  getCommitDetail,
  getInstallationRepositories,
  getUserInstallations,
  listBranchCommits,
  listRepositoryBranches,
  type GitHubInstallation,
} from "@/lib/github";
import { getStaleRepositoryIds } from "@/lib/repository-sync";
import { refreshLeaderboardSnapshotsForAccount } from "@/lib/social";

const ACTIVITY_SYNC_LOOKBACK_DAYS = 365;

function getActivitySyncSinceIsoString() {
  return new Date(
    Date.now() - ACTIVITY_SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
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

  const githubRepositories = await getInstallationRepositories(
    input.installation.id,
  );
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
      db.pullRequestCommit.deleteMany({
        where: {
          OR: [
            {
              pullRequest: {
                repositoryId: {
                  in: staleRepositoryIds,
                },
              },
            },
            {
              commit: {
                repositoryId: {
                  in: staleRepositoryIds,
                },
              },
            },
          ],
        },
      }),
      db.commitBranch.deleteMany({
        where: {
          OR: [
            {
              commit: {
                repositoryId: {
                  in: staleRepositoryIds,
                },
              },
            },
            {
              branch: {
                repositoryId: {
                  in: staleRepositoryIds,
                },
              },
            },
          ],
        },
      }),
      db.pullRequest.deleteMany({
        where: {
          repositoryId: {
            in: staleRepositoryIds,
          },
        },
      }),
      db.commit.deleteMany({
        where: {
          repositoryId: {
            in: staleRepositoryIds,
          },
        },
      }),
      db.branch.deleteMany({
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

async function syncRepositoryActivity(input: {
  repositoryId: string;
  githubInstallationId: number;
  owner: string;
  repo: string;
  defaultBranch: string;
  authorLogin: string;
}) {
  const since = getActivitySyncSinceIsoString();
  const branches = await listRepositoryBranches({
    owner: input.owner,
    repo: input.repo,
    installationId: input.githubInstallationId,
  });

  const branchRecords = await Promise.all(
    branches.map((branch) =>
      db.branch.upsert({
        where: {
          repositoryId_name: {
            repositoryId: input.repositoryId,
            name: branch.name,
          },
        },
        update: {},
        create: {
          repositoryId: input.repositoryId,
          name: branch.name,
        },
      }),
    ),
  );

  const branchMap = new Map(branchRecords.map((branch) => [branch.name, branch.id]));
  const cachedCommitIds = new Map<string, string>();

  for (const branch of branches) {
    const branchId = branchMap.get(branch.name);

    if (!branchId) {
      continue;
    }

    const commits = await listBranchCommits({
      owner: input.owner,
      repo: input.repo,
      branch: branch.name,
      since,
      author: input.authorLogin,
      installationId: input.githubInstallationId,
    });

    for (const commit of commits) {
      let commitId = cachedCommitIds.get(commit.sha);

      if (!commitId) {
        const detail = await getCommitDetail({
          owner: input.owner,
          repo: input.repo,
          sha: commit.sha,
          installationId: input.githubInstallationId,
        });

        let authorId: string | undefined;
        if (detail.author) {
          const author = await db.gitHubAccount.upsert({
            where: {
              githubUserId: detail.author.id,
            },
            update: {
              login: detail.author.login,
              avatarUrl: detail.author.avatar_url,
            },
            create: {
              githubUserId: detail.author.id,
              login: detail.author.login,
              avatarUrl: detail.author.avatar_url,
            },
          });
          authorId = author.id;
        }

        const commitRecord = await db.commit.upsert({
          where: {
            repositoryId_sha: {
              repositoryId: input.repositoryId,
              sha: detail.sha,
            },
          },
          update: {
            authorId,
            authorName: detail.commit.author?.name ?? null,
            authorEmail: detail.commit.author?.email ?? null,
            authoredAt: new Date(
              detail.commit.author?.date ??
                detail.commit.committer?.date ??
                new Date().toISOString(),
            ),
            committedAt: new Date(
              detail.commit.committer?.date ??
                detail.commit.author?.date ??
                new Date().toISOString(),
            ),
            messageHeadline: detail.commit.message.split("\n")[0] ?? detail.sha,
            additions: detail.stats?.additions ?? 0,
            deletions: detail.stats?.deletions ?? 0,
            changedFiles: detail.files?.length ?? null,
            mergedToDefaultBranch:
              branch.name === input.defaultBranch ? true : undefined,
          },
          create: {
            repositoryId: input.repositoryId,
            sha: detail.sha,
            authorId,
            authorName: detail.commit.author?.name ?? null,
            authorEmail: detail.commit.author?.email ?? null,
            authoredAt: new Date(
              detail.commit.author?.date ??
                detail.commit.committer?.date ??
                new Date().toISOString(),
            ),
            committedAt: new Date(
              detail.commit.committer?.date ??
                detail.commit.author?.date ??
                new Date().toISOString(),
            ),
            messageHeadline: detail.commit.message.split("\n")[0] ?? detail.sha,
            additions: detail.stats?.additions ?? 0,
            deletions: detail.stats?.deletions ?? 0,
            changedFiles: detail.files?.length ?? null,
            mergedToDefaultBranch: branch.name === input.defaultBranch,
          },
        });

        commitId = commitRecord.id;
        cachedCommitIds.set(commit.sha, commitRecord.id);

        const pullRequests = await getAssociatedPullRequests({
          owner: input.owner,
          repo: input.repo,
          sha: detail.sha,
          installationId: input.githubInstallationId,
        }).catch(() => []);

        for (const pullRequest of pullRequests) {
          const pullRequestRecord = await db.pullRequest.upsert({
            where: {
              repositoryId_githubPrNumber: {
                repositoryId: input.repositoryId,
                githubPrNumber: pullRequest.number,
              },
            },
            update: {
              title: pullRequest.title,
              state: pullRequest.state,
              baseBranch: pullRequest.base.ref,
              headBranch: pullRequest.head.ref,
              openedAt: new Date(pullRequest.created_at),
              mergedAt: pullRequest.merged_at
                ? new Date(pullRequest.merged_at)
                : null,
            },
            create: {
              repositoryId: input.repositoryId,
              githubPrNumber: pullRequest.number,
              title: pullRequest.title,
              state: pullRequest.state,
              baseBranch: pullRequest.base.ref,
              headBranch: pullRequest.head.ref,
              openedAt: new Date(pullRequest.created_at),
              mergedAt: pullRequest.merged_at
                ? new Date(pullRequest.merged_at)
                : null,
            },
          });

          await db.pullRequestCommit.upsert({
            where: {
              pullRequestId_commitId: {
                pullRequestId: pullRequestRecord.id,
                commitId: commitRecord.id,
              },
            },
            update: {},
            create: {
              pullRequestId: pullRequestRecord.id,
              commitId: commitRecord.id,
            },
          });

          if (
            pullRequest.base.ref === input.defaultBranch &&
            pullRequest.merged_at
          ) {
            await db.commit.update({
              where: {
                id: commitRecord.id,
              },
              data: {
                mergedToDefaultBranch: true,
              },
            });
          }
        }
      } else if (branch.name === input.defaultBranch) {
        await db.commit.update({
          where: {
            id: commitId,
          },
          data: {
            mergedToDefaultBranch: true,
          },
        });
      }

      await db.commitBranch.upsert({
        where: {
          commitId_branchId: {
            commitId,
            branchId,
          },
        },
        update: {},
        create: {
          commitId,
          branchId,
        },
      });
    }
  }
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
  authorLogin: string;
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
          status: "running",
          startedAt: new Date(),
        },
      }),
    ),
  );

  try {
    for (const installationSync of installationSyncs) {
      for (const repository of installationSync.repositories) {
        await syncRepositoryActivity({
          repositoryId: repository.id,
          githubInstallationId: installationSync.installation.githubInstallId,
          owner: repository.owner,
          repo: repository.name,
          defaultBranch: repository.defaultBranch,
          authorLogin: input.authorLogin,
        });
      }
    }

    await Promise.all(
      syncJobs.map((syncJob) =>
        db.syncJob.update({
          where: {
            id: syncJob.id,
          },
          data: {
            status: "completed",
            finishedAt: new Date(),
          },
        }),
      ),
    );

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
