import type { VibeWorkerEnv } from "@/env";
import { getRequestSessionAccountId } from "@/lib/session";

export async function getRequestAccountId(request: Request, env: VibeWorkerEnv) {
  const internalToken = request.headers.get("x-vibe-internal-token");
  const internalAccountId = request.headers.get("x-vibe-account-id");
  const internalGitHubUserId = request.headers.get("x-vibe-github-user-id");

  if (
    env.INTERNAL_API_TOKEN &&
    internalToken === env.INTERNAL_API_TOKEN &&
    internalAccountId
  ) {
    return internalAccountId;
  }

  if (
    env.INTERNAL_API_TOKEN &&
    internalToken === env.INTERNAL_API_TOKEN &&
    internalGitHubUserId
  ) {
    const githubUserId = Number.parseInt(internalGitHubUserId, 10);
    if (Number.isNaN(githubUserId)) {
      return null;
    }

    const account = await env.DB.prepare(
      `SELECT id
       FROM github_accounts
       WHERE github_user_id = ?
       LIMIT 1`,
    )
      .bind(githubUserId)
      .first<{ id: string }>();

    return account?.id ?? null;
  }

  return getRequestSessionAccountId(env, request);
}
