import { describe, expect, it } from "vitest";

import { getLinkPrefetch } from "@/lib/link-prefetch";

describe("getLinkPrefetch", () => {
  it("disables prefetch for API route navigations", () => {
    expect(getLinkPrefetch("/api/github/connect")).toBe(false);
    expect(getLinkPrefetch("/api/github/install")).toBe(false);
    expect(getLinkPrefetch("/api/session/reset")).toBe(false);
  });

  it("keeps default prefetch behavior for app pages", () => {
    expect(getLinkPrefetch("/")).toBeUndefined();
    expect(getLinkPrefetch("/privacy")).toBeUndefined();
    expect(getLinkPrefetch("/social")).toBeUndefined();
  });
});
