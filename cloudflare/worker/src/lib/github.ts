import type { VibeWorkerEnv } from "@/env";
import { getGitHubAppEnv, getGitHubAuthEnv } from "@/lib/config";

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

export type GitHubInstallation = {
  id: number;
  account: {
    login: string;
    type: string;
  };
  target_type?: string | null;
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
  base: {
    ref: string;
  };
  head: {
    ref: string;
  };
};

export type GitHubRequestOptions = {
  onRateLimitRetry?: (input: {
    delayMs: number;
    reason: "primary" | "secondary";
  }) => void;
};

const MAX_GITHUB_RATE_LIMIT_RETRIES = 2;
const DEFAULT_GITHUB_RETRY_DELAY_MS = 30_000;

function encodeBase64Url(input: string | ArrayBuffer) {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : new Uint8Array(input);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodePemPrivateKey(privateKey: string) {
  const trimmed = privateKey.trim();
  const normalized = trimmed
    .trim()
    .replace(/^"|"$/g, "")
    .replace(/\\r/g, "")
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  let binary: string;

  try {
    binary = atob(normalized);
  } catch (error) {
    const lines = trimmed.split(/\r?\n/);
    const invalidChars = Array.from(
      new Set(
        normalized
          .split("")
          .filter((character) => !/[A-Za-z0-9+/=]/.test(character)),
      ),
    );
    throw new Error(
      `Failed to decode GitHub private key: ${
        error instanceof Error ? error.message : String(error)
      } (trimmedLength=${trimmed.length}, normalizedLength=${normalized.length}, lineCount=${lines.length}, hasBegin=${trimmed.includes(
        "BEGIN PRIVATE KEY",
      )}, hasEnd=${trimmed.includes("END PRIVATE KEY")}, hasEscapedNewlines=${trimmed.includes(
        "\\n",
      )}, wrappedInQuotes=${trimmed.startsWith("\"") && trimmed.endsWith("\"")}, invalidChars=${JSON.stringify(
        invalidChars.map((character) => character.codePointAt(0)),
      )}, firstLineLength=${lines[0]?.length ?? 0}, lastLineLength=${lines.at(-1)?.length ?? 0})`,
    );
  }
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

function getHeaderValue(headers: Headers, key: string) {
  return headers.get(key) ?? headers.get(key.toLowerCase());
}

function getRateLimitRetry(input: {
  status: number;
  headers: Headers;
  message?: string;
}) {
  const message = input.message?.toLowerCase() ?? "";
  const retryAfterHeader = getHeaderValue(input.headers, "retry-after");
  const rateLimitResetHeader = getHeaderValue(input.headers, "x-ratelimit-reset");

  if (retryAfterHeader) {
    const retryAfterSeconds = Number.parseInt(retryAfterHeader, 10);
    if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
      return {
        delayMs: retryAfterSeconds * 1000,
        reason: "secondary" as const,
      };
    }
  }

  if (rateLimitResetHeader) {
    const resetSeconds = Number.parseInt(rateLimitResetHeader, 10);
    if (!Number.isNaN(resetSeconds)) {
      return {
        delayMs: Math.max(1_000, resetSeconds * 1000 - Date.now() + 1_000),
        reason: "primary" as const,
      };
    }
  }

  if (
    input.status === 429 ||
    (input.status === 403 &&
      (message.includes("secondary rate limit") ||
        message.includes("rate limit exceeded")))
  ) {
    return {
      delayMs: DEFAULT_GITHUB_RETRY_DELAY_MS,
      reason: message.includes("secondary") ? ("secondary" as const) : ("primary" as const),
    };
  }

  return null;
}

async function withGitHubRateLimitRetry<T>(
  operation: () => Promise<T>,
  options?: GitHubRequestOptions,
) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const status =
        error && typeof error === "object" && "status" in error
          ? (error.status as number | undefined)
          : undefined;
      const headers =
        error &&
        typeof error === "object" &&
        "response" in error &&
        error.response &&
        typeof error.response === "object" &&
        "headers" in error.response
          ? (error.response.headers as Headers | undefined)
          : undefined;
      const retry =
        status && headers
          ? getRateLimitRetry({
              status,
              headers,
              message: error instanceof Error ? error.message : undefined,
            })
          : null;

      if (!retry || attempt >= MAX_GITHUB_RATE_LIMIT_RETRIES) {
        throw error;
      }

      options?.onRateLimitRetry?.(retry);
      await new Promise((resolve) => setTimeout(resolve, retry.delayMs));
    }
  }
}

