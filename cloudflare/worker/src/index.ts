import { leaderboardWindowSchema } from "@/jobs/contracts";
import { handleQueueBatch } from "@/jobs/consumer";
import {
  rebuildLeaderboardRanks,
  recomputeLeaderboardScoresForAccount,
  runMaintenance,
} from "@/jobs/leaderboard";
import {
  handleGitHubCallback,
  handleGitHubConnect,
  handleSessionReset,
} from "@/routes/auth";
import {
  handleGitHubActivitySync,
  handleGitHubInstall,
  handleGitHubInstallationRecommendedScope,
  handleGitHubInstallationScope,
  handleGitHubInstallationSync,
  handleGitHubSetup,
  handleGitHubState,
  handleSocialFriendInviteCreate,
  handleSocialFriendInviteRespond,
  handleSocialInviteRead,
  handleSocialProfileUpdate,
} from "@/routes/control";
import {
  handleMetricsRead,
  handleSocialFriendsRead,
  handleSocialLeaderboardRead,
  handleSocialMeRead,
  handleSocialProfileRead,
} from "@/routes/read";
import type { VibeWorkerEnv } from "@/env";
import { json, parseJson, unauthorized } from "@/lib/http";

type LeaderboardMaintenanceRequest = {
  accountId?: string;
  windows?: string[];
};

function isAuthorized(request: Request, env: VibeWorkerEnv) {
  if (!env.MAINTENANCE_TOKEN) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  return authorization === `Bearer ${env.MAINTENANCE_TOKEN}`;
}

async function handleLeaderboardMaintenance(
  request: Request,
  env: VibeWorkerEnv,
) {
  if (!isAuthorized(request, env)) {
    return unauthorized();
  }

  const payload = await parseJson<LeaderboardMaintenanceRequest>(request);
  const windows =
    payload.windows?.map((window) => leaderboardWindowSchema.parse(window)) ??
    ["7d", "30d", "90d"];

  if (payload.accountId) {
    await recomputeLeaderboardScoresForAccount(env, payload.accountId, windows);
  }

  for (const window of windows) {
    await rebuildLeaderboardRanks(env, window);
  }

  return json({
    ok: true,
    accountId: payload.accountId ?? null,
    windows,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        ok: true,
        service: "vibe-tracker-cloudflare-worker",
      });
    }

    if (request.method === "GET" && url.pathname === "/api/github/connect") {
      return handleGitHubConnect(request, env);
    }

    if (request.method === "GET" && url.pathname === "/api/github/install") {
      return handleGitHubInstall(request, env);
    }

    if (request.method === "GET" && url.pathname === "/api/github/callback") {
      return handleGitHubCallback(request, env);
    }

    if (request.method === "GET" && url.pathname === "/api/github/setup") {
      return handleGitHubSetup(request, env);
    }

    if (request.method === "GET" && url.pathname === "/api/github/state") {
      return handleGitHubState(request, env);
    }

    if (request.method === "GET" && url.pathname === "/api/session/reset") {
      return handleSessionReset(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/github/activity-sync") {
      return handleGitHubActivitySync(request, env);
    }

    if (
      request.method === "POST" &&
      /\/api\/github\/installations\/\d+\/scope\/recommended$/.test(url.pathname)
    ) {
      const githubInstallationId = Number.parseInt(
        url.pathname.split("/").at(-3) ?? "",
        10,
      );
      return handleGitHubInstallationRecommendedScope(request, env, githubInstallationId);
    }

    if (
      request.method === "POST" &&
      /\/api\/github\/installations\/\d+\/scope$/.test(url.pathname)
    ) {
      const githubInstallationId = Number.parseInt(
        url.pathname.split("/").at(-2) ?? "",
        10,
      );
      return handleGitHubInstallationScope(request, env, githubInstallationId);
    }

    if (
      request.method === "POST" &&
      /\/api\/github\/installations\/\d+\/sync$/.test(url.pathname)
    ) {
      const githubInstallationId = Number.parseInt(
        url.pathname.split("/").at(-2) ?? "",
        10,
      );
      return handleGitHubInstallationSync(request, env, githubInstallationId);
    }

    if (request.method === "GET" && url.pathname === "/api/metrics") {
      return handleMetricsRead(request, env);
    }

    if (request.method === "GET" && url.pathname === "/api/social/me") {
      return handleSocialMeRead(request, env);
    }

    if (request.method === "GET" && url.pathname === "/api/social/friends") {
      return handleSocialFriendsRead(request, env);
    }

    if (request.method === "GET" && url.pathname === "/api/social/leaderboard") {
      return handleSocialLeaderboardRead(request, env);
    }

    if (
      request.method === "GET" &&
      url.pathname.startsWith("/api/social/profile/")
    ) {
      const login = decodeURIComponent(
        url.pathname.replace("/api/social/profile/", ""),
      );
      return handleSocialProfileRead(request, env, login);
    }

    if (request.method === "PATCH" && url.pathname === "/api/social/profile") {
      return handleSocialProfileUpdate(request, env);
    }

    if (
      request.method === "POST" &&
      url.pathname === "/api/social/friends/invite"
    ) {
      return handleSocialFriendInviteCreate(request, env);
    }

    if (
      request.method === "POST" &&
      url.pathname === "/api/social/friends/respond"
    ) {
      return handleSocialFriendInviteRespond(request, env);
    }

    if (
      request.method === "GET" &&
      url.pathname.startsWith("/api/social/invite/")
    ) {
      const token = decodeURIComponent(
        url.pathname.replace("/api/social/invite/", ""),
      );
      return handleSocialInviteRead(env, token);
    }

    if (request.method === "POST" && url.pathname === "/internal/maintenance/run") {
      if (!isAuthorized(request, env)) {
        return unauthorized();
      }

      await runMaintenance(env);
      return json({ ok: true });
    }

    if (
      request.method === "POST" &&
      url.pathname === "/internal/leaderboards/rebuild"
    ) {
      return handleLeaderboardMaintenance(request, env);
    }

    return json(
      {
        error: "Not found",
      },
      { status: 404 },
    );
  },

  async queue(batch, env) {
    await handleQueueBatch(env, batch);
  },

  async scheduled(controller, env) {
    await runMaintenance(env, new Date(controller.scheduledTime));
  },
} satisfies ExportedHandler<VibeWorkerEnv>;
