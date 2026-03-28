import { z } from "zod";

import type { InstallationMessage } from "@/jobs/contracts";
import { enqueueInstallationSyncs } from "@/jobs/sync";
import type { VibeWorkerEnv } from "@/env";
import { hasGitHubAuthEnv } from "@/lib/config";
import { getUserInstallations } from "@/lib/github";
import { json, parseJson, unauthorized } from "@/lib/http";
import { getRequestAccountId } from "@/lib/request-auth";
import { getValidUserAccessToken } from "@/lib/session";
import { getSocialFriends, getSocialMe } from "@/lib/social-read";

const MAX_TRACKED_REPOSITORIES_PER_INSTALLATION = 25;

const socialProfileUpdateSchema = z.object({
  bio: z.string().trim().max(160).default(""),
  profileVisibility: z.enum(["PRIVATE", "PUBLIC"]),
  leaderboardVisibility: z.enum(["HIDDEN", "PUBLIC"]),
});

const respondSchema = z.object({
  token: z.string().min(8),
  action: z.enum(["accept", "decline"]),
});

type InstallationStateRow = {
  installationId: string;
  githubInstallId: number;
  accountLogin: string;
  accountType: string;
  targetType: string | null;
  permissionsJson: string | null;
  repositoryId: string | null;
  repositoryName: string | null;
  repositoryOwner: string | null;
  syncEnabled: number | null;
};

function redirect(url: string, headers = new Headers()) {
  headers.set("location", url);
  return new Response(null, {
    status: 302,
    headers,
  });
}

function getReconnectState(url: string) {
  return {
    connected: false,
    title: "Connect your GitHub account",
    description:
      "One click starts the GitHub flow. If you already have an installation, the app will sync it automatically. If not, it will send you to install and then return here.",
    primaryAction: {
      label: "Reconnect GitHub",
      href: "/api/github/connect",
    },
    accountId: null,
    viewer: null,
    activitySync: null,
    activitySyncRunning: false,
    syncHealth: null,
    installations: [],
    appUrl: new URL("/", url).toString(),
  };
}

