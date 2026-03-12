import { NextRequest, NextResponse } from "next/server";

import { canEnableHostedGitHubSync } from "@/lib/env";
import { syncInstallationMetadataForAccount } from "@/lib/installation-sync";
import { getValidUserAccessToken } from "@/lib/session";

type RouteContext = {
  params: Promise<{
    installationId: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  if (!canEnableHostedGitHubSync()) {
    return NextResponse.redirect(new URL("/?github=missing-config", request.url));
  }

  const { installationId: installationIdParam } = await context.params;
  const installationId = Number.parseInt(installationIdParam, 10);

  if (Number.isNaN(installationId)) {
    return NextResponse.redirect(new URL("/?github=invalid-installation", request.url));
  }

  const session = await getValidUserAccessToken();

  if (!session) {
    return NextResponse.redirect(new URL("/?github=not-connected", request.url));
  }

  try {
    await syncInstallationMetadataForAccount({
      githubInstallationId: installationId,
      accountId: session.session.accountId,
      userAccessToken: session.accessToken,
    });

    return NextResponse.redirect(new URL("/?github=repositories-refreshed", request.url));
  } catch {
    return NextResponse.redirect(new URL("/?github=sync-failed", request.url));
  }
}
