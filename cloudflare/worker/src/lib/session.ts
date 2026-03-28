import type { VibeWorkerEnv } from "@/env";
import { decryptSecret, encryptSecret, hashSha256Hex } from "@/lib/crypto";
import { appendCookie, getCookie, serializeCookie } from "@/lib/cookies";
import { getGitHubAuthEnv } from "@/lib/config";
import { getGitHubTokenExpiry, refreshUserToken } from "@/lib/github";

const SESSION_COOKIE_NAME = "vibe_tracker_session";
const OAUTH_STATE_COOKIE_NAME = "vibe_tracker_oauth_state";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 30;
const OAUTH_STATE_LIFETIME_SECONDS = 60 * 10;

function getCookieSecurity(env: VibeWorkerEnv) {
  const { APP_URL } = getGitHubAuthEnv(env);
  return new URL(APP_URL).protocol === "https:";
}

export async function hashSessionToken(sessionToken: string) {
  return hashSha256Hex(sessionToken);
}

export async function getSessionTokenLookupValues(sessionToken: string) {
  const hashed = await hashSessionToken(sessionToken);
  return hashed === sessionToken ? [hashed] : [hashed, sessionToken];
}

export function issueOAuthStateCookie(headers: Headers, env: VibeWorkerEnv) {
  const state = crypto.randomUUID();
  appendCookie(
    headers,
    serializeCookie(OAUTH_STATE_COOKIE_NAME, state, {
      httpOnly: true,
      maxAge: OAUTH_STATE_LIFETIME_SECONDS,
      sameSite: "Lax",
      secure: getCookieSecurity(env),
    }),
  );
  return state;
}

export function consumeOAuthState(request: Request, headers: Headers, env: VibeWorkerEnv) {
  const storedState = getCookie(request, OAUTH_STATE_COOKIE_NAME);

  appendCookie(
    headers,
    serializeCookie(OAUTH_STATE_COOKIE_NAME, "", {
      expires: new Date(0),
      httpOnly: true,
      maxAge: 0,
      sameSite: "Lax",
      secure: getCookieSecurity(env),
    }),
  );

  return storedState;
}

