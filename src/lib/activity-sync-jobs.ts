import { randomUUID } from "node:crypto";

import type { Prisma, SyncJob } from "@prisma/client";

import { db } from "@/lib/db";

const ACTIVITY_SYNC_STALE_MINUTES = 60;
const SYNC_JOB_LEASE_MINUTES = 2;
const SYNC_HEALTH_LOOKBACK_HOURS = 24;

export const MAX_TRACKED_REPOSITORIES_PER_INSTALLATION = 25;

export type SyncJobResult = {
  selectedRepositoryCount?: number;
  skippedRepositoryCount?: number;
  syncedRepositoryCount?: number;
  processedPullRequestCount?: number;
  fetchedPullRequestCount?: number;
  githubRetryCount?: number;
  githubRetryDelayMs?: number;
  averageRepositoryDurationMs?: number;
  queueDelayMs?: number;
  durationMs?: number;
  deferredUntil?: string;
};

function getActivitySyncStaleCutoff() {
  return new Date(Date.now() - ACTIVITY_SYNC_STALE_MINUTES * 60 * 1000);
}

function getSyncJobLeaseExpiry() {
  return new Date(Date.now() + SYNC_JOB_LEASE_MINUTES * 60 * 1000);
}

function stringifySyncJobResult(result?: SyncJobResult | null) {
  if (!result) {
    return null;
  }

  return JSON.stringify(result);
}

export function parseSyncJobResult(resultJson?: string | null) {
  if (!resultJson) {
    return null;
  }

  try {
    return JSON.parse(resultJson) as SyncJobResult;
  } catch {
    return null;
  }
}

export async function failStaleActivitySyncJobs(installationIds: string[]) {
  if (installationIds.length === 0) {
    return;
  }

  await db.syncJob.updateMany({
    where: {
      installationId: {
        in: installationIds,
      },
      scope: "activity",
      status: {
        in: ["queued", "running"],
      },
      updatedAt: {
        lt: getActivitySyncStaleCutoff(),
      },
    },
    data: {
      status: "failed",
      finishedAt: new Date(),
      leaseToken: null,
      leaseExpiresAt: null,
      errorMessage:
        "Marked stale after exceeding the activity sync execution window.",
    },
  });
}

export function getActiveActivitySyncWhere(
  installationIds: string[],
): Prisma.SyncJobWhereInput {
  return {
    installationId: {
      in: installationIds,
    },
    scope: "activity",
    status: {
      in: ["queued", "running"],
    },
    updatedAt: {
      gte: getActivitySyncStaleCutoff(),
    },
  };
}

async function tryClaimQueuedJob(accountId: string, scope: string) {
  const now = new Date();
  const candidate = await db.syncJob.findFirst({
    where: {
      accountId,
      scope,
      OR: [
        {
          status: "queued",
        },
        {
          status: "running",
          leaseExpiresAt: {
            lt: now,
          },
        },
      ],
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!candidate) {
    return null;
  }

  const leaseToken = randomUUID();
  const claimed = await db.syncJob.updateMany({
    where: {
      id: candidate.id,
      accountId,
      scope,
      OR: [
        {
          status: "queued",
        },
        {
          status: "running",
          leaseExpiresAt: {
            lt: now,
          },
        },
      ],
    },
    data: {
      status: "running",
      leaseToken,
      leaseExpiresAt: getSyncJobLeaseExpiry(),
      startedAt: candidate.startedAt ?? now,
      finishedAt: null,
      attemptCount: {
        increment: 1,
      },
    },
  });

  if (claimed.count === 0) {
    return null;
  }

  const job = await db.syncJob.findUnique({
    where: {
      id: candidate.id,
    },
  });

  if (!job) {
    return null;
  }

  return { job, leaseToken };
}

export async function claimNextSyncJobForAccount(accountId: string) {
  for (const scope of ["activity", "leaderboard"]) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const claimed = await tryClaimQueuedJob(accountId, scope);

      if (claimed) {
        return claimed;
      }
    }
  }

  return null;
}

