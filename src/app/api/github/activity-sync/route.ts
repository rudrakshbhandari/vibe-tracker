import { NextRequest, NextResponse } from "next/server";

import {
  failStaleActivitySyncJobs,
  getActiveActivitySyncWhere,
} from "@/lib/activity-sync-jobs";
import { canEnableHostedGitHubSync } from "@/lib/env";
import { db } from "@/lib/db";
import { enqueueActivitySyncForAccount } from "@/lib/installation-sync";
import { getValidUserAccessToken } from "@/lib/session";

export async function POST(request: NextRequest) {
  if (!canEnableHostedGitHubSync()) {
    return NextResponse.redirect(new URL("/?github=missing-config", request.url));
  }

  const session = await getValidUserAccessToken();

  if (!session) {
    return NextResponse.redirect(new URL("/?github=not-connected", request.url));
  }

  const installationIds = session.session.account.installationGrants.map(
    (grant) => grant.installation.id,
  );

  await failStaleActivitySyncJobs(installationIds);

  const runningSync = installationIds.length
    ? await db.syncJob.findFirst({
        where: getActiveActivitySyncWhere(installationIds),
      })
    : null;

  if (runningSync) {
    return NextResponse.redirect(
      new URL("/?github=activity-sync-running", request.url),
    );
  }

  try {
    await enqueueActivitySyncForAccount({
      accountId: session.session.accountId,
      userAccessToken: session.accessToken,
    });
  } catch {
    return NextResponse.redirect(new URL("/?github=sync-failed", request.url));
  }

  return NextResponse.redirect(new URL("/?github=activity-sync-started", request.url));
}