function randomHex(bytes = 18) {
  const array = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function parsePermissions(value: string | null) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as Record<string, string>;
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

async function listInstallationsForAccount(
  env: VibeWorkerEnv,
  accountId: string,
) {
  const result = await env.DB.prepare(
    `SELECT
      installations.id AS installationId,
      installations.github_install_id AS githubInstallId,
      installations.account_login AS accountLogin,
      installations.account_type AS accountType,
      installations.target_type AS targetType,
      installations.permissions_json AS permissionsJson,
      repositories.id AS repositoryId,
      repositories.name AS repositoryName,
      repositories.owner AS repositoryOwner,
      repositories.sync_enabled AS syncEnabled
     FROM installation_grants
     INNER JOIN installations
       ON installations.id = installation_grants.installation_id
     LEFT JOIN repositories
       ON repositories.installation_id = installations.id
     WHERE installation_grants.account_id = ?
     ORDER BY installations.account_login ASC, repositories.name ASC`,
  )
    .bind(accountId)
    .all<InstallationStateRow>();

  const installationMap = new Map<
    string,
    {
      id: string;
      githubInstallId: number;
      accountLogin: string;
      accountType: string;
      targetType: string | null;
      permissions: Record<string, string>;
      repositories: Array<{
        id: string;
        name: string;
        owner: string;
        syncEnabled: boolean;
      }>;
    }
  >();

  for (const row of result.results ?? []) {
    const existing =
      installationMap.get(row.installationId) ??
      {
        id: row.installationId,
        githubInstallId: row.githubInstallId,
        accountLogin: row.accountLogin,
        accountType: row.accountType,
        targetType: row.targetType,
        permissions: parsePermissions(row.permissionsJson),
        repositories: [],
      };

    if (row.repositoryId && row.repositoryName && row.repositoryOwner) {
      existing.repositories.push({
        id: row.repositoryId,
        name: row.repositoryName,
        owner: row.repositoryOwner,
        syncEnabled: row.syncEnabled === 1,
      });
    }

    installationMap.set(row.installationId, existing);
  }

  return Array.from(installationMap.values()).map((installation) => ({
    ...installation,
    repositories: installation.repositories.sort((left, right) =>
      `${left.owner}/${left.name}`.localeCompare(`${right.owner}/${right.name}`),
    ),
  }));
}

async function getLatestSyncTimestamp(
  env: VibeWorkerEnv,
  accountId: string,
) {
  const result = await env.DB.prepare(
    `SELECT MAX(sync_cursors.updated_at) AS latestUpdatedAt
     FROM sync_cursors
     INNER JOIN repositories
       ON repositories.id = sync_cursors.repository_id
     INNER JOIN installation_grants
       ON installation_grants.installation_id = repositories.installation_id
     WHERE installation_grants.account_id = ?`,
  )
    .bind(accountId)
    .first<{ latestUpdatedAt: number | null }>();

  return result?.latestUpdatedAt ?? null;
}

async function enqueueInstallationMessages(
  env: VibeWorkerEnv,
  accountId: string,
  installations: InstallationMessage[],
) {
  if (!env.SYNC_QUEUE || installations.length === 0) {
    return false;
  }

  await enqueueInstallationSyncs(env, {
    accountId,
    installations,
  });
  return true;
}

function toInstallationMessage(input: {
  githubInstallId: number;
  accountLogin: string;
  accountType: string;
  targetType: string | null;
  permissions: Record<string, string>;
}): InstallationMessage {
  return {
    githubInstallationId: input.githubInstallId,
    accountLogin: input.accountLogin,
    accountType: input.accountType,
    targetType: input.targetType,
    permissions: input.permissions,
  };
}

export async function handleGitHubState(request: Request, env: VibeWorkerEnv) {
  if (!hasGitHubAuthEnv(env)) {
    return json({
      ...getReconnectState(request.url),
      title: "GitHub connection unavailable",
      description:
        "GitHub connection is not available right now. Please try again later.",
    });
  }

  const accountId = await getRequestAccountId(request, env);
  if (!accountId) {
    return json(getReconnectState(request.url));
  }

  const [account, installations, latestSyncAt] = await Promise.all([
    env.DB.prepare(
      `SELECT login
       FROM github_accounts
       WHERE id = ?`,
    )
      .bind(accountId)
      .first<{ login: string }>(),
    listInstallationsForAccount(env, accountId),
    getLatestSyncTimestamp(env, accountId),
  ]);

  if (!account) {
    return json(getReconnectState(request.url));
  }

  return json({
    connected: true,
    title: "GitHub is connected",
    description:
      "Installations are cached locally in the Cloudflare backend, and merged PR sync runs asynchronously in the queue.",
    primaryAction: {
      label: "Add another installation",
      href: "/api/github/install",
    },
    accountId,
    viewer: {
      login: account.login,
    },
    activitySync: latestSyncAt
      ? {
          status: "synced",
          updatedAt: formatTimestamp(latestSyncAt),
        }
      : null,
    activitySyncRunning: false,
    syncHealth: null,
    installations: installations.map((installation) => ({
      id: installation.id,
      githubInstallId: installation.githubInstallId,
      accountLogin: installation.accountLogin,
      repositoryCount: installation.repositories.length,
      trackedRepositoryCount: installation.repositories.filter(
        (repository) => repository.syncEnabled,
      ).length,
      repositories: installation.repositories,
    })),
  });
}

export async function handleGitHubInstall(request: Request, env: VibeWorkerEnv) {
  if (!hasGitHubAuthEnv(env) || !env.GITHUB_APP_SLUG) {
    return redirect(new URL("/?github=missing-config", request.url).toString());
  }

  return redirect(
    `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`,
  );
}

export async function handleGitHubSetup(request: Request, env: VibeWorkerEnv) {
  if (!hasGitHubAuthEnv(env)) {
    return redirect(new URL("/?github=missing-config", request.url).toString());
  }

  const session = await getValidUserAccessToken(env, request);
  if (!session) {
    return redirect(new URL("/?github=not-connected", request.url).toString());
  }

  const installationId = Number.parseInt(
    new URL(request.url).searchParams.get("installation_id") ?? "",
    10,
  );
  if (Number.isNaN(installationId)) {
    return redirect(new URL("/?github=invalid-installation", request.url).toString());
  }

  try {
    const installations = await getUserInstallations(session.accessToken);
    const installation = installations.find((entry) => entry.id === installationId);
    if (!installation) {
      return redirect(new URL("/?github=invalid-installation", request.url).toString());
    }

    const queued = await enqueueInstallationMessages(env, session.accountId, [
      {
        githubInstallationId: installation.id,
        accountLogin: installation.account.login,
        accountType: installation.account.type,
        targetType: installation.target_type ?? null,
        permissions: installation.permissions,
      },
    ]);

    if (!queued) {
      return redirect(new URL("/?github=sync-failed", request.url).toString());
    }

    return redirect(
      new URL("/?github=installation-connected", request.url).toString(),
    );
  } catch {
    return redirect(new URL("/?github=sync-failed", request.url).toString());
  }
}

export async function handleGitHubActivitySync(
  request: Request,
  env: VibeWorkerEnv,
) {
  if (!hasGitHubAuthEnv(env)) {
    return redirect(new URL("/?github=missing-config", request.url).toString());
  }

  const accountId = await getRequestAccountId(request, env);
  if (!accountId) {
    return redirect(new URL("/?github=not-connected", request.url).toString());
  }

  const installations = await listInstallationsForAccount(env, accountId);
  const queued = await enqueueInstallationMessages(
    env,
    accountId,
    installations.map((installation) => toInstallationMessage(installation)),
  );

  if (!queued) {
    return redirect(new URL("/?github=sync-failed", request.url).toString());
  }

  return redirect(
    new URL("/?github=activity-sync-started", request.url).toString(),
  );
}

export async function handleGitHubInstallationSync(
  request: Request,
  env: VibeWorkerEnv,
  githubInstallationId: number,
) {
  const accountId = await getRequestAccountId(request, env);
  if (!accountId) {
    return redirect(new URL("/?github=not-connected", request.url).toString());
  }

  const installations = await listInstallationsForAccount(env, accountId);
  const installation = installations.find(
    (entry) => entry.githubInstallId === githubInstallationId,
  );

  if (!installation) {
    return redirect(new URL("/?github=invalid-installation", request.url).toString());
  }

  const queued = await enqueueInstallationMessages(env, accountId, [
    toInstallationMessage(installation),
  ]);

  if (!queued) {
    return redirect(new URL("/?github=sync-failed", request.url).toString());
  }

  return redirect(
    new URL("/?github=repositories-refreshed", request.url).toString(),
  );
}

export async function handleGitHubInstallationScope(
  request: Request,
  env: VibeWorkerEnv,
  githubInstallationId: number,
) {
  const accountId = await getRequestAccountId(request, env);
  if (!accountId) {
    return redirect(new URL("/?github=not-connected", request.url).toString());
  }

  const installations = await listInstallationsForAccount(env, accountId);
  const installation = installations.find(
    (entry) => entry.githubInstallId === githubInstallationId,
  );

  if (!installation) {
    return redirect(new URL("/?github=invalid-installation", request.url).toString());
  }

  const formData = await request.formData();
  const repositoryIds = formData
    .getAll("repositoryIds")
    .filter((value): value is string => typeof value === "string");

  const allowedRepositoryIds = new Set(
    installation.repositories.map((repository) => repository.id),
  );
  const selectedRepositoryIds = Array.from(
    new Set(repositoryIds.filter((repositoryId) => allowedRepositoryIds.has(repositoryId))),
  );

  if (selectedRepositoryIds.length > MAX_TRACKED_REPOSITORIES_PER_INSTALLATION) {
    return redirect(
      new URL("/?github=repository-scope-too-large", request.url).toString(),
    );
  }

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE repositories
       SET sync_enabled = 0,
           updated_at = ?
       WHERE installation_id = ?`,
    ).bind(Date.now(), installation.id),
    ...(selectedRepositoryIds.length > 0
      ? [
          env.DB.prepare(
            `UPDATE repositories
             SET sync_enabled = 1,
                 updated_at = ?
             WHERE installation_id = ?
               AND id IN (${selectedRepositoryIds.map(() => "?").join(", ")})`,
          ).bind(Date.now(), installation.id, ...selectedRepositoryIds),
        ]
      : []),
    env.DB.prepare(
      `UPDATE installations
       SET sync_selection_updated_at = ?,
           updated_at = ?
       WHERE id = ?`,
    ).bind(Date.now(), Date.now(), installation.id),
  ]);

  return redirect(
    new URL("/?github=repository-scope-saved", request.url).toString(),
  );
}

export async function handleSocialProfileUpdate(
  request: Request,
  env: VibeWorkerEnv,
) {
  const accountId = await getRequestAccountId(request, env);
  if (!accountId) {
    return unauthorized();
  }

  const parseResult = socialProfileUpdateSchema.safeParse(
    await parseJson<unknown>(request).catch(() => null),
  );
  if (!parseResult.success) {
    return json(
      {
        error: "Invalid social profile payload",
        issues: parseResult.error.flatten(),
      },
      { status: 400 },
    );
  }

  const now = Date.now();
  await env.DB.prepare(
    `UPDATE github_accounts
     SET bio = ?,
         profile_visibility = ?,
         leaderboard_visibility = ?,
         social_onboarding_completed_at = COALESCE(social_onboarding_completed_at, ?),
         updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      parseResult.data.bio || null,
      parseResult.data.profileVisibility,
      parseResult.data.leaderboardVisibility,
      now,
      now,
      accountId,
    )
    .run();

  return json(await getSocialMe(env, accountId));
}

