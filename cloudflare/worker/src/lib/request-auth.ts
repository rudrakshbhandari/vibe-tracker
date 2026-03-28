import type { VibeWorkerEnv } from "@/env";
import { getCookie } from "@/lib/cookies";
import { getSessionTokenLookupValues } from "@/lib/session";

const SESSION_COOKIE_NAME = "vibe_tracker_session";

export async function getRequestAccountId(request: Request, env: VibeWorkerEnv) {
  const internalToken = request.headers.get("x-vibe-internal-token");
  const internalAccountId = request.headers.get("x-vibe-account-id");

  if (
    env.INTERNAL_API_TOKEN &&
    internalToken === env.INTERNAL_API_TOKEN &&
    internalAccountId
  ) {
    return internalAccountId;
  }

  const sessionToken = getCookie(request, SESSION_COOKIE_NAME);
  if (!sessionToken) {
    return null;
  }

  const lookupValues = await getSessionTokenLookupValues(sessionToken);
  const session = await env.DB.prepare(
    `SELECT account_id
     FROM user_sessions
     WHERE (session_token_hash = ? OR session_token_hash = ?)
       AND expires_at > ?
     ORDER BY updated_at DESC
     LIMIT 1`,
  )
    .bind(lookupValues[0], lookupValues[1] ?? lookupValues[0], Date.now())
    .first<{ account_id: string }>();

  return session?.account_id ?? null;
}
