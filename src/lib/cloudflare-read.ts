import { headers } from "next/headers";

const CLOUDFLARE_WORKER_URL = process.env.CLOUDFLARE_WORKER_URL?.trim();
const CLOUDFLARE_INTERNAL_API_TOKEN =
  process.env.CLOUDFLARE_INTERNAL_API_TOKEN?.trim();

function canUseCloudflareReadProxy() {
  return Boolean(CLOUDFLARE_WORKER_URL && CLOUDFLARE_INTERNAL_API_TOKEN);
}

function buildCloudflareReadUrl(path: string) {
  if (!CLOUDFLARE_WORKER_URL) {
    throw new Error("Cloudflare worker URL is not configured");
  }

  return new URL(path, CLOUDFLARE_WORKER_URL).toString();
}

export function hasCloudflareReadProxy() {
  return canUseCloudflareReadProxy();
}

export async function fetchCloudflareReadJson<T>(
  path: string,
  input: {
    accountId?: string | null;
  } = {},
) {
  if (!canUseCloudflareReadProxy()) {
    return null;
  }

  const requestHeaders = new Headers();
  requestHeaders.set("Accept", "application/json");
  requestHeaders.set(
    "x-vibe-internal-token",
    CLOUDFLARE_INTERNAL_API_TOKEN as string,
  );

  if (input.accountId) {
    requestHeaders.set("x-vibe-account-id", input.accountId);
  } else {
    const cookie = (await headers()).get("cookie");
    if (cookie) {
      requestHeaders.set("cookie", cookie);
    }
  }

  const response = await fetch(buildCloudflareReadUrl(path), {
    headers: requestHeaders,
    cache: "no-store",
  }).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  return (await response.json()) as T;
}
