import type { VibeWorkerEnv } from "@/env";
import { getGitHubAuthEnv, hasGitHubAuthEnv } from "@/lib/config";
import {
  buildGitHubAuthorizeUrl,
  buildGitHubInstallUrl,
  exchangeCodeForUserToken,
  getUserInstallations,
  getViewer,
} from "@/lib/github";
import { clearUserSession, consumeOAuthState, createUserSession, issueOAuthStateCookie, issueUserSessionCookie } from "@/lib/session";
import { upsertGitHubAccount } from "@/lib/store";

function redirect(url: string, headers = new Headers()) {
  headers.set("location", url);
  return new Response(null, {
    status: 302,
    headers,
  });
}

function getAppRedirect(env: VibeWorkerEnv, suffix: string) {
  const config = getGitHubAuthEnv(env);
  return new URL(suffix, config.APP_URL).toString();
}

export async function handleGitHubConnect(request: Request, env: VibeWorkerEnv) {
  if (!hasGitHubAuthEnv(env)) {
    return redirect(new URL("/?github=missing-config", request.url).toString());
  }

  const headers = new Headers();
  const state = issueOAuthStateCookie(headers, env);
  return redirect(buildGitHubAuthorizeUrl(env, state), headers);
}

export async function handleGitHubCallback(request: Request, env: VibeWorkerEnv) {
  if (!hasGitHubAuthEnv(env)) {
    return redirect(new URL("/?github=missing-config", request.url).toString());
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return redirect(new URL("/?github=missing-code", request.url).toString());
  }

  const headers = new Headers();
  const storedState = consumeOAuthState(request, headers, env);
  if (!storedState || storedState !== state) {
    return redirect(new URL("/?github=invalid-state", request.url).toString(), headers);
  }

  try {
    const token = await exchangeCodeForUserToken(env, code);
    const viewer = await getViewer(token.access_token);
    const account = await upsertGitHubAccount(env, viewer);
    const session = await createUserSession(env, {
      accountId: account.id,
      accessToken: token.access_token,
      expiresIn: token.expires_in,
      refreshToken: token.refresh_token,
      refreshTokenExpiresIn: token.refresh_token_expires_in,
    });
    issueUserSessionCookie(headers, env, session);

    const installations = await getUserInstallations(token.access_token);
    if (installations.length === 0) {
      return redirect(buildGitHubInstallUrl(env), headers);
    }

    return redirect(getAppRedirect(env, "/?github=connected"), headers);
  } catch (error) {
    const message = error instanceof Error ? error.message : "oauth-failed";
    const codeSuffix = message.includes("token exchange")
      ? "oauth-token-failed"
      : message.includes("GitHub API request failed for /user")
        ? "oauth-user-failed"
        : "oauth-session-failed";
    return redirect(getAppRedirect(env, `/?github=${codeSuffix}`), headers);
  }
}

export async function handleSessionReset(request: Request, env: VibeWorkerEnv) {
  if (!hasGitHubAuthEnv(env)) {
    return redirect(new URL("/?github=missing-config", request.url).toString());
  }

  const headers = new Headers();
  await clearUserSession(env, request, headers);
  return redirect(getAppRedirect(env, "/?github=session-reset"), headers);
}
