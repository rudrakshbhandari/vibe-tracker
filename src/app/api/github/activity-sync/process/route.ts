import { NextResponse } from "next/server";

import { claimNextSyncJobForAccount } from "@/lib/activity-sync-jobs";
import { canEnableHostedGitHubSync } from "@/lib/env";
import { processClaimedSyncJob } from "@/lib/installation-sync";
import { getValidUserAccessToken } from "@/lib/session";

export async function POST() {
  if (!canEnableHostedGitHubSync()) {
    return NextResponse.json(
      {
        status: "disabled",
      },
      { status: 503 },
    );
  }

  const session = await getValidUserAccessToken();

  if (!session) {
    return NextResponse.json(
      {
        status: "unauthorized",
      },
      { status: 401 },
    );
  }

  const claimed = await claimNextSyncJobForAccount(session.session.accountId);

  if (!claimed) {
    return NextResponse.json({
      status: "idle",
    });
  }

  const result = await processClaimedSyncJob(claimed);

  return NextResponse.json({
    status: result.status,
    scope: claimed.job.scope,
    jobId: claimed.job.id,
  });
}
