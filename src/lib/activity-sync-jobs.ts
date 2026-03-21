import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

const ACTIVITY_SYNC_STALE_MINUTES = 15;

function getActivitySyncStaleCutoff() {
  return new Date(Date.now() - ACTIVITY_SYNC_STALE_MINUTES * 60 * 1000);
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
