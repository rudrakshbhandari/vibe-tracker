import type { VibeWorkerEnv } from "@/env";
import type {
  GitHubInstallation,
  GitHubPullRequestDetail,
  GitHubRepository,
  GitHubViewer,
} from "@/lib/github";

const MAX_TRACKED_REPOSITORIES_PER_INSTALLATION = 25;
const MERGED_PULL_REQUEST_SCOPE = "merged_prs";

type ExistingRepositoryRow = {
  id: string;
  github_repo_id: number;
  sync_enabled: number;
  owner?: string;
  name?: string;
  pushed_at?: number | null;
};

type RepositoryActivityRow = {
  githubRepoId: number;
  latestMergedAt: number | null;
};

type PullRequestRow = {
  id: string;
  author_id: string | null;
  additions: number;
  deletions: number;
  commit_count: number;
  merged_at: number | null;
  opened_at: number;
};

function getUtcDayString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getTrackedRepositories<T extends { syncEnabled: boolean }>(repositories: T[]) {
  const selectedRepositories = repositories.filter((repository) => repository.syncEnabled);
  return {
    selectedRepositories: selectedRepositories.slice(
      0,
      MAX_TRACKED_REPOSITORIES_PER_INSTALLATION,
    ),
    skippedRepositoryCount: Math.max(
      0,
      repositories.length -
        Math.min(
          selectedRepositories.length,
          MAX_TRACKED_REPOSITORIES_PER_INSTALLATION,
        ),
    ),
  };
}

function getRepositoryRecencyTimestamp(repository: GitHubRepository) {
  return repository.pushed_at ? new Date(repository.pushed_at).getTime() : 0;
}

function sortRepositoriesByRecommendation<T extends {
  githubRepoId: number;
  fullName: string;
  pushedAt: number;
}>(repositories: T[], activityByRepoId: Map<number, number>) {
  return [...repositories].sort((left, right) =>
    (activityByRepoId.get(right.githubRepoId) ?? 0) -
      (activityByRepoId.get(left.githubRepoId) ?? 0) ||
    right.pushedAt - left.pushedAt ||
    left.fullName.localeCompare(right.fullName),
  );
}

export function getRecommendedRepositoryIds<T extends {
  id: string;
  githubRepoId: number;
  fullName: string;
  pushedAt: number;
}>(input: {
  repositories: T[];
  activityByRepoId: Map<number, number>;
  limit?: number;
}) {
  return sortRepositoriesByRecommendation(
    input.repositories,
    input.activityByRepoId,
  )
    .slice(0, input.limit ?? MAX_TRACKED_REPOSITORIES_PER_INSTALLATION)
    .map((repository) => repository.id);
}

function getStaleRepositoryIds(input: {
  persistedRepositories: ExistingRepositoryRow[];
  githubRepositoryIds: number[];
}) {
  const activeRepositoryIds = new Set(input.githubRepositoryIds);

  return input.persistedRepositories
    .filter((repository) => !activeRepositoryIds.has(repository.github_repo_id))
    .map((repository) => repository.id);
}

async function upsertGitHubUser(
  env: VibeWorkerEnv,
  user: {
    id: number;
    login: string;
    name?: string | null;
    avatar_url?: string | null;
  },
) {
  const now = Date.now();
  const existing = await env.DB.prepare(
    `SELECT id FROM github_accounts WHERE github_user_id = ?`,
  )
    .bind(user.id)
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
      user.id,
      user.login,
      user.name ?? null,
      user.avatar_url ?? null,
      now,
      now,
    )
    .run();

  return {
    id: accountId,
  };
}

export async function upsertGitHubAccount(env: VibeWorkerEnv, viewer: GitHubViewer) {
  return upsertGitHubUser(env, viewer);
}

