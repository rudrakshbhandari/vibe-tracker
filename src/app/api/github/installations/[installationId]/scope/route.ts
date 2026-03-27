import { NextRequest, NextResponse } from "next/server";

import { MAX_TRACKED_REPOSITORIES_PER_INSTALLATION } from "@/lib/activity-sync-jobs";
import { canEnableHostedGitHubSync } from "@/lib/env";
import { updateTrackedRepositoriesForInstallation } from "@/lib/installation-sync";
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

  const session = await getValidUserAccessToken();

  if (!session) {
    return NextResponse.redirect(new URL("/?github=not-connected", request.url));
  }

  const { installationId: installationIdParam } = await context.params;
  const githubInstallationId = Number.parseInt(installationIdParam, 10);

  if (Number.isNaN(githubInstallationId)) {
    return NextResponse.redirect(new URL("/?github=invalid-installation", request.url));
  }

  const installationGrant = session.session.account.installationGrants.find(
    (grant) => grant.installation.githubInstallId === githubInstallationId,
  );

  if (!installationGrant) {
    return NextResponse.redirect(new URL("/?github=invalid-installation", request.url));
  }

  const formData = await request.formData();
  const repositoryIds = formData
    .getAll("repositoryIds")
    .filter((value): value is string => typeof value === "string");

  if (repositoryIds.length > MAX_TRACKED_REPOSITORIES_PER_INSTALLATION) {
    return NextResponse.redirect(
      new URL("/?github=repository-scope-too-large", request.url),
    );
  }

  try {
    await updateTrackedRepositoriesForInstallation({
      installationId: installationGrant.installation.id,
      repositoryIds,
    });

    return NextResponse.redirect(
      new URL("/?github=repository-scope-saved", request.url),
    );
  } catch {
    return NextResponse.redirect(new URL("/?github=sync-failed", request.url));
  }
}