export async function handleSocialFriendInviteCreate(
  request: Request,
  env: VibeWorkerEnv,
) {
  const accountId = await getRequestAccountId(request, env);
  if (!accountId) {
    return unauthorized();
  }

  const now = Date.now();
  const existing = await env.DB.prepare(
    `SELECT id, token, created_at, expires_at
     FROM friend_invites
     WHERE inviter_account_id = ?
       AND status = 'PENDING'
       AND expires_at > ?
     ORDER BY created_at DESC
     LIMIT 1`,
  )
    .bind(accountId, now)
    .first<{
      id: string;
      token: string;
      created_at: number;
      expires_at: number;
    }>();

  const invite =
    existing ??
    ({
      id: crypto.randomUUID(),
      token: randomHex(),
      created_at: now,
      expires_at: now + 7 * 24 * 60 * 60 * 1000,
    } as const);

  if (!existing) {
    await env.DB.prepare(
      `INSERT INTO friend_invites (
        id,
        token,
        inviter_account_id,
        status,
        expires_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, 'PENDING', ?, ?, ?)`,
    )
      .bind(
        invite.id,
        invite.token,
        accountId,
        invite.expires_at,
        invite.created_at,
        invite.created_at,
      )
      .run();
  }

  await env.DB.prepare(
    `UPDATE github_accounts
     SET social_onboarding_completed_at = COALESCE(social_onboarding_completed_at, ?),
         updated_at = ?
     WHERE id = ?`,
  )
    .bind(now, now, accountId)
    .run();

  return json({
    token: invite.token,
    invitePath: `/social/invite/${invite.token}`,
    createdAt: new Date(invite.created_at).toISOString(),
    expiresAt: new Date(invite.expires_at).toISOString(),
  });
}