export async function syncInstallationRepositories(
  env: VibeWorkerEnv,
  input: {
    accountId: string;
    installation: GitHubInstallation;
    repositories: GitHubRepository[];
  },
) {
  const now = Date.now();
  const existingInstallation = await env.DB.prepare(
    `SELECT id FROM installations WHERE github_install_id = ?`,
  )
    .bind(input.installation.id)
    .first<{ id: string }>();
  const installationId = existingInstallation?.id ?? crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO installations (
      id,
      github_install_id,
      account_type,
      account_login,
      target_type,
      permissions_json,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(github_install_id) DO UPDATE SET
      account_type = excluded.account_type,
      account_login = excluded.account_login,
      target_type = excluded.target_type,
      permissions_json = excluded.permissions_json,
      updated_at = excluded.updated_at`,
  )
    .bind(
      installationId,
      input.installation.id,
      input.installation.account.type,
      input.installation.account.login,
      input.installation.target_type ?? null,
      JSON.stringify(input.installation.permissions ?? {}),
      now,
      now,
    )
    .run();

  const grant = await env.DB.prepare(
    `SELECT id FROM installation_grants WHERE account_id = ? AND installation_id = ?`,
  )
    .bind(input.accountId, installationId)
    .first<{ id: string }>();

  await env.DB.prepare(
    `INSERT INTO installation_grants (
      id,
      account_id,
      installation_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(account_id, installation_id) DO UPDATE SET
      updated_at = excluded.updated_at`,
  )
    .bind(grant?.id ?? crypto.randomUUID(), input.accountId, installationId, now, now)
    .run();

  const existingRepositories = await env.DB.prepare(
    `SELECT id, github_repo_id, sync_enabled, owner, name, pushed_at
     FROM repositories
     WHERE installation_id = ?`,
  )
    .bind(installationId)
    .all<ExistingRepositoryRow>();

  const persistedRepositories = existingRepositories.results ?? [];
  const staleRepositoryIds = getStaleRepositoryIds({
    persistedRepositories,
    githubRepositoryIds: input.repositories.map((repository) => repository.id),
  });

  for (const staleRepositoryId of staleRepositoryIds) {
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM daily_user_repo_stats WHERE repository_id = ?`).bind(
        staleRepositoryId,
      ),
      env.DB.prepare(`DELETE FROM pull_requests WHERE repository_id = ?`).bind(
        staleRepositoryId,
      ),
      env.DB.prepare(`DELETE FROM sync_cursors WHERE repository_id = ?`).bind(
        staleRepositoryId,
      ),
      env.DB.prepare(`DELETE FROM repositories WHERE id = ?`).bind(staleRepositoryId),
    ]);
  }

  const persistedRepositoryMap = new Map(
    persistedRepositories.map((repository) => [repository.github_repo_id, repository]),
  );
  const activityRows = await env.DB.prepare(
    `SELECT
       repositories.github_repo_id AS githubRepoId,
       MAX(pull_requests.merged_at) AS latestMergedAt
     FROM repositories
     INNER JOIN pull_requests
       ON pull_requests.repository_id = repositories.id
     WHERE repositories.installation_id = ?
       AND pull_requests.author_id = ?
       AND pull_requests.merged_at IS NOT NULL
     GROUP BY repositories.github_repo_id`,
  )
    .bind(installationId, input.accountId)
    .all<RepositoryActivityRow>();
  const activityByRepoId = new Map(
    (activityRows.results ?? []).map((row) => [row.githubRepoId, row.latestMergedAt ?? 0]),
  );
  let enabledRepositoryCount = persistedRepositories.filter(
    (repository) => repository.sync_enabled === 1,
  ).length;

  const sortedRepositories = sortRepositoriesByRecommendation(
    input.repositories.map((repository) => ({
      ...repository,
      githubRepoId: repository.id,
      fullName: repository.full_name,
      pushedAt: getRepositoryRecencyTimestamp(repository),
    })),
    activityByRepoId,
  );

  for (const repository of sortedRepositories) {
    const existingRepository = persistedRepositoryMap.get(repository.id);
    const syncEnabled =
      existingRepository?.sync_enabled === 1 ||
      (!existingRepository &&
        enabledRepositoryCount < MAX_TRACKED_REPOSITORIES_PER_INSTALLATION);

    if (!existingRepository && syncEnabled) {
      enabledRepositoryCount += 1;
    }

    await env.DB.prepare(
      `INSERT INTO repositories (
        id,
        github_repo_id,
        owner,
        name,
        default_branch,
        is_private,
        pushed_at,
        sync_enabled,
        installation_id,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(github_repo_id) DO UPDATE SET
        owner = excluded.owner,
        name = excluded.name,
        default_branch = excluded.default_branch,
        is_private = excluded.is_private,
        pushed_at = excluded.pushed_at,
        sync_enabled = excluded.sync_enabled,
        installation_id = excluded.installation_id,
        updated_at = excluded.updated_at`,
    )
      .bind(
        existingRepository?.id ?? crypto.randomUUID(),
        repository.id,
        repository.owner.login,
        repository.name,
        repository.default_branch,
        repository.private ? 1 : 0,
        getRepositoryRecencyTimestamp(repository),
        syncEnabled ? 1 : 0,
        installationId,
        now,
        now,
      )
      .run();
  }

  const syncedRepositories = await env.DB.prepare(
    `SELECT id, owner, name, sync_enabled
     FROM repositories
     WHERE installation_id = ?
     ORDER BY name ASC`,
  )
    .bind(installationId)
    .all<{
      id: string;
      owner: string;
      name: string;
      sync_enabled: number;
    }>();

  const repositories = (syncedRepositories.results ?? []).map((repository) => ({
    id: repository.id,
    owner: repository.owner,
    name: repository.name,
    syncEnabled: repository.sync_enabled === 1,
  }));
  const tracked = getTrackedRepositories(repositories);

  return {
    installationId,
    repositories,
    selectedRepositories: tracked.selectedRepositories,
    skippedRepositoryCount: tracked.skippedRepositoryCount,
  };
}

