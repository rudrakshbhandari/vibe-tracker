import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const CLOUDFLARE_WORKER_URL = process.env.CLOUDFLARE_WORKER_URL?.trim();
const CLOUDFLARE_INTERNAL_API_TOKEN =
  process.env.CLOUDFLARE_INTERNAL_API_TOKEN?.trim();

function buildCloudflareWorkerUrl(path: string) {
  if (!CLOUDFLARE_WORKER_URL) {
    throw new Error("Cloudflare worker URL is not configured");
  }

  return new URL(path, CLOUDFLARE_WORKER_URL).toString();
}

async function buildForwardHeaders(
  input: {
    accountId?: string | null;
    request?: NextRequest | Request;
    contentType?: string | null;
    accept?: string | null;
  } = {},
) {
  const requestHeaders = new Headers();

  if (input.accept) {
    requestHeaders.set("accept", input.accept);
  }
  if (input.contentType) {
    requestHeaders.set("content-type", input.contentType);
  }

  if (input.accountId && CLOUDFLARE_INTERNAL_API_TOKEN) {
    requestHeaders.set(
      "x-vibe-internal-token",
      CLOUDFLARE_INTERNAL_API_TOKEN,
    );
    requestHeaders.set("x-vibe-account-id", input.accountId);
    return requestHeaders;
  }

  const forwardedCookie =
    input.request?.headers.get("cookie") ?? (await headers()).get("cookie");
  if (forwardedCookie) {
    requestHeaders.set("cookie", forwardedCookie);
  }

  return requestHeaders;
}

function canUseCloudflareReadProxy() {
  return Boolean(CLOUDFLARE_WORKER_URL && CLOUDFLARE_INTERNAL_API_TOKEN);
}

export function hasCloudflareReadProxy() {
  return canUseCloudflareReadProxy();
}

export function hasCloudflareWorkerProxy() {
  return Boolean(CLOUDFLARE_WORKER_URL);
}

export async function hasCloudflareSessionCookie() {
  return Boolean((await cookies()).get("vibe_tracker_session")?.value);
}

export async function fetchCloudflareReadJson<T>(
  path: string,
  input: {
    accountId?: string | null;
  } = {},
) {
  if (!CLOUDFLARE_WORKER_URL) {
    return null;
  }

  const response = await fetch(buildCloudflareWorkerUrl(path), {
    headers: await buildForwardHeaders({
      accountId: input.accountId,
      accept: "application/json",
    }),
    cache: "no-store",
  }).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  return (await response.json()) as T;
}

export async function proxyCloudflareRequest(
  request: NextRequest,
  path: string,
  input: {
    method?: string;
  } = {},
) {
  if (!CLOUDFLARE_WORKER_URL) {
    return NextResponse.json(
      { error: "Cloudflare worker URL is not configured" },
      { status: 503 },
    );
  }

  const method = input.method ?? request.method;
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await request.text() : undefined;

  const response = await fetch(buildCloudflareWorkerUrl(path), {
    method,
    headers: await buildForwardHeaders({
      request,
      accept: request.headers.get("accept"),
      contentType: request.headers.get("content-type"),
    }),
    body,
    cache: "no-store",
    redirect: "manual",
  }).catch(() => null);

  if (!response) {
    return NextResponse.json(
      { error: "Cloudflare worker request failed" },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers(response.headers);
  const responseBody =
    method === "HEAD" || response.status === 204 || response.status === 304
      ? null
      : await response.text();

  return new NextResponse(responseBody, {
    status: response.status,
    headers: responseHeaders,
  });
}
