import { PrismaClient } from "@prisma/client";

import { hydrateHostedDatabaseEnv } from "@/lib/env";

declare global {
  var prisma: PrismaClient | undefined;
}

hydrateHostedDatabaseEnv();

export const db = global.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = db;
}
