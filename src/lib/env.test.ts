import { afterEach, describe, expect, it } from "vitest";

import {
  getDatabaseUrl,
  getDirectDatabaseUrl,
  hasDurableDatabaseUrl,
  hydrateHostedDatabaseEnv,
} from "@/lib/env";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("env helpers", () => {
  it("treats Vercel Postgres aliases as durable database config", () => {
    process.env = { ...originalEnv };
    delete process.env.DATABASE_URL;
    process.env.POSTGRES_PRISMA_URL =
      "postgresql://postgres:postgres@db.example.com:5432/vibe_tracker";

    expect(getDatabaseUrl()).toBe(process.env.POSTGRES_PRISMA_URL);
    expect(hasDurableDatabaseUrl()).toBe(true);
  });

  it("hydrates Prisma env vars from hosted aliases", () => {
    process.env = { ...originalEnv };
    delete process.env.DATABASE_URL;
    delete process.env.DIRECT_URL;
    process.env.POSTGRES_PRISMA_URL =
      "postgresql://postgres:postgres@db.example.com:5432/vibe_tracker";
    process.env.POSTGRES_URL_NON_POOLING =
      "postgresql://postgres:postgres@db.example.com:5432/vibe_tracker_direct";

    hydrateHostedDatabaseEnv();

    expect(process.env.DATABASE_URL).toBe(process.env.POSTGRES_PRISMA_URL);
    expect(process.env.DIRECT_URL).toBe(process.env.POSTGRES_URL_NON_POOLING);
    expect(getDirectDatabaseUrl()).toBe(process.env.POSTGRES_URL_NON_POOLING);
  });

  it("rejects sqlite urls for hosted sync", () => {
    process.env = { ...originalEnv, DATABASE_URL: "file:./dev.db" };
    delete process.env.POSTGRES_PRISMA_URL;
    delete process.env.POSTGRES_URL;

    expect(hasDurableDatabaseUrl()).toBe(false);
  });
});
