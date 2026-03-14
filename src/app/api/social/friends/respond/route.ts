import { NextRequest, NextResponse } from "next/server";

import {
  friendInviteActionSchema,
  getRequiredSocialSession,
  inviteTokenSchema,
  respondToFriendInvite,
} from "@/lib/social";

const respondSchema = inviteTokenSchema.extend({
  action: friendInviteActionSchema,
});

export async function POST(request: NextRequest) {
  const session = await getRequiredSocialSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parseResult = respondSchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "Invalid invite response payload",
        issues: parseResult.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await respondToFriendInvite(
        session.accountId,
        parseResult.data.token,
        parseResult.data.action,
      ),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to respond to invite",
      },
      { status: 400 },
    );
  }
}
