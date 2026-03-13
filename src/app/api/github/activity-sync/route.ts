import { after, NextRequest, NextResponse } from "next/server";

import { canEnableHostedGitHubSync } from "@/lib/env";
import { dispatchActivitySync } from "@/lib/activity-sync-dispatch";
import { db } from "@/lib/db";
import { syncUserActivityForAccount } from "@/lib/installation-sync";
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
  const runningSync = installationIds.length
    ? await db.syncJob.findFirst({
        where: {
          installationId: {
            in: installationIds,
          },
          scope: "activity",
          status: "running",
        },
      })
    : null;

  if (runningSync) {
    return NextResponse.redirect(
      new URL("/?github=activity-sync-running", request.url),
    );
  }

  dispatchActivitySync(after, async () => {
    await syncUserActivityForAccount({
      accountId: session.session.accountId,
      userAccessToken: session.accessToken,
    });
  });

  return NextResponse.redirect(new URL("/?github=activity-sync-started", request.url));
}