export async function handleSocialFriendInviteRespond(
  request: Request,
  env: VibeWorkerEnv,
) {
  const accountId = await getRequestAccountId(request, env);
  if (!accountId) {
    return unauthorized();
  }

  const parseResult = respondSchema.safeParse(
    await parseJson<unknown>(request).catch(() => null),
  );
  if (!parseResult.success) {
    return json(
      {
        error: "Invalid invite response payload",
        issues: parseResult.error.flatten(),
      },
      { status: 400 },
    );
  }

  const invite = await env.DB.prepare(
    `SELECT
      friend_invites.id AS id,
      friend_invites.token AS token,
      friend_invites.inviter_account_id AS inviterAccountId,
      friend_invites.status AS status,
      friend_invites.expires_at AS expiresAt,
      github_accounts.login AS inviterLogin
     FROM friend_invites
     INNER JOIN github_accounts
       ON github_accounts.id = friend_invites.inviter_account_id
     WHERE friend_invites.token = ?`,
  )
    .bind(parseResult.data.token)
    .first<{
      id: string;
      inviterAccountId: string;
      status: string;
      expiresAt: number;
      inviterLogin: string;
    }>();

  if (!invite) {
    return json({ error: "Invite not found" }, { status: 400 });
  }
  if (invite.inviterAccountId === accountId) {
    return json({ error: "You cannot claim your own invite" }, { status: 400 });
  }
  if (invite.status !== "PENDING") {
    return json({ error: "Invite is no longer active" }, { status: 400 });
  }
  if (invite.expiresAt <= Date.now()) {
    await env.DB.prepare(
      `UPDATE friend_invites
       SET status = 'EXPIRED',
           updated_at = ?
       WHERE id = ?`,
    )
      .bind(Date.now(), invite.id)
      .run();
    return json({ error: "Invite has expired" }, { status: 400 });
  }

  if (parseResult.data.action === "decline") {
    await env.DB.prepare(
      `UPDATE friend_invites
       SET claimed_by_account_id = ?,
           claimed_at = ?,
           status = 'DECLINED',
           updated_at = ?
       WHERE id = ?`,
    )
      .bind(accountId, Date.now(), Date.now(), invite.id)
      .run();

    return json({
      status: "declined",
      inviterLogin: invite.inviterLogin,
    });
  }

  const pairKey = [invite.inviterAccountId, accountId].sort().join(":");
  const connection = await env.DB.prepare(
    `SELECT id, status
     FROM friend_connections
     WHERE pair_key = ?`,
  )
    .bind(pairKey)
    .first<{ id: string; status: string }>();

  if (connection?.status === "BLOCKED") {
    return json({ error: "This connection is blocked" }, { status: 400 });
  }

  const now = Date.now();
  await env.DB.batch([
    connection
      ? env.DB.prepare(
          `UPDATE friend_connections
           SET requester_account_id = ?,
               addressee_account_id = ?,
               status = 'ACCEPTED',
               updated_at = ?
           WHERE id = ?`,
        ).bind(invite.inviterAccountId, accountId, now, connection.id)
      : env.DB.prepare(
          `INSERT INTO friend_connections (
            id,
            requester_account_id,
            addressee_account_id,
            pair_key,
            status,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, 'ACCEPTED', ?, ?)`,
        ).bind(
          crypto.randomUUID(),
          invite.inviterAccountId,
          accountId,
          pairKey,
          now,
          now,
        ),
    env.DB.prepare(
      `UPDATE friend_invites
       SET claimed_by_account_id = ?,
           claimed_at = ?,
           status = 'ACCEPTED',
           updated_at = ?
       WHERE id = ?`,
    ).bind(accountId, now, now, invite.id),
    env.DB.prepare(
      `UPDATE github_accounts
       SET social_onboarding_completed_at = COALESCE(social_onboarding_completed_at, ?),
           updated_at = ?
       WHERE id = ?`,
    ).bind(now, now, accountId),
  ]);

  return json({
    status: "accepted",
    inviterLogin: invite.inviterLogin,
  });
}

