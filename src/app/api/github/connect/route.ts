import { NextRequest, NextResponse } from "next/server";

import { canEnableHostedGitHubSync } from "@/lib/env";
import { buildGitHubAuthorizeUrl } from "@/lib/github";
import { createOAuthState } from "@/lib/session";

export async function GET(request: NextRequest) {
  if (!canEnableHostedGitHubSync()) {
    return NextResponse.redirect(new URL("/?github=missing-config", request.url));
  }

  const state = await createOAuthState();
  return NextResponse.redirect(buildGitHubAuthorizeUrl(state));
}
