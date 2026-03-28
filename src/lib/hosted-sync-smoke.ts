import { db, ensureHostedRepositorySchema } from "@/lib/db";
import {
  getInstallationRepositories,
  getPullRequestDetail,
  listMergedPullRequests,
} from "@/lib/github";

type SmokeTarget = {
  githubInstallationId: number;
  repositoryId: string;
  owner: string;
  repo: string;
  pullNumber: number;
};

class SmokeRollbackError extends Error {
  constructor() {
    super("Smoke test transaction rollback");
  }
}

async function getConfiguredSmokeTarget() {
  const installationId = process.env.SMOKE_TEST_INSTALLATION_ID;
  const owner = process.env.SMOKE_TEST_REPO_OWNER;
  const repo = process.env.SMOKE_TEST_REPO_NAME;

  if (!installationId || !owner || !repo) {
    return null;
  }

  const repository = await db.repository.findFirst({
    where: {
      owner,
      name: repo,
      installation: {
        githubInstallId: Number(installationId),
      },
    },
    include: {
      installation: true,
    },
  });

  if (!repository) {
    throw new Error("Configured smoke-test repository is not present in the database");
  }

  const configuredPullNumber = process.env.SMOKE_TEST_PR_NUMBER;

  if (configuredPullNumber) {
    return {
      githubInstallationId: repository.installation.githubInstallId,
      repositoryId: repository.id,
      owner: repository.owner,
      repo: repository.name,
      pullNumber: Number(configuredPullNumber),
    } satisfies SmokeTarget;
  }

  const mergedPullRequests = await listMergedPullRequests({
    owner: repository.owner,
    repo: repository.name,
    installationId: repository.installation.githubInstallId,
  });

  const latestMergedPullRequest = mergedPullRequests.find(
    (pullRequest) => pullRequest.merged_at,
  );

  if (!latestMergedPullRequest) {
    throw new Error("Configured smoke-test repository has no merged pull requests");
  }

  return {
    githubInstallationId: repository.installation.githubInstallId,
    repositoryId: repository.id,
    owner: repository.owner,
    repo: repository.name,
    pullNumber: latestMergedPullRequest.number,
  } satisfies SmokeTarget;
}

async function getStoredSmokeTarget() {
  const pullRequest = await db.pullRequest.findFirst({
    where: {
      mergedAt: {
        not: null,
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    include: {
      repository: {
        include: {
          installation: true,
        },
      },
    },
  });

  if (!pullRequest) {
    throw new Error(
      "Smoke test could not find any previously synced merged pull requests",
    );
  }

  return {
    githubInstallationId: pullRequest.repository.installation.githubInstallId,
    repositoryId: pullRequest.repositoryId,
    owner: pullRequest.repository.owner,
    repo: pullRequest.repository.name,
    pullNumber: pullRequest.githubPrNumber,
  } satisfies SmokeTarget;
}

async function getSmokeTarget() {
  return (await getConfiguredSmokeTarget()) ?? getStoredSmokeTarget();
}

export async function runHostedSyncSmokeTest() {
  await ensureHostedRepositorySchema();
  const target = await getSmokeTarget();
  const repositories = await getInstallationRepositories(
    target.githubInstallationId,
  );
  const repositoryGranted = repositories.some(
    (repository) =>
      repository.owner.login === target.owner && repository.name === target.repo,
  );

  if (!repositoryGranted) {
    throw new Error(
      "Smoke-test repository is no longer granted to the GitHub App installation",
    );
  }

  const detail = await getPullRequestDetail({
    owner: target.owner,
    repo: target.repo,
    pullNumber: target.pullNumber,
    installationId: target.githubInstallationId,
  });

  if (!detail.title.trim()) {
    throw new Error("Smoke-test pull request title is empty");
  }

  try {
    await db.$transaction(async (tx) => {
      const author = detail.user
        ? await tx.gitHubAccount.upsert({
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
          })
        : null;

      await tx.pullRequest.upsert({
        where: {
          repositoryId_githubPrNumber: {
            repositoryId: target.repositoryId,
            githubPrNumber: detail.number,
          },
        },
        update: {
          authorId: author?.id ?? null,
          title: detail.title,
          baseBranch: detail.base.ref,
          headBranch: detail.head.ref,
          state: detail.state,
          additions: detail.additions,
          deletions: detail.deletions,
          commitCount: detail.commits,
          openedAt: new Date(detail.created_at),
          mergedAt: detail.merged_at ? new Date(detail.merged_at) : null,
        },
        create: {
          repositoryId: target.repositoryId,
          githubPrNumber: detail.number,
          authorId: author?.id ?? null,
          title: detail.title,
          baseBranch: detail.base.ref,
          headBranch: detail.head.ref,
          state: detail.state,
          additions: detail.additions,
          deletions: detail.deletions,
          commitCount: detail.commits,
          openedAt: new Date(detail.created_at),
          mergedAt: detail.merged_at ? new Date(detail.merged_at) : null,
        },
      });

      throw new SmokeRollbackError();
    });
  } catch (error) {
    if (!(error instanceof SmokeRollbackError)) {
      throw error;
    }
  }

  return {
    owner: target.owner,
    repo: target.repo,
    pullNumber: target.pullNumber,
    title: detail.title,
  };
}
