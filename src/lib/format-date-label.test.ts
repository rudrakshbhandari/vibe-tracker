import { describe, expect, it } from "vitest";

import { formatDateLabel } from "@/lib/format-date-label";

describe("formatDateLabel", () => {
  it("formats ISO timestamps in UTC to avoid hydration mismatches", () => {
    expect(formatDateLabel("2026-04-01T00:30:00.000Z")).toBe("Apr 1");
    expect(formatDateLabel("2026-04-01T23:30:00.000Z")).toBe("Apr 1");
  });
});
