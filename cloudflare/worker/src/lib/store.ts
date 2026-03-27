import type { VibeWorkerEnv } from "@/env";
import type { GitHubViewer } from "@/lib/github";

export async function upsertGitHubAccount(env: VibeWorkerEnv, viewer: GitHubViewer) {
  const now = Date.now();
  const existing = await env.DB.prepare(
    `SELECT id FROM github_accounts WHERE github_user_id = ?`,
  )
    .bind(viewer.id)
    .first<{ id: string }>();

  const accountId = existing?.id ?? crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO github_accounts (
      id,
      github_user_id,
      login,
      display_name,
      avatar_url,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(github_user_id) DO UPDATE SET
      login = excluded.login,
      display_name = excluded.display_name,
      avatar_url = excluded.avatar_url,
      updated_at = excluded.updated_at`,
  )
    .bind(
      accountId,
      viewer.id,
      viewer.login,
      viewer.name,
      viewer.avatar_url,
      now,
      now,
    )
    .run();

  return {
    id: accountId,
  };
}