async function applyDailyStatsDelta(
  env: VibeWorkerEnv,
  input: {
    accountId: string;
    repositoryId: string;
    dayUtc: string;
    additionsDelta: number;
    deletionsDelta: number;
    mergedPrCountDelta: number;
    commitCountDelta: number;
  },
) {
  if (
    input.additionsDelta === 0 &&
    input.deletionsDelta === 0 &&
    input.mergedPrCountDelta === 0 &&
    input.commitCountDelta === 0
  ) {
    return;
  }

  const existing = await env.DB.prepare(
    `SELECT id, additions, deletions, merged_pr_count, commit_count
     FROM daily_user_repo_stats
     WHERE account_id = ? AND repository_id = ? AND day_utc = ?`,
  )
    .bind(input.accountId, input.repositoryId, input.dayUtc)
    .first<{
      id: string;
      additions: number;
      deletions: number;
      merged_pr_count: number;
      commit_count: number;
    }>();

  const nextAdditions = (existing?.additions ?? 0) + input.additionsDelta;
  const nextDeletions = (existing?.deletions ?? 0) + input.deletionsDelta;
  const nextMergedPrCount =
    (existing?.merged_pr_count ?? 0) + input.mergedPrCountDelta;
  const nextCommitCount = (existing?.commit_count ?? 0) + input.commitCountDelta;

  if (
    nextAdditions <= 0 &&
    nextDeletions <= 0 &&
    nextMergedPrCount <= 0 &&
    nextCommitCount <= 0
  ) {
    if (existing) {
      await env.DB.prepare(`DELETE FROM daily_user_repo_stats WHERE id = ?`)
        .bind(existing.id)
        .run();
    }
    return;
  }

  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO daily_user_repo_stats (
      id,
      account_id,
      repository_id,
      day_utc,
      additions,
      deletions,
      merged_pr_count,
      commit_count,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(account_id, repository_id, day_utc) DO UPDATE SET
      additions = excluded.additions,
      deletions = excluded.deletions,
      merged_pr_count = excluded.merged_pr_count,
      commit_count = excluded.commit_count,
      updated_at = excluded.updated_at`,
  )
    .bind(
      existing?.id ?? crypto.randomUUID(),
      input.accountId,
      input.repositoryId,
      input.dayUtc,
      nextAdditions,
      nextDeletions,
      nextMergedPrCount,
      nextCommitCount,
      now,
      now,
    )
    .run();
}

export async function applyPullRequestDetail(
  env: VibeWorkerEnv,
  input: {
    repositoryId: string;
    detail: GitHubPullRequestDetail;
  },
) {
  if (!input.detail.merged_at) {
    return;
  }

  const author = input.detail.user
    ? await upsertGitHubUser(env, input.detail.user)
    : null;
  const mergedAt = new Date(input.detail.merged_at);
  const existing = await env.DB.prepare(
    `SELECT
      id,
      author_id,
      additions,
      deletions,
      commit_count,
      merged_at,
      opened_at
     FROM pull_requests
     WHERE repository_id = ? AND github_pr_number = ?`,
  )
    .bind(input.repositoryId, input.detail.number)
    .first<PullRequestRow>();

  if (existing?.author_id) {
    const existingDay = getUtcDayString(
      new Date(existing.merged_at ?? existing.opened_at),
    );
    await applyDailyStatsDelta(env, {
      accountId: existing.author_id,
      repositoryId: input.repositoryId,
      dayUtc: existingDay,
      additionsDelta: -existing.additions,
      deletionsDelta: -existing.deletions,
      mergedPrCountDelta: -1,
      commitCountDelta: -existing.commit_count,
    });
  }

  const now = Date.now();
  const pullRequestId = existing?.id ?? crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO pull_requests (
      id,
      github_pr_number,
      repository_id,
      author_id,
      title,
      base_branch,
      head_branch,
      state,
      additions,
      deletions,
      commit_count,
      opened_at,
      merged_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(repository_id, github_pr_number) DO UPDATE SET
      author_id = excluded.author_id,
      title = excluded.title,
      base_branch = excluded.base_branch,
      head_branch = excluded.head_branch,
      state = excluded.state,
      additions = excluded.additions,
      deletions = excluded.deletions,
      commit_count = excluded.commit_count,
      opened_at = excluded.opened_at,
      merged_at = excluded.merged_at,
      updated_at = excluded.updated_at`,
  )
    .bind(
      pullRequestId,
      input.detail.number,
      input.repositoryId,
      author?.id ?? null,
      input.detail.title,
      input.detail.base.ref,
      input.detail.head.ref,
      input.detail.state,
      input.detail.additions,
      input.detail.deletions,
      input.detail.commits,
      new Date(input.detail.created_at).getTime(),
      mergedAt.getTime(),
      now,
      now,
    )
    .run();

  if (!author?.id) {
    return;
  }

  await applyDailyStatsDelta(env, {
    accountId: author.id,
    repositoryId: input.repositoryId,
    dayUtc: getUtcDayString(mergedAt),
    additionsDelta: input.detail.additions,
    deletionsDelta: input.detail.deletions,
    mergedPrCountDelta: 1,
    commitCountDelta: input.detail.commits,
  });
}

export async function getSyncCursor(
  env: VibeWorkerEnv,
  repositoryId: string,
  scope = MERGED_PULL_REQUEST_SCOPE,
) {
  return env.DB.prepare(
    `SELECT cursor_value
     FROM sync_cursors
     WHERE repository_id = ? AND scope = ?`,
  )
    .bind(repositoryId, scope)
    .first<{ cursor_value: string }>();
}

export async function upsertSyncCursor(
  env: VibeWorkerEnv,
  input: {
    installationId: string;
    repositoryId: string;
    cursorValue: string;
    scope?: string;
  },
) {
  const existing = await getSyncCursor(env, input.repositoryId, input.scope);
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO sync_cursors (
      id,
      installation_id,
      repository_id,
      scope,
      cursor_value,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(repository_id, scope) DO UPDATE SET
      installation_id = excluded.installation_id,
      cursor_value = excluded.cursor_value,
      updated_at = excluded.updated_at`,
  )
    .bind(
      existing ? crypto.randomUUID() : crypto.randomUUID(),
      input.installationId,
      input.repositoryId,
      input.scope ?? MERGED_PULL_REQUEST_SCOPE,
      input.cursorValue,
      now,
      now,
    )
    .run();
}
