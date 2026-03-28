import {
  failStaleActivitySyncJobs,
  getActiveActivitySyncWhere,
  getAccountSyncHealth,
} from "@/lib/activity-sync-jobs";
import { hasGitHubAppEnv, hasDurableDatabaseUrl } from "@/lib/env";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format-date";
import { getOptionalUserSession } from "@/lib/session";

const reconnectAction = {
  label: "Reconnect GitHub",
  href: "/api/github/connect",
};

export async function getGithubConnectionState() {
  if (!hasGitHubAppEnv()) {
    return {
      connected: false,
      title: "GitHub connection unavailable",
      description:
        "GitHub connection is not available right now. Please try again later.",
      primaryAction: reconnectAction,
      accountId: null as string | null,
      viewer: null,
        activitySync: null,
      activitySyncRunning: false,
      syncHealth: null,
      installations: [] as Array<{
        id: string;
        githubInstallId: number;
        accountLogin: string;
        repositoryCount: number;
        trackedRepositoryCount: number;
        repositories: Array<{
          id: string;
          name: string;
          owner: string;
          syncEnabled: boolean;
        }>;
      }>,
    };
  }

  if (!hasDurableDatabaseUrl()) {
    return {
      connected: false,
      title: "GitHub sync unavailable",
      description:
        "GitHub sync is temporarily unavailable. Please try again later.",
      primaryAction: reconnectAction,
      accountId: null as string | null,
      viewer: null,
        activitySync: null,
      activitySyncRunning: false,
      syncHealth: null,
      installations: [] as Array<{
        id: string;
        githubInstallId: number;
        accountLogin: string;
        repositoryCount: number;
        trackedRepositoryCount: number;
        repositories: Array<{
          id: string;
          name: string;
          owner: string;
          syncEnabled: boolean;
        }>;
      }>,
    };
  }

  try {
    const session = await getOptionalUserSession();

    if (!session) {
      return {
        connected: false,
        title: "Connect your GitHub account",
        description:
          "One click starts the GitHub flow. If you already have an installation, the app will sync it automatically. If not, it will send you to install and then return here.",
        primaryAction: reconnectAction,
        accountId: null as string | null,
        viewer: null,
        activitySync: null,
        activitySyncRunning: false,
        syncHealth: null,
        installations: [],
      };
    }

    const installationIds = session.account.installationGrants.map(
      (grant) => grant.installation.id,
    );

    await failStaleActivitySyncJobs(installationIds);

    const latestActivitySync = installationIds.length
      ? await db.syncJob.findFirst({
          where: {
            installationId: {
              in: installationIds,
            },
            scope: "activity",
          },
          orderBy: {
            createdAt: "desc",
          },
        })
      : null;

    const installations = session.account.installationGrants.map((grant) => ({
      id: grant.installation.id,
      githubInstallId: grant.installation.githubInstallId,
      accountLogin: grant.installation.accountLogin,
      repositoryCount: grant.installation.repositories.length,
      trackedRepositoryCount: grant.installation.repositories.filter(
        (repository) => repository.syncEnabled,
      ).length,
      repositories: grant.installation.repositories.map((repository) => ({
        id: repository.id,
        name: repository.name,
        owner: repository.owner,
        syncEnabled: repository.syncEnabled,
      })),
    }));
    const syncHealth = await getAccountSyncHealth({
      accountId: session.accountId,
      installationIds,
    });

    return {
      connected: true,
      title: "GitHub is connected",
      description:
        "Installations are cached locally. Shipped-work sync is separate so onboarding stays fast even if you have many repositories.",
      primaryAction: {
        label: "Add another installation",
        href: "/api/github/install",
      },
      accountId: session.accountId,
      viewer: {
        login: session.account.login,
        sessionExpiryLabel: await formatDate(session.expiresAt, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
      },
      activitySync: latestActivitySync
        ? {
            status: latestActivitySync.status,
            updatedAt: await formatDate(latestActivitySync.updatedAt, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            }),
          }
        : null,
      activitySyncRunning: installationIds.length
        ? Boolean(
            await db.syncJob.findFirst({
              where: getActiveActivitySyncWhere(installationIds),
              orderBy: {
                updatedAt: "desc",
              },
            }),
          )
        : false,
      syncHealth,
      installations,
    };
  } catch {
    return {
      connected: false,
      title: "GitHub sync unavailable",
      description:
        "We could not load your GitHub connection right now. Please try again later.",
      primaryAction: reconnectAction,
      accountId: null as string | null,
      viewer: null,
      activitySync: null,
      activitySyncRunning: false,
      syncHealth: null,
      installations: [],
    };
  }
}
