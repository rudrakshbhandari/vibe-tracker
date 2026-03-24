import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "octokit";

import { getGitHubAppEnv, normalizePrivateKey } from "@/lib/env";

type GitHubUserTokenResponse = {
  access_token: string;
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

export type GitHubInstallation = {
  id: number;
  account: {
    login: string;
    type: string;
  };
  target_type?: string;
  permissions?: Record<string, string>;
};

export type GitHubRepository = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  owner: {
    login: string;
  };
};

export type GitHubPullRequestListItem = {
  number: number;
  state: string;
  title: string;
  user: {
    id: number;
    login: string;
    avatar_url: string;
  } | null;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
};

export type GitHubPullRequestDetail = GitHubPullRequestListItem & {
  additions: number;
  deletions: number;
  commits: number;
};

export type GitHubAssociatedPullRequest = {
  number: number;
  state: string;
  created_at: string;
  merged_at: string | null;
};

export function buildGitHubAuthorizeUrl(state: string) {
  const env = getGitHubAppEnv();
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", env.GITHUB_APP_CLIENT_ID);
  url.searchParams.set("redirect_uri", `${env.APP_URL}/api/github/callback`);
  url.searchParams.set("state", state);
  return url.toString();
}

export function buildGitHubInstallUrl() {
  const env = getGitHubAppEnv();
  return `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`;
}

export async function exchangeCodeForUserToken(code: string) {
  const env = getGitHubAppEnv();
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: env.GITHUB_APP_CLIENT_ID,
      client_secret: env.GITHUB_APP_CLIENT_SECRET,
      code,
      redirect_uri: `${env.APP_URL}/api/github/callback`,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub token exchange failed with ${response.status}`);
  }

  const payload = (await response.json()) as GitHubUserTokenResponse & {
    error?: string;
    error_description?: string;
  };

  if (!payload.access_token) {
    throw new Error(payload.error_description ?? payload.error ?? "GitHub did not return an access token");
  }

  return payload;
}

export async function refreshUserToken(refreshToken: string) {
  const env = getGitHubAppEnv();
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: env.GITHUB_APP_CLIENT_ID,
      client_secret: env.GITHUB_APP_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub token refresh failed with ${response.status}`);
  }

  const payload = (await response.json()) as GitHubUserTokenResponse & {
    error?: string;
    error_description?: string;
  };

  if (!payload.access_token) {
    throw new Error(payload.error_description ?? payload.error ?? "GitHub did not return a refreshed access token");
  }

  return payload;
}

async function githubRequest<T>(path: string, token: string) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`GitHub API request failed for ${path} with ${response.status}`);
  }

  return (await response.json()) as T;
}

export function getGitHubTokenExpiry(expiresIn?: number) {
  if (!expiresIn) {
    return null;
  }

  return new Date(Date.now() + expiresIn * 1000);
}

export async function getViewer(accessToken: string) {
  return githubRequest<GitHubViewer>("/user", accessToken);
}

export async function getUserInstallations(accessToken: string) {
  const payload = await githubRequest<{ installations: GitHubInstallation[] }>(
    "/user/installations",
    accessToken,
  );

  return payload.installations;
}

export async function createInstallationToken(installationId: number) {
  const env = getGitHubAppEnv();
  const auth = createAppAuth({
    appId: env.GITHUB_APP_ID,
    clientId: env.GITHUB_APP_CLIENT_ID,
    clientSecret: env.GITHUB_APP_CLIENT_SECRET,
    privateKey: normalizePrivateKey(env.GITHUB_APP_PRIVATE_KEY),
  });

  const authResult = await auth({
    type: "installation",
    installationId,
  });

  return authResult.token;
}

async function createInstallationOctokit(installationId: number) {
  const token = await createInstallationToken(installationId);
  return new Octokit({ auth: token });
}

export async function getInstallationRepositories(installationId: number) {
  const octokit = await createInstallationOctokit(installationId);
  const response = await octokit.request("GET /installation/repositories", {
    per_page: 100,
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  return response.data.repositories as GitHubRepository[];
}

export async function listMergedPullRequests(input: {
  owner: string;
  repo: string;
  installationId: number;
  updatedSince?: string;
}) {
  const octokit = await createInstallationOctokit(input.installationId);
  const response = await octokit.paginate(octokit.rest.pulls.list, {
    owner: input.owner,
    repo: input.repo,
    state: "closed",
    sort: "updated",
    direction: "desc",
    per_page: 100,
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  const pullRequests = response as GitHubPullRequestListItem[];

  if (!input.updatedSince) {
    return pullRequests.filter((pullRequest) => pullRequest.merged_at);
  }

  const cursorTime = new Date(input.updatedSince).getTime();

  return pullRequests.filter((pullRequest) => {
    const updatedAt = new Date(pullRequest.updated_at).getTime();
    return updatedAt > cursorTime && Boolean(pullRequest.merged_at);
  });
}

export async function getPullRequestDetail(input: {
  owner: string;
  repo: string;
  pullNumber: number;
  installationId: number;
}) {
  const octokit = await createInstallationOctokit(input.installationId);
  const response = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
    owner: input.owner,
    repo: input.repo,
    pull_number: input.pullNumber,
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  return response.data as GitHubPullRequestDetail;
}
