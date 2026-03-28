import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/github/activity-sync/process/route";

describe("POST /api/github/activity-sync/process", () => {
  it("returns 410 because browser-polled processing is retired", async () => {
    const response = await POST();

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      status: "retired",
    });
  });
});
