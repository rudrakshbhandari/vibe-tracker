import { beforeEach, describe, expect, it, vi } from "vitest";

import { getRequestAccountId } from "@/lib/request-auth";
import type { VibeWorkerEnv } from "@/env";

const { getRequestSessionAccountIdMock } = vi.hoisted(() => ({
  getRequestSessionAccountIdMock: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getRequestSessionAccountId: getRequestSessionAccountIdMock,
}));

function createEnv() {
  return {
    INTERNAL_API_TOKEN: "internal-token",
    DB: {
      prepare(sql: string) {
        return {
          bind(value: number) {
            return {
              async first<T>() {
                if (
                  sql.includes("FROM github_accounts") &&
                  value === 53033094
                ) {
                  return { id: "worker-account-1" } as T;
                }

                return null;
              },
            };
          },
        };
      },
    },
  } as unknown as VibeWorkerEnv;
}

describe("getRequestAccountId", () => {
  beforeEach(() => {
    getRequestSessionAccountIdMock.mockReset();
  });

  it("resolves a trusted github user id to the worker account id", async () => {
    const request = new Request("https://worker.example.com/api/github/state", {
      headers: {
        "x-vibe-internal-token": "internal-token",
        "x-vibe-github-user-id": "53033094",
      },
    });

    await expect(getRequestAccountId(request, createEnv())).resolves.toBe(
      "worker-account-1",
    );
    expect(getRequestSessionAccountIdMock).not.toHaveBeenCalled();
  });

  it("returns null for an invalid trusted github user id header", async () => {
    const request = new Request("https://worker.example.com/api/github/state", {
      headers: {
        "x-vibe-internal-token": "internal-token",
        "x-vibe-github-user-id": "not-a-number",
      },
    });

    await expect(getRequestAccountId(request, createEnv())).resolves.toBeNull();
  });
});
