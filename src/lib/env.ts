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

const databaseUrlEnvKeys = [
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
] as const;

const directDatabaseUrlEnvKeys = [
  "DIRECT_URL",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_URL",
] as const;

function getFirstConfiguredEnvValue(envKeys: readonly string[]) {
  for (const envKey of envKeys) {
    const value = process.env[envKey];

    if (value && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

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

export function getDatabaseUrl() {
  return getFirstConfiguredEnvValue(databaseUrlEnvKeys);
}

export function getDirectDatabaseUrl() {
  return getFirstConfiguredEnvValue(directDatabaseUrlEnvKeys);
}

export function hydrateHostedDatabaseEnv() {
  const databaseUrl = getDatabaseUrl();

  if (databaseUrl && !process.env.DATABASE_URL) {
    process.env.DATABASE_URL = databaseUrl;
  }

  const directUrl = getDirectDatabaseUrl();

  if (directUrl && !process.env.DIRECT_URL) {
    process.env.DIRECT_URL = directUrl;
  }
}

export function hasDurableDatabaseUrl() {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    return false;
  }

  return !databaseUrl.startsWith("file:");
}

export function canEnableHostedGitHubSync() {
  return hasGitHubAppEnv() && hasDurableDatabaseUrl();
}
