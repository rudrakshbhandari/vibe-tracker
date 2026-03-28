import { z } from "zod";

import type { VibeWorkerEnv } from "@/env";
import { json, unauthorized } from "@/lib/http";
import { getMetricsResponse, metricsViewValues } from "@/lib/metrics-read";
import { getRequestAccountId } from "@/lib/request-auth";
import {
  getSocialFriends,
  getSocialLeaderboard,
  getSocialMe,
  getSocialProfileByLogin,
  socialScopeValues,
  socialWindowValues,
} from "@/lib/social-read";

const metricsQuerySchema = z.object({
  view: z.enum(metricsViewValues).default("daily"),
});

const friendsQuerySchema = z.object({
  window: z.enum(socialWindowValues).default("30d"),
});

const leaderboardQuerySchema = z.object({
  scope: z.enum(socialScopeValues).default("friends"),
  window: z.enum(socialWindowValues).default("30d"),
});

async function requireAccountId(request: Request, env: VibeWorkerEnv) {
  const accountId = await getRequestAccountId(request, env);
  if (!accountId) {
    return null;
  }

  return accountId;
}

export async function handleMetricsRead(request: Request, env: VibeWorkerEnv) {
  const accountId = await requireAccountId(request, env);
  if (!accountId) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const parseResult = metricsQuerySchema.safeParse({
    view: url.searchParams.get("view") ?? undefined,
  });

  if (!parseResult.success) {
    return json(
      {
        error: "Invalid query parameters",
        issues: parseResult.error.flatten(),
      },
      { status: 400 },
    );
  }

  return json(await getMetricsResponse(env, accountId, parseResult.data.view));
}

export async function handleSocialMeRead(request: Request, env: VibeWorkerEnv) {
  const accountId = await requireAccountId(request, env);
  if (!accountId) {
    return unauthorized();
  }

  return json(await getSocialMe(env, accountId));
}

export async function handleSocialFriendsRead(request: Request, env: VibeWorkerEnv) {
  const accountId = await requireAccountId(request, env);
  if (!accountId) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const parseResult = friendsQuerySchema.safeParse({
    window: url.searchParams.get("window") ?? undefined,
  });

  if (!parseResult.success) {
    return json(
      {
        error: "Invalid leaderboard window",
        issues: parseResult.error.flatten(),
      },
      { status: 400 },
    );
  }

  return json(await getSocialFriends(env, accountId, parseResult.data.window));
}

export async function handleSocialLeaderboardRead(
  request: Request,
  env: VibeWorkerEnv,
) {
  const accountId = await requireAccountId(request, env);
  if (!accountId) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const parseResult = leaderboardQuerySchema.safeParse({
    scope: url.searchParams.get("scope") ?? undefined,
    window: url.searchParams.get("window") ?? undefined,
  });

  if (!parseResult.success) {
    return json(
      {
        error: "Invalid leaderboard query",
        issues: parseResult.error.flatten(),
      },
      { status: 400 },
    );
  }

  return json(
    await getSocialLeaderboard(
      env,
      accountId,
      parseResult.data.scope,
      parseResult.data.window,
    ),
  );
}

export async function handleSocialProfileRead(
  request: Request,
  env: VibeWorkerEnv,
  login: string,
) {
  const viewerAccountId = await getRequestAccountId(request, env);
  const profile = await getSocialProfileByLogin(env, login, viewerAccountId);

  if (!profile) {
    return json({ error: "Profile not found" }, { status: 404 });
  }

  return json(profile);
}
