import { describe, expect, it, vi, afterEach } from "vitest";

import { getBrowserTimezone } from "@/components/timezone-sync";
import { getResolvedTheme } from "@/components/theme-toggle";

describe("browser API guards", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not throw when localStorage reads fail during theme toggle render", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("storage blocked");
        },
      },
      matchMedia: () => ({ matches: false }),
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    });
    vi.stubGlobal("document", {
      documentElement: {
        getAttribute: () => null,
      },
    });

    expect(() => getResolvedTheme()).not.toThrow();
    expect(getResolvedTheme()).toBe("light");
  });

  it("returns null when timezone lookup throws", () => {
    const originalDateTimeFormat = Intl.DateTimeFormat;
    vi.stubGlobal("Intl", {
      ...Intl,
      DateTimeFormat: vi.fn(() => {
        throw new Error("intl blocked");
      }),
    });

    expect(getBrowserTimezone()).toBeNull();

    vi.stubGlobal("Intl", {
      ...Intl,
      DateTimeFormat: originalDateTimeFormat,
    });
  });
});
