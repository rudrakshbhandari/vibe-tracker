import { NextRequest, NextResponse } from "next/server";

import {
  fetchCloudflareReadJson,
  hasCloudflareReadProxy,
} from "@/lib/cloudflare-read";
import { getOptionalUserSession } from "@/lib/session";
import { getSocialProfileByLogin } from "@/lib/social";

type RouteContext = {
  params: Promise<{
    login: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await getOptionalUserSession();
  const { login } = await context.params;

  if (hasCloudflareReadProxy()) {
    const proxied = await fetchCloudflareReadJson(
      `/api/social/profile/${encodeURIComponent(login)}`,
      { accountId: session?.accountId ?? null },
    );

    if (proxied) {
      return NextResponse.json(proxied);
    }
  }

  const profile = await getSocialProfileByLogin(login, session?.accountId);

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json(profile);
}
