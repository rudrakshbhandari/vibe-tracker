import { NextResponse } from "next/server";

import {
  getUserInstallations,
  getViewer,
} from "@/lib/github";
import {
  enqueueActivitySyncForAccount,
  syncAllInstallationMetadataForAccount,
  syncInstallationMetadataForAccount,
} from "@/lib/installation-sync";
import {
  clearUserSession,
  consumeOAuthState,
  createOAuthState,
  createUserSession,
  getValidUserAccessToken,
} from "@/lib/session";
import { db } from "@/lib/db";

const LOCAL_AUTH_HOSTS = new Set(["localhost", "127.0.0.1"]);

function getLocalGitHubOauthEnv() {
  const appUrl = process.env.APP_URL?.trim();
  const clientId = process.env.GITHUB_APP_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET?.trim();
  const appSlug = process.env.GITHUB_APP_SLUG?.trim();
  const sessionKey = process.env.SESSION_ENCRYPTION_KEY?.trim();
  const databaseUrl = process.env.DATABASE_URL?.trim();

  return {
    appUrl,
    clientId,
    clientSecret,
    appSlug,
    sessionKey,
    databaseUrl,
  };
}

function hasLocalOauthEnv() {
  const env = getLocalGitHubOauthEnv();
  return Boolean(
    env.appUrl &&
      env.clientId &&
      env.clientSecret &&
      env.appSlug &&
      env.sessionKey &&
      env.databaseUrl,
  );
}

function buildLocalGitHubAuthorizeUrl(state: string) {
  const env = getLocalGitHubOauthEnv();
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", env.clientId ?? "");
  url.searchParams.set("redirect_uri", `${env.appUrl}/api/github/callback`);
  url.searchParams.set("state", state);
  return url.toString();
}

function buildLocalGitHubInstallUrl() {
  const env = getLocalGitHubOauthEnv();
  return `https://github.com/apps/${env.appSlug}/installations/new`;
}

async function exchangeLocalCodeForUserToken(code: string) {
  const env = getLocalGitHubOauthEnv();
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: env.clientId ?? "",
      client_secret: env.clientSecret ?? "",
      code,
      redirect_uri: `${env.appUrl}/api/github/callback`,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub token exchange failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    refresh_token_expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!payload.access_token) {
    throw new Error(payload.error_description ?? payload.error ?? "GitHub did not return an access token");
  }

  return {
    access_token: payload.access_token,
    expires_in: payload.expires_in,
    refresh_token: payload.refresh_token,
    refresh_token_expires_in: payload.refresh_token_expires_in,
  };
}

function getAppOrigin(requestUrl: string) {
  const configuredUrl = process.env.APP_URL?.trim();
  const baseUrl = configuredUrl && configuredUrl.length > 0 ? configuredUrl : requestUrl;
  return new URL(baseUrl).origin;
}

function buildAppRedirect(requestUrl: string, pathWithQuery: string) {
  return new URL(pathWithQuery, getAppOrigin(requestUrl)).toString();
}

function redirect(url: string) {
  return NextResponse.redirect(url);
}

export function shouldUseLocalGitHubAuth() {
  const appUrl = process.env.APP_URL?.trim();
  if (!appUrl) {
    return false;
  }

  try {
    return LOCAL_AUTH_HOSTS.has(new URL(appUrl).hostname);
  } catch {
    return false;
  }
}

async function upsertGitHubAccount(input: {
  githubUserId: number;
  login: string;
  displayName: string | null;
  avatarUrl: string;
}) {
  return db.gitHubAccount.upsert({
    where: {
      githubUserId: input.githubUserId,
    },
    update: {
      login: input.login,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
    },
    create: {
      githubUserId: input.githubUserId,
      login: input.login,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
    },
  });
}

export async function handleLocalGitHubConnect(requestUrl: string) {
  if (!hasLocalOauthEnv()) {
    return redirect(buildAppRedirect(requestUrl, "/?github=missing-config"));
  }

  const state = await createOAuthState();
  return redirect(buildLocalGitHubAuthorizeUrl(state));
}

