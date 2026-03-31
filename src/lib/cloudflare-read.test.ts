import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  cookiesMock,
  headersMock,
} = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  headersMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
  headers: headersMock,
}));

describe("fetchCloudflareReadJson", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    cookiesMock.mockResolvedValue({
      get: vi.fn(),
    });
    headersMock.mockResolvedValue(
      new Headers({
        cookie: "vibe_tracker_session=session-cookie",
      }),
    );
  });

  it("forwards internal auth headers when an account id is provided", async () => {
    vi.stubEnv("CLOUDFLARE_WORKER_URL", "https://worker.example.com");
    vi.stubEnv("CLOUDFLARE_INTERNAL_API_TOKEN", "internal-token");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { fetchCloudflareReadJson } = await import("@/lib/cloudflare-read");

    await fetchCloudflareReadJson("/api/github/state", {
      accountId: "account-123",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://worker.example.com/api/github/state",
      expect.objectContaining({
        cache: "no-store",
        headers: expect.any(Headers),
      }),
    );

    const requestHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(requestHeaders.get("x-vibe-internal-token")).toBe("internal-token");
    expect(requestHeaders.get("x-vibe-account-id")).toBe("account-123");
    expect(requestHeaders.get("cookie")).toBeNull();
  });

  it("falls back to forwarded cookies when no account id is provided", async () => {
    vi.stubEnv("CLOUDFLARE_WORKER_URL", "https://worker.example.com");
    vi.stubEnv("CLOUDFLARE_INTERNAL_API_TOKEN", "internal-token");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { fetchCloudflareReadJson } = await import("@/lib/cloudflare-read");

    await fetchCloudflareReadJson("/api/github/state");

    const requestHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(requestHeaders.get("cookie")).toBe(
      "vibe_tracker_session=session-cookie",
    );
    expect(requestHeaders.get("x-vibe-internal-token")).toBeNull();
    expect(requestHeaders.get("x-vibe-account-id")).toBeNull();
  });

  it("logs when an internal worker read returns a server error", async () => {
    vi.stubEnv("CLOUDFLARE_WORKER_URL", "https://worker.example.com");
    vi.stubEnv("CLOUDFLARE_INTERNAL_API_TOKEN", "internal-token");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response("boom", {
        status: 500,
      }),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", fetchMock);

    const { fetchCloudflareReadJson } = await import("@/lib/cloudflare-read");

    await expect(
      fetchCloudflareReadJson("/api/github/state", {
        accountId: "account-123",
      }),
    ).resolves.toBeNull();

    expect(errorSpy).toHaveBeenCalledWith(
      "Cloudflare read returned non-ok response",
      expect.objectContaining({
        path: "/api/github/state",
        status: 500,
        authMode: "internal-account",
      }),
    );
  });
});