export async function createUserSession(
  env: VibeWorkerEnv,
  input: {
    accountId: string;
    accessToken: string;
    expiresIn?: number;
    refreshToken?: string;
    refreshTokenExpiresIn?: number;
  },
) {
  const config = getGitHubAuthEnv(env);
  const sessionToken = crypto.randomUUID();
  const sessionTokenHash = await hashSessionToken(sessionToken);
  const now = Date.now();
  const expiresAt = now + SESSION_LIFETIME_SECONDS * 1000;

  await env.DB.prepare(
    `INSERT INTO user_sessions (
      id,
      session_token_hash,
      account_id,
      github_access_token,
      github_access_token_expires_at,
      github_refresh_token,
      github_refresh_token_expires_at,
      expires_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      sessionTokenHash,
      input.accountId,
      await encryptSecret(input.accessToken, config.SESSION_ENCRYPTION_KEY),
      input.expiresIn ? now + input.expiresIn * 1000 : null,
      input.refreshToken
        ? await encryptSecret(input.refreshToken, config.SESSION_ENCRYPTION_KEY)
        : null,
      input.refreshTokenExpiresIn ? now + input.refreshTokenExpiresIn * 1000 : null,
      expiresAt,
      now,
      now,
    )
    .run();

  return {
    expiresAt,
    sessionToken,
  };
}

export function issueUserSessionCookie(
  headers: Headers,
  env: VibeWorkerEnv,
  session: {
    expiresAt: number;
    sessionToken: string;
  },
) {
  appendCookie(
    headers,
    serializeCookie(SESSION_COOKIE_NAME, session.sessionToken, {
      expires: new Date(session.expiresAt),
      httpOnly: true,
      sameSite: "Lax",
      secure: getCookieSecurity(env),
    }),
  );
}

export async function clearUserSession(
  env: VibeWorkerEnv,
  request: Request,
  headers: Headers,
) {
  const sessionToken = getCookie(request, SESSION_COOKIE_NAME);

  if (sessionToken) {
    const lookupValues = await getSessionTokenLookupValues(sessionToken);
    await env.DB.prepare(
      `DELETE FROM user_sessions
       WHERE session_token_hash = ? OR session_token_hash = ?`,
    )
      .bind(lookupValues[0], lookupValues[1] ?? lookupValues[0])
      .run();
  }

  appendCookie(
    headers,
    serializeCookie(SESSION_COOKIE_NAME, "", {
      expires: new Date(0),
      httpOnly: true,
      maxAge: 0,
      sameSite: "Lax",
      secure: getCookieSecurity(env),
    }),
  );
}

type SessionRow = {
  id: string;
  account_id: string;
  github_access_token: string;
  github_access_token_expires_at: number | null;
  github_refresh_token: string | null;
  github_refresh_token_expires_at: number | null;
  expires_at: number;
};

async function getStoredSession(
  env: VibeWorkerEnv,
  request: Request,
) {
  const sessionToken = getCookie(request, SESSION_COOKIE_NAME);
  if (!sessionToken) {
    return null;
  }

  const lookupValues = await getSessionTokenLookupValues(sessionToken);
  const session = await env.DB.prepare(
    `SELECT
      id,
      account_id,
      github_access_token,
      github_access_token_expires_at,
      github_refresh_token,
      github_refresh_token_expires_at,
      expires_at
     FROM user_sessions
     WHERE (session_token_hash = ? OR session_token_hash = ?)
       AND expires_at > ?
     ORDER BY updated_at DESC
     LIMIT 1`,
  )
    .bind(lookupValues[0], lookupValues[1] ?? lookupValues[0], Date.now())
    .first<SessionRow>();

  return session;
}

export async function getRequestSessionAccountId(
  env: VibeWorkerEnv,
  request: Request,
) {
  const session = await getStoredSession(env, request);
  return session?.account_id ?? null;
}

export async function getValidUserAccessToken(
  env: VibeWorkerEnv,
  request: Request,
) {
  const session = await getStoredSession(env, request);
  if (!session) {
    return null;
  }

  const config = getGitHubAuthEnv(env);
  const refreshCutoff = Date.now() + 60_000;
  if (
    !session.github_access_token_expires_at ||
    session.github_access_token_expires_at > refreshCutoff
  ) {
    return {
      accountId: session.account_id,
      accessToken: await decryptSecret(
        session.github_access_token,
        config.SESSION_ENCRYPTION_KEY,
      ),
    };
  }

  if (!session.github_refresh_token) {
    return {
      accountId: session.account_id,
      accessToken: await decryptSecret(
        session.github_access_token,
        config.SESSION_ENCRYPTION_KEY,
      ),
    };
  }

  const refreshToken = await decryptSecret(
    session.github_refresh_token,
    config.SESSION_ENCRYPTION_KEY,
  );
  const refreshed = await refreshUserToken(env, refreshToken);
  const nextAccessToken = await encryptSecret(
    refreshed.access_token,
    config.SESSION_ENCRYPTION_KEY,
  );
  const nextRefreshToken = refreshed.refresh_token
    ? await encryptSecret(refreshed.refresh_token, config.SESSION_ENCRYPTION_KEY)
    : session.github_refresh_token;

  await env.DB.prepare(
    `UPDATE user_sessions
     SET github_access_token = ?,
         github_access_token_expires_at = ?,
         github_refresh_token = ?,
         github_refresh_token_expires_at = ?,
         updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      nextAccessToken,
      getGitHubTokenExpiry(refreshed.expires_in),
      nextRefreshToken,
      getGitHubTokenExpiry(refreshed.refresh_token_expires_in) ??
        session.github_refresh_token_expires_at,
      Date.now(),
      session.id,
    )
    .run();

  return {
    accountId: session.account_id,
    accessToken: refreshed.access_token,
  };
}
