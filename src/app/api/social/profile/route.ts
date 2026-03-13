import { NextRequest, NextResponse } from "next/server";

import {
  getRequiredSocialSession,
  socialProfileUpdateSchema,
  updateSocialProfile,
} from "@/lib/social";

export async function PATCH(request: NextRequest) {
  const session = await getRequiredSocialSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parseResult = socialProfileUpdateSchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "Invalid social profile payload",
        issues: parseResult.error.flatten(),
      },
      { status: 400 },
    );
  }

  return NextResponse.json(await updateSocialProfile(session.accountId, parseResult.data));
}