export async function renewSyncJobLease(input: {
  jobId: string;
  leaseToken: string;
}) {
  await db.syncJob.updateMany({
    where: {
      id: input.jobId,
      leaseToken: input.leaseToken,
      status: "running",
    },
    data: {
      leaseExpiresAt: getSyncJobLeaseExpiry(),
    },
  });
}

export async function completeSyncJob(input: {
  jobId: string;
  leaseToken: string;
  result?: SyncJobResult | null;
}) {
  await db.syncJob.updateMany({
    where: {
      id: input.jobId,
      leaseToken: input.leaseToken,
      status: "running",
    },
    data: {
      status: "completed",
      finishedAt: new Date(),
      leaseToken: null,
      leaseExpiresAt: null,
      errorMessage: null,
      resultJson: stringifySyncJobResult(input.result),
    },
  });
}

export async function deferSyncJob(input: {
  jobId: string;
  leaseToken: string;
  resumeAt: Date;
  errorMessage: string;
  result?: SyncJobResult | null;
}) {
  await db.syncJob.updateMany({
    where: {
      id: input.jobId,
      leaseToken: input.leaseToken,
      status: "running",
    },
    data: {
      status: "running",
      finishedAt: null,
      errorMessage: input.errorMessage,
      leaseExpiresAt: input.resumeAt,
      resultJson: stringifySyncJobResult({
        ...input.result,
        deferredUntil: input.resumeAt.toISOString(),
      }),
    },
  });
}

export async function failSyncJob(input: {
  job: Pick<SyncJob, "id" | "leaseToken" | "attemptCount" | "maxAttempts">;
  errorMessage: string;
  result?: SyncJobResult | null;
}) {
  if (!input.job.leaseToken) {
    return;
  }

  const shouldRetry = input.job.attemptCount < input.job.maxAttempts;
  await db.syncJob.updateMany({
    where: {
      id: input.job.id,
      leaseToken: input.job.leaseToken,
      status: "running",
    },
    data: shouldRetry
      ? {
          status: "queued",
          leaseToken: null,
          leaseExpiresAt: null,
          errorMessage: input.errorMessage,
          resultJson: stringifySyncJobResult(input.result),
        }
      : {
          status: "failed",
          finishedAt: new Date(),
          leaseToken: null,
          leaseExpiresAt: null,
          errorMessage: input.errorMessage,
          resultJson: stringifySyncJobResult(input.result),
        },
  });
}

export async function getAccountSyncHealth(input: {
  accountId: string;
  installationIds: string[];
}) {
  const lookbackStart = new Date(
    Date.now() - SYNC_HEALTH_LOOKBACK_HOURS * 60 * 60 * 1000,
  );

  const jobs = await db.syncJob.findMany({
    where: {
      accountId: input.accountId,
      scope: "activity",
      installationId: {
        in: input.installationIds,
      },
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      startedAt: true,
      finishedAt: true,
      updatedAt: true,
      errorMessage: true,
      resultJson: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 25,
  });

  const queuedJobs = jobs.filter((job) => job.status === "queued").length;
  const runningJobs = jobs.filter((job) => job.status === "running").length;
  const recentJobs = jobs.filter((job) => job.createdAt >= lookbackStart);
  const completedJobs = recentJobs.filter((job) => job.status === "completed");
  const failedJobs = recentJobs.filter((job) => job.status === "failed");
  const completedDurations = completedJobs
    .map((job) =>
      job.startedAt && job.finishedAt
        ? job.finishedAt.getTime() - job.startedAt.getTime()
        : null,
    )
    .filter((duration): duration is number => duration !== null && duration >= 0);
  const latestCompletedJob = completedJobs.find((job) => job.finishedAt);
  const latestResult = parseSyncJobResult(latestCompletedJob?.resultJson);

  return {
    queuedJobs,
    runningJobs,
    completedLast24Hours: completedJobs.length,
    failedLast24Hours: failedJobs.length,
    averageDurationMs:
      completedDurations.length > 0
        ? Math.round(
            completedDurations.reduce((sum, duration) => sum + duration, 0) /
              completedDurations.length,
          )
        : null,
    latestCompletedAt: latestCompletedJob?.finishedAt ?? null,
    latestResult,
    latestError: jobs.find((job) => job.status === "failed")?.errorMessage ?? null,
  };
}
