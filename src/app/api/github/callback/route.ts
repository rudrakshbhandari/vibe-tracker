import { NextRequest, NextResponse } from "next/server";

import { canEnableHostedGitHubSync } from "@/lib/env";
import { db } from "@/lib/db";
import {
  buildGitHubInstallUrl,
  exchangeCodeForUserToken,
  getUserInstallations,
  getViewer,
} from "@/lib/github";
import { syncAllInstallationMetadataForAccount } from "@/lib/installation-sync";
import { consumeOAuthState, createUserSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  if (!canEnableHostedGitHubSync()) {
    return NextResponse.redirect(new URL("/?github=missing-config", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/?github=missing-code", request.url));
  }

  const stateMatches = await consumeOAuthState(state);

  if (!stateMatches) {
    return NextResponse.redirect(new URL("/?github=invalid-state", request.url));
  }

  try {
    const token = await exchangeCodeForUserToken(code);
    const viewer = await getViewer(token.access_token);

    const account = await db.gitHubAccount.upsert({
      where: {
        githubUserId: viewer.id,
      },
      update: {
        login: viewer.login,
        displayName: viewer.name,
        avatarUrl: viewer.avatar_url,
      },
      create: {
        githubUserId: viewer.id,
        login: viewer.login,
        displayName: viewer.name,
        avatarUrl: viewer.avatar_url,
      },
    });

    await createUserSession({
      accountId: account.id,
      accessToken: token.access_token,
      expiresIn: token.expires_in,
      refreshToken: token.refresh_token,
      refreshTokenExpiresIn: token.refresh_token_expires_in,
    });

    const installations = await getUserInstallations(token.access_token);

    if (installations.length === 0) {
      return NextResponse.redirect(buildGitHubInstallUrl());
    }

    await syncAllInstallationMetadataForAccount({
      accountId: account.id,
      userAccessToken: token.access_token,
    });

    return NextResponse.redirect(new URL("/?github=connected", request.url));
  } catch {
    return NextResponse.redirect(new URL("/?github=oauth-failed", request.url));
  }
}
