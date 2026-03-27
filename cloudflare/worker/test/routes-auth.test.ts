import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import worker from "@/index";
import type { VibeWorkerEnv } from "@/env";
import { hashSessionToken } from "@/lib/session";

type AccountRow = {
  id: string;
  github_user_id: number;
  login: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: number;
  updated_at: number;
};

type SessionRow = {
  id: string;
  session_token_hash: string;
  account_id: string;
  github_access_token: string;
  github_access_token_expires_at: number | null;
  github_refresh_token: string | null;
  github_refresh_token_expires_at: number | null;
  expires_at: number;
  created_at: number;
  updated_at: number;
};

class FakePreparedStatement {
  constructor(
    private readonly db: FakeD1Database,
    private readonly sql: string,
    private args: unknown[] = [],
  ) {}

  bind(...args: unknown[]) {
    return new FakePreparedStatement(this.db, this.sql, args);
  }

  async first<T>() {
    return (this.db.first(this.sql, this.args) ?? null) as T | null;
  }

  async run() {
    this.db.run(this.sql, this.args);
    return { success: true };
  }
}

class FakeD1Database {
  readonly accounts: AccountRow[] = [];
  readonly sessions: SessionRow[] = [];

  prepare(sql: string) {
    return new FakePreparedStatement(this, sql);
  }

  first(sql: string, args: unknown[]) {
    if (sql.includes("SELECT id FROM github_accounts")) {
      const account = this.accounts.find(
        (row) => row.github_user_id === Number(args[0]),
      );
      return account ? { id: account.id } : null;
    }

    return null;
  }

  run(sql: string, args: unknown[]) {
    if (sql.includes("INSERT INTO github_accounts")) {
      const existing = this.accounts.find(
        (row) => row.github_user_id === Number(args[1]),
      );

      if (existing) {
        existing.login = String(args[2]);
        existing.display_name = (args[3] as string | null) ?? null;
        existing.avatar_url = (args[4] as string | null) ?? null;
        existing.updated_at = Number(args[6]);
        return;
      }

      this.accounts.push({
        id: String(args[0]),
        github_user_id: Number(args[1]),
        login: String(args[2]),
        display_name: (args[3] as string | null) ?? null,
        avatar_url: (args[4] as string | null) ?? null,
        created_at: Number(args[5]),
        updated_at: Number(args[6]),
      });
      return;
    }

    if (sql.includes("INSERT INTO user_sessions")) {
      this.sessions.push({
        id: String(args[0]),
        session_token_hash: String(args[1]),
        account_id: String(args[2]),
        github_access_token: String(args[3]),
        github_access_token_expires_at: (args[4] as number | null) ?? null,
        github_refresh_token: (args[5] as string | null) ?? null,
        github_refresh_token_expires_at: (args[6] as number | null) ?? null,
        expires_at: Number(args[7]),
        created_at: Number(args[8]),
        updated_at: Number(args[9]),
      });
      return;
    }

    if (sql.includes("DELETE FROM user_sessions")) {
      const keep = this.sessions.filter(
        (row) =>
          row.session_token_hash !== String(args[0]) &&
          row.session_token_hash !== String(args[1]),
      );
      this.sessions.splice(0, this.sessions.length, ...keep);
    }
  }
}

function createEnv(overrides: Partial<VibeWorkerEnv> = {}) {
  return {
    APP_URL: "https://worker.example.com",
    DB: new FakeD1Database() as unknown as D1Database,
    GITHUB_APP_CLIENT_ID: "client-id",
    GITHUB_APP_CLIENT_SECRET: "client-secret",
    GITHUB_APP_SLUG: "vibe-tracker",
    SESSION_ENCRYPTION_KEY: "session-key",
    ...overrides,
  } satisfies VibeWorkerEnv;
}

function createWorkerRequest(input: string, init?: RequestInit) {
  return new Request(input, init) as unknown as Request<
    unknown,
    IncomingRequestCfProperties<unknown>
  >;
}

describe("worker auth routes", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", originalFetch);
  });

  it("redirects connect requests to GitHub and sets the oauth state cookie", async () => {
    const response = await worker.fetch(
      createWorkerRequest("https://worker.example.com/api/github/connect"),
      createEnv(),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain(
      "https://github.com/login/oauth/authorize",
    );
    expect(response.headers.get("set-cookie")).toContain("vibe_tracker_oauth_state=");
  });

  it("completes the callback flow, persists account/session rows, and redirects connected users", async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "access-token",
            expires_in: 3600,
            refresh_token: "refresh-token",
            refresh_token_expires_in: 7200,
            token_type: "bearer",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 123,
            login: "octocat",
            name: "The Octocat",
            avatar_url: "https://avatars.example.com/octocat",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ installations: [{ id: 1 }] }), {
          status: 200,
        }),
      );

    const env = createEnv();
    const response = await worker.fetch(
      createWorkerRequest(
        "https://worker.example.com/api/github/callback?code=code-123&state=state-123",
        {
          headers: {
            cookie: "vibe_tracker_oauth_state=state-123",
          },
        },
      ),
      env,
    );

    const db = env.DB as unknown as FakeD1Database;

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://worker.example.com/?github=connected",
    );
    expect(response.headers.get("set-cookie")).toContain("vibe_tracker_session=");
    expect(db.accounts).toHaveLength(1);
    expect(db.sessions).toHaveLength(1);
    expect(db.accounts[0]?.login).toBe("octocat");
  });

  it("clears the session cookie and deletes the stored session on reset", async () => {
    const env = createEnv();
    const db = env.DB as unknown as FakeD1Database;
    db.sessions.push({
      id: "session-id",
      session_token_hash: await hashSessionToken("session-token"),
      account_id: "account-1",
      github_access_token: "enc",
      github_access_token_expires_at: null,
      github_refresh_token: null,
      github_refresh_token_expires_at: null,
      expires_at: Date.now() + 1000,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    const response = await worker.fetch(
      createWorkerRequest("https://worker.example.com/api/session/reset", {
        headers: {
          cookie: "vibe_tracker_session=session-token",
        },
      }),
      env,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://worker.example.com/?github=session-reset",
    );
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(db.sessions).toHaveLength(0);
  });
});