export async function handleSocialInviteRead(
  env: VibeWorkerEnv,
  token: string,
) {
  const invite = await env.DB.prepare(
    `SELECT
      friend_invites.token AS token,
      friend_invites.status AS status,
      friend_invites.expires_at AS expiresAt,
      github_accounts.id AS inviterId,
      github_accounts.login AS inviterLogin,
      github_accounts.display_name AS inviterDisplayName
     FROM friend_invites
     INNER JOIN github_accounts
       ON github_accounts.id = friend_invites.inviter_account_id
     WHERE friend_invites.token = ?`,
  )
    .bind(token)
    .first<{
      token: string;
      status: string;
      expiresAt: number;
      inviterId: string;
      inviterLogin: string;
      inviterDisplayName: string | null;
    }>();

  if (!invite) {
    return json({ error: "Invite not found" }, { status: 404 });
  }

  const normalizedStatus =
    invite.status === "PENDING" && invite.expiresAt <= Date.now()
      ? "EXPIRED"
      : invite.status;

  return json({
    token: invite.token,
    status: normalizedStatus,
    expiresAt: new Date(invite.expiresAt).toISOString(),
    inviter: {
      id: invite.inviterId,
      login: invite.inviterLogin,
      displayName: invite.inviterDisplayName,
    },
  });
}

export async function handleSocialFriendsRefresh(
  request: Request,
  env: VibeWorkerEnv,
) {
  const accountId = await getRequestAccountId(request, env);
  if (!accountId) {
    return unauthorized();
  }

  return json(await getSocialFriends(env, accountId));
}
