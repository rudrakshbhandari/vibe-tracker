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

let hostedSchemaCompatibilityPromise: Promise<void> | null = null;

export async function ensureHostedSchemaCompatibility() {
  if (!hasDurableDatabaseUrl()) {
    return;
  }

  if (!hostedSchemaCompatibilityPromise) {
    hostedSchemaCompatibilityPromise = db
      .$transaction([
        db.$executeRawUnsafe(
          'ALTER TABLE "Repository" ADD COLUMN IF NOT EXISTS "syncEnabled" BOOLEAN NOT NULL DEFAULT true',
        ),
        db.$executeRawUnsafe(
          'ALTER TABLE "Installation" ADD COLUMN IF NOT EXISTS "syncSelectionUpdatedAt" TIMESTAMP(3)',
        ),
      ])
      .then(() => undefined)
      .catch((error) => {
        hostedSchemaCompatibilityPromise = null;
        throw error;
      });
  }

  await hostedSchemaCompatibilityPromise;
}
