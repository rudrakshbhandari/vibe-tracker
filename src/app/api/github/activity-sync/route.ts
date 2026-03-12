import { after, NextRequest, NextResponse } from "next/server";

import { canEnableHostedGitHubSync } from "@/lib/env";
import { dispatchActivitySync } from "@/lib/activity-sync-dispatch";
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

  dispatchActivitySync(after, async () => {
    await syncUserActivityForAccount({
      accountId: session.session.accountId,
      authorLogin: session.session.account.login,
      userAccessToken: session.accessToken,
    });
  });

  return NextResponse.redirect(new URL("/?github=activity-sync-started", request.url));
}
