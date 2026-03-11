import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";

import { db } from "@/lib/db";
import { getGitHubTokenExpiry, refreshUserToken } from "@/lib/github";

const SESSION_COOKIE_NAME = "vibe_tracker_session";
const OAUTH_STATE_COOKIE_NAME = "vibe_tracker_oauth_state";

export async function createOAuthState() {
  const state = randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  return state;
}

export async function consumeOAuthState(expectedState: string) {
  const cookieStore = await cookies();
  const storedState = cookieStore.get(OAUTH_STATE_COOKIE_NAME)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE_NAME);
  return Boolean(storedState && storedState === expectedState);
}

export async function createUserSession(input: {
  accountId: string;
  accessToken: string;
  expiresIn?: number;
  refreshToken?: string;
  refreshTokenExpiresIn?: number;
}) {
  const sessionToken = randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

  await db.userSession.create({
    data: {
      sessionToken,
      accountId: input.accountId,
      githubAccessToken: input.accessToken,
      githubAccessTokenExpiresAt: getGitHubTokenExpiry(input.expiresIn),
      githubRefreshToken: input.refreshToken,
      githubRefreshTokenExpiresAt: getGitHubTokenExpiry(input.refreshTokenExpiresIn),
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function getOptionalUserSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  const session = await db.userSession.findUnique({
    where: {
      sessionToken,
    },
    include: {
      account: {
        include: {
          installationGrants: {
            include: {
              installation: {
                include: {
                  repositories: {
                    orderBy: {
                      name: "asc",
                    },
                  },
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date()) {
    await clearUserSession();
    return null;
  }

  return session;
}

export async function clearUserSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionToken) {
    await db.userSession.deleteMany({
      where: {
        sessionToken,
      },
    });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getValidUserAccessToken() {
  const session = await getOptionalUserSession();

  if (!session) {
    return null;
  }

  if (
    !session.githubAccessTokenExpiresAt ||
    session.githubAccessTokenExpiresAt > new Date(Date.now() + 60_000)
  ) {
    return {
      accessToken: session.githubAccessToken,
      session,
    };
  }

  if (!session.githubRefreshToken) {
    return {
      accessToken: session.githubAccessToken,
      session,
    };
  }

  const refreshed = await refreshUserToken(session.githubRefreshToken);

  const updated = await db.userSession.update({
    where: {
      id: session.id,
    },
    data: {
      githubAccessToken: refreshed.access_token,
      githubAccessTokenExpiresAt: getGitHubTokenExpiry(refreshed.expires_in),
      githubRefreshToken: refreshed.refresh_token ?? session.githubRefreshToken,
      githubRefreshTokenExpiresAt:
        getGitHubTokenExpiry(refreshed.refresh_token_expires_in) ??
        session.githubRefreshTokenExpiresAt,
    },
    include: {
      account: {
        include: {
          installationGrants: {
            include: {
              installation: {
                include: {
                  repositories: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return {
    accessToken: updated.githubAccessToken,
    session: updated,
  };
}
