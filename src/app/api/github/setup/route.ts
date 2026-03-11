import { NextRequest, NextResponse } from "next/server";

import { getValidUserAccessToken } from "@/lib/session";
import { syncInstallationMetadataForAccount } from "@/lib/installation-sync";

export async function GET(request: NextRequest) {
  const installationId = Number.parseInt(
    request.nextUrl.searchParams.get("installation_id") ?? "",
    10,
  );

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

    return NextResponse.redirect(new URL("/?github=installation-connected", request.url));
  } catch {
    return NextResponse.redirect(new URL("/?github=sync-failed", request.url));
  }
}
