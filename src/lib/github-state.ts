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
      viewer: null,
      activitySync: null,
      activitySyncRunning: false,
      installations: [] as Array<{
        id: string;
        githubInstallId: number;
        accountLogin: string;
        repositoryCount: number;
        repositoryNames: string[];
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
      viewer: null,
      activitySync: null,
      activitySyncRunning: false,
      installations: [] as Array<{
        id: string;
        githubInstallId: number;
        accountLogin: string;
        repositoryCount: number;
        repositoryNames: string[];
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
        viewer: null,
        activitySync: null,
        activitySyncRunning: false,
        installations: [],
      };
    }

    const installationIds = session.account.installationGrants.map(
      (grant) => grant.installation.id,
    );

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
      repositoryNames: grant.installation.repositories
        .slice(0, 3)
        .map((repository) => `${repository.owner}/${repository.name}`),
    }));

    return {
      connected: true,
      title: "GitHub is connected",
      description:
        "Installations are cached locally. Shipped-work sync is separate so onboarding stays fast even if you have many repositories.",
      primaryAction: {
        label: "Add another installation",
        href: "/api/github/install",
      },
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
      activitySyncRunning: latestActivitySync?.status === "running",
      installations,
    };
  } catch {
    return {
      connected: false,
      title: "GitHub sync unavailable",
      description:
        "We could not load your GitHub connection right now. Please try again later.",
      primaryAction: reconnectAction,
      viewer: null,
      activitySync: null,
      activitySyncRunning: false,
      installations: [],
    };
  }
}
