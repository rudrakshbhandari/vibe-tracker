import { hasGitHubAppEnv, hasDurableDatabaseUrl } from "@/lib/env";
import { db } from "@/lib/db";
import { getOptionalUserSession } from "@/lib/session";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export async function getGithubConnectionState() {
  if (!hasGitHubAppEnv()) {
    return {
      connected: false,
      title: "Add GitHub App credentials",
      description:
        "Set the GitHub App env variables locally, then the app can issue user sessions and installation syncs.",
      primaryAction: null,
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
      title: "Hosted demo mode",
      description:
        "GitHub auth and sync stay disabled on Vercel until a hosted database is configured. The public deployment still serves the dashboard and metrics demo safely.",
      primaryAction: null,
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
        primaryAction: {
          label: "Continue with GitHub",
          href: "/api/github/connect",
        },
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
        "Installations are cached locally. Activity sync is separate so onboarding stays fast even if you have many repositories.",
      primaryAction: {
        label: "Add another installation",
        href: "/api/github/install",
      },
      viewer: {
        login: session.account.login,
        sessionExpiryLabel: formatDate(session.expiresAt),
      },
      activitySync: latestActivitySync
        ? {
            status: latestActivitySync.status,
            updatedAt: formatDate(latestActivitySync.updatedAt),
          }
        : null,
      activitySyncRunning: latestActivitySync?.status === "running",
      installations,
    };
  } catch {
    return {
      connected: false,
      title: "Database not initialized",
      description:
        "Run `npm run db:push` locally so session and installation records can be stored.",
      primaryAction: null,
      viewer: null,
      activitySync: null,
      activitySyncRunning: false,
      installations: [],
    };
  }
}
