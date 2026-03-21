import { z } from "zod";

const githubEnvSchema = z.object({
  APP_URL: z.string().url(),
  GITHUB_APP_ID: z.string().min(1),
  GITHUB_APP_CLIENT_ID: z.string().min(1),
  GITHUB_APP_CLIENT_SECRET: z.string().min(1),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1),
  GITHUB_APP_SLUG: z.string().min(1),
  SESSION_ENCRYPTION_KEY: z.string().min(1),
});

const sessionEncryptionSchema = z.object({
  SESSION_ENCRYPTION_KEY: z.string().min(1),
});

export function hasGitHubAppEnv() {
  return githubEnvSchema.safeParse(process.env).success;
}

export function getGitHubAppEnv() {
  return githubEnvSchema.parse(process.env);
}

export function normalizePrivateKey(privateKey: string) {
  return privateKey.replace(/\\n/g, "\n");
}

export function getSessionEncryptionKey() {
  return sessionEncryptionSchema.parse(process.env).SESSION_ENCRYPTION_KEY;
}

export function hasDurableDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return false;
  }

  return !databaseUrl.startsWith("file:");
}

export function canEnableHostedGitHubSync() {
  return hasGitHubAppEnv() && hasDurableDatabaseUrl();
}
