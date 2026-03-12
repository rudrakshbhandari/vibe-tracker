import { NextRequest, NextResponse } from "next/server";

import { canEnableHostedGitHubSync } from "@/lib/env";
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

  try {
    await syncUserActivityForAccount({
      accountId: session.session.accountId,
      authorLogin: session.session.account.login,
      userAccessToken: session.accessToken,
    });

    return NextResponse.redirect(new URL("/?github=activity-synced", request.url));
  } catch {
    return NextResponse.redirect(new URL("/?github=activity-sync-failed", request.url));
  }
}
