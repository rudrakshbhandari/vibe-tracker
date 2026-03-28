import { PrismaClient } from "@prisma/client";

import { hasDurableDatabaseUrl, hydrateHostedDatabaseEnv } from "@/lib/env";

declare global {
  var prisma: PrismaClient | undefined;
}

hydrateHostedDatabaseEnv();

export const db = global.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = db;
}

let hostedRepositorySchemaPromise: Promise<void> | null = null;

export async function ensureHostedRepositorySchema() {
  if (!hasDurableDatabaseUrl()) {
    return;
  }

  if (!hostedRepositorySchemaPromise) {
    hostedRepositorySchemaPromise = db
      .$executeRawUnsafe(
        'ALTER TABLE "Repository" ADD COLUMN IF NOT EXISTS "syncEnabled" BOOLEAN NOT NULL DEFAULT true',
      )
      .then(() => undefined)
      .catch((error) => {
        hostedRepositorySchemaPromise = null;
        throw error;
      });
  }

  await hostedRepositorySchemaPromise;
}
