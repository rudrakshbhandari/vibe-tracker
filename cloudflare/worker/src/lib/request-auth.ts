import type { VibeWorkerEnv } from "@/env";
import { getRequestSessionAccountId } from "@/lib/session";

export async function getRequestAccountId(request: Request, env: VibeWorkerEnv) {
  const internalToken = request.headers.get("x-vibe-internal-token");
  const internalAccountId = request.headers.get("x-vibe-account-id");

  if (
    env.INTERNAL_API_TOKEN &&
    internalToken === env.INTERNAL_API_TOKEN &&
    internalAccountId
  ) {
    return internalAccountId;
  }

  return getRequestSessionAccountId(env, request);
}
