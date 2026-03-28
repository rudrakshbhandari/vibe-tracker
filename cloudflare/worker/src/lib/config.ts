import { z } from "zod";

import type { VibeWorkerEnv } from "@/env";

const githubAuthEnvSchema = z.object({
  APP_URL: z.string().url(),
  GITHUB_APP_CLIENT_ID: z.string().min(1),
  GITHUB_APP_CLIENT_SECRET: z.string().min(1),
  GITHUB_APP_SLUG: z.string().min(1),
  SESSION_ENCRYPTION_KEY: z.string().min(1),
});

const githubAppEnvSchema = z.object({
  GITHUB_APP_ID: z.union([z.string().min(1), z.number().int().positive()]),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1),
});

export function hasGitHubAuthEnv(env: VibeWorkerEnv) {
  return githubAuthEnvSchema.safeParse(env).success;
}

export function getGitHubAuthEnv(env: VibeWorkerEnv) {
  return githubAuthEnvSchema.parse(env);
}

export function getGitHubAppEnv(env: VibeWorkerEnv) {
  return githubAppEnvSchema.parse(env);
}

export function hasSyncQueue(env: VibeWorkerEnv) {
  return Boolean(env.SYNC_QUEUE);
}