async function importPrivateKey(env: VibeWorkerEnv) {
  const config = getGitHubAppEnv(env);
  return crypto.subtle.importKey(
    "pkcs8",
    decodePemPrivateKey(config.GITHUB_APP_PRIVATE_KEY),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );
}

async function createGitHubAppJwt(env: VibeWorkerEnv) {
  const config = getGitHubAppEnv(env);
  const now = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = encodeBase64Url(
    JSON.stringify({
      iat: now - 60,
      exp: now + 9 * 60,
      iss: String(config.GITHUB_APP_ID),
    }),
  );
  const signingInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    await importPrivateKey(env),
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${encodeBase64Url(signature)}`;
}

async function githubRequest<T>(
  path: string,
  accessToken: string,
  options?: GitHubRequestOptions,
) {
  return withGitHubRateLimitRetry(async () => {
    const response = await fetch(`https://api.github.com${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "vibe-tracker-worker",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const error = new Error(
        `GitHub API request failed for ${path} with ${response.status}`,
      ) as Error & {
        status: number;
        response: {
          headers: Headers;
        };
      };
      error.status = response.status;
      error.response = {
        headers: response.headers,
      };
      throw error;
    }

    return (await response.json()) as T;
  }, options);
}

async function createInstallationToken(env: VibeWorkerEnv, installationId: number) {
  const jwt = await createGitHubAppJwt(env);
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${jwt}`,
        "User-Agent": "vibe-tracker-worker",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `GitHub installation token request failed for ${installationId} with ${response.status}`,
    );
  }

  const payload = (await response.json()) as { token?: string };
  if (!payload.token) {
    throw new Error(`GitHub did not return an installation token for ${installationId}`);
  }

  return payload.token;
}

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

export async function refreshUserToken(env: VibeWorkerEnv, refreshToken: string) {
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
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub token refresh failed with ${response.status}`);
  }

  const payload = (await response.json()) as GitHubUserTokenResponse;

  if (!payload.access_token) {
    throw new Error(
      payload.error_description ??
        payload.error ??
        "GitHub did not return a refreshed access token",
    );
  }

  return payload;
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

export async function getInstallationRepositories(
  env: VibeWorkerEnv,
  installationId: number,
  options?: GitHubRequestOptions,
) {
  const token = await createInstallationToken(env, installationId);
  const payload = await githubRequest<{ repositories: GitHubRepository[] }>(
    "/installation/repositories?per_page=100",
    token,
    options,
  );

  return payload.repositories;
}

export async function listMergedPullRequests(input: {
  env: VibeWorkerEnv;
  owner: string;
  repo: string;
  installationId: number;
  updatedSince?: string;
  options?: GitHubRequestOptions;
}) {
  const token = await createInstallationToken(input.env, input.installationId);
  const pullRequests = await githubRequest<GitHubPullRequestListItem[]>(
    `/repos/${input.owner}/${input.repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100`,
    token,
    input.options,
  );

  const mergedPullRequests = pullRequests.filter((pullRequest) => pullRequest.merged_at);
  if (!input.updatedSince) {
    return mergedPullRequests;
  }

  const cursorTime = new Date(input.updatedSince).getTime();
  return mergedPullRequests.filter(
    (pullRequest) => new Date(pullRequest.updated_at).getTime() > cursorTime,
  );
}

export async function getPullRequestDetail(input: {
  env: VibeWorkerEnv;
  owner: string;
  repo: string;
  pullNumber: number;
  installationId: number;
  options?: GitHubRequestOptions;
}) {
  const token = await createInstallationToken(input.env, input.installationId);
  return githubRequest<GitHubPullRequestDetail>(
    `/repos/${input.owner}/${input.repo}/pulls/${input.pullNumber}`,
    token,
    input.options,
  );
}
