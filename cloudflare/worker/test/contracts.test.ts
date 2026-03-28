import { describe, expect, it } from "vitest";

import { parseQueueMessage } from "@/jobs/contracts";

describe("queue contracts", () => {
  it("parses leaderboard update messages", () => {
    expect(
      parseQueueMessage({
        type: "leaderboard-update",
        accountId: "account-1",
        windows: ["7d", "30d"],
      }),
    ).toEqual({
      type: "leaderboard-update",
      accountId: "account-1",
      windows: ["7d", "30d"],
    });
  });

  it("parses installation sync messages", () => {
    expect(
      parseQueueMessage({
        type: "installation-sync",
        accountId: "account-1",
        installation: {
          githubInstallationId: 123,
          accountLogin: "octo-org",
          accountType: "Organization",
          targetType: "organization",
          permissions: {
            contents: "read",
          },
        },
      }),
    ).toEqual({
      type: "installation-sync",
      accountId: "account-1",
      installation: {
        githubInstallationId: 123,
        accountLogin: "octo-org",
        accountType: "Organization",
        targetType: "organization",
        permissions: {
          contents: "read",
        },
      },
    });
  });

  it("rejects unsupported windows", () => {
    expect(() =>
      parseQueueMessage({
        type: "leaderboard-rank-rebuild",
        window: "365d",
      }),
    ).toThrow();
  });
});
