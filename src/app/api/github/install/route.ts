import { NextRequest, NextResponse } from "next/server";

import { canEnableHostedGitHubSync } from "@/lib/env";
import { buildGitHubInstallUrl } from "@/lib/github";

export async function GET(request: NextRequest) {
  if (!canEnableHostedGitHubSync()) {
    return NextResponse.redirect(new URL("/?github=missing-config", request.url));
  }

  return NextResponse.redirect(buildGitHubInstallUrl());
}
