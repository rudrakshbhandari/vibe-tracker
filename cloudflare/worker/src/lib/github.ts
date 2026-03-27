import type { VibeWorkerEnv } from "@/env";
import { getGitHubAuthEnv } from "@/lib/config";

type GitHubUserTokenResponse = {
  access_token: string;
  error?: string;
  error_description?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
  token_type: string;
};

export type GitHubViewer = {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
};

type GitHubInstallation = {
  id: number;
};

export function buildGitHubAuthorizeUrl(env: VibeWorkerEnv, state: string) {
  const config = getGitHubAuthEnv(env);
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", config.GITHUB_APP_CLIENT_ID);
  url.searchParams.set("redirect_uri", `${config.APP_URL}/api/github/callback`);
  url.searchParams.set("state", state);
  return url.toString();
}

export function buildGitHubInstallUrl(env: VibeWorkerEnv) {
  const config = getGitHubAuthEnv(env);
  return `https://github.com/apps/${config.GITHUB_APP_SLUG}/installations/new`;
}

export function getGitHubTokenExpiry(expiresIn?: number) {
  if (!expiresIn) {
    return null;
  }

  return Date.now() + expiresIn * 1000;
}

export async function exchangeCodeForUserToken(env: VibeWorkerEnv, code: string) {
  const config = getGitHubAuthEnv(env);
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.GITHUB_APP_CLIENT_ID,
      client_secret: config.GITHUB_APP_CLIENT_SECRET,
      code,
      redirect_uri: `${config.APP_URL}/api/github/callback`,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub token exchange failed with ${response.status}`);
  }

  const payload = (await response.json()) as GitHubUserTokenResponse;

  if (!payload.access_token) {
    throw new Error(
      payload.error_description ??
        payload.error ??
        "GitHub did not return an access token",
    );
  }

  return payload;
}

async function githubRequest<T>(path: string, accessToken: string) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API request failed for ${path} with ${response.status}`);
  }

  return (await response.json()) as T;
}

export function getViewer(accessToken: string) {
  return githubRequest<GitHubViewer>("/user", accessToken);
}

export async function getUserInstallations(accessToken: string) {
  const payload = await githubRequest<{ installations: GitHubInstallation[] }>(
    "/user/installations",
    accessToken,
  );

  return payload.installations;
}
