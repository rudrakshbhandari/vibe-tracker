import { db } from "@/lib/db";
import {
  fetchCloudflareReadJson,
  hasCloudflareReadProxy,
} from "@/lib/cloudflare-read";

type WorkerGithubState = {
  connected: boolean;
  installations: Array<{
    id: string;
    trackedRepositoryCount: number;
    repositoryCount: number;
  }>;
};

type WorkerMetrics = {
  summary: unknown[];
  timeline: unknown[];
  repositories: unknown[];
  chartTitle: string;
  user: string;
};

export async function runWorkerReadSmokeTest(login: string) {
  if (!hasCloudflareReadProxy()) {
    throw new Error("Cloudflare read proxy is not configured");
  }

  const account = await db.gitHubAccount.findUnique({
    where: {
      login,
    },
    select: {
      githubUserId: true,
      login: true,
    },
  });

  if (!account) {
    throw new Error("Smoke-test GitHub account was not found");
  }

  const [state, metrics] = await Promise.all([
    fetchCloudflareReadJson<WorkerGithubState>("/api/github/state", {
      githubUserId: account.githubUserId,
    }),
    fetchCloudflareReadJson<WorkerMetrics>("/api/metrics?view=daily", {
      githubUserId: account.githubUserId,
    }),
  ]);

  if (!state?.connected) {
    throw new Error("Worker GitHub state did not return a connected account");
  }

  if (state.installations.length === 0) {
    throw new Error("Worker GitHub state returned no installations");
  }

  if (!metrics) {
    throw new Error("Worker metrics payload did not load");
  }

  if (metrics.summary.length === 0 || metrics.timeline.length === 0) {
    throw new Error("Worker metrics payload was missing summary or timeline data");
  }

  return {
    login: account.login,
    installationCount: state.installations.length,
    trackedRepositoryCount: state.installations.reduce(
      (count, installation) => count + installation.trackedRepositoryCount,
      0,
    ),
    accessibleRepositoryCount: state.installations.reduce(
      (count, installation) => count + installation.repositoryCount,
      0,
    ),
    summaryCount: metrics.summary.length,
    timelineCount: metrics.timeline.length,
    repositoryCount: metrics.repositories.length,
    chartTitle: metrics.chartTitle,
    user: metrics.user,
  };
}