export async function handleLocalGitHubCallback(requestUrl: string, input: { code: string | null; state: string | null }) {
  if (!hasLocalOauthEnv()) {
    return redirect(buildAppRedirect(requestUrl, "/?github=missing-config"));
  }

  if (!input.code || !input.state) {
    return redirect(buildAppRedirect(requestUrl, "/?github=missing-code"));
  }

  const isValidState = await consumeOAuthState(input.state);
  if (!isValidState) {
    return redirect(buildAppRedirect(requestUrl, "/?github=invalid-state"));
  }

  try {
    const token = await exchangeLocalCodeForUserToken(input.code);
    const viewer = await getViewer(token.access_token);
    const account = await upsertGitHubAccount({
      githubUserId: viewer.id,
      login: viewer.login,
      displayName: viewer.name,
      avatarUrl: viewer.avatar_url,
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
      return redirect(buildLocalGitHubInstallUrl());
    }

    try {
      await syncAllInstallationMetadataForAccount({
        accountId: account.id,
        userAccessToken: token.access_token,
      });
    } catch (error) {
      console.error("Local GitHub installation sync failed after OAuth callback", {
        error: error instanceof Error ? error.message : String(error),
      });
      return redirect(buildAppRedirect(requestUrl, "/?github=oauth-installations-failed"));
    }

    return redirect(buildAppRedirect(requestUrl, "/?github=connected"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "oauth-failed";
    console.error("Local GitHub OAuth callback failed", { message });
    const codeSuffix = message.includes("token exchange")
      ? "oauth-token-failed"
      : message.includes("GitHub API request failed for /user")
        ? "oauth-user-failed"
        : "oauth-session-failed";
    return redirect(buildAppRedirect(requestUrl, `/?github=${codeSuffix}`));
  }
}

export async function handleLocalGitHubInstall(requestUrl: string) {
  if (!hasLocalOauthEnv()) {
    return redirect(buildAppRedirect(requestUrl, "/?github=missing-config"));
  }

  const session = await getValidUserAccessToken();
  if (session) {
    try {
      const installations = await getUserInstallations(session.accessToken);
      if (installations.length > 0) {
        await syncAllInstallationMetadataForAccount({
          accountId: session.session.accountId,
          userAccessToken: session.accessToken,
        });
        return redirect(buildAppRedirect(requestUrl, "/?github=installation-connected"));
      }
    } catch (error) {
      console.error("Failed to sync existing GitHub installations locally", {
        error: error instanceof Error ? error.message : String(error),
      });
      return redirect(buildAppRedirect(requestUrl, "/?github=sync-failed"));
    }
  }

  return redirect(buildLocalGitHubInstallUrl());
}

export async function handleLocalGitHubSetup(requestUrl: string, installationId: string | null) {
  if (!hasLocalOauthEnv()) {
    return redirect(buildAppRedirect(requestUrl, "/?github=missing-config"));
  }

  const session = await getValidUserAccessToken();
  if (!session) {
    return redirect(buildAppRedirect(requestUrl, "/?github=not-connected"));
  }

  const githubInstallationId = Number.parseInt(installationId ?? "", 10);
  if (Number.isNaN(githubInstallationId)) {
    return redirect(buildAppRedirect(requestUrl, "/?github=invalid-installation"));
  }

  try {
    await syncInstallationMetadataForAccount({
      githubInstallationId,
      accountId: session.session.accountId,
      userAccessToken: session.accessToken,
    });

    await enqueueActivitySyncForAccount({
      accountId: session.session.accountId,
      userAccessToken: session.accessToken,
    });

    return redirect(buildAppRedirect(requestUrl, "/?github=installation-connected"));
  } catch (error) {
    console.error("Failed to complete local GitHub installation setup", {
      installationId: githubInstallationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return redirect(buildAppRedirect(requestUrl, "/?github=sync-failed"));
  }
}

export async function handleLocalSessionReset(requestUrl: string) {
  await clearUserSession();
  return redirect(buildAppRedirect(requestUrl, "/?github=session-reset"));
}
