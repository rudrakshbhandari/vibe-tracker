import type { VibeWorkerEnv } from "@/env";
import { hashSha256Hex, encryptSecret } from "@/lib/crypto";
import { appendCookie, getCookie, serializeCookie } from "@/lib/cookies";
import { getGitHubAuthEnv } from "@/lib/config";

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
