import { z } from "zod";

import { getDashboardData } from "@/lib/dashboard";

export const metricsQuerySchema = z.object({
  window: z.enum(["7d", "30d", "90d"]).default("30d"),
  mode: z.enum(["authored", "merged"]).default("authored"),
});

export function getMetricsResponse(input: z.infer<typeof metricsQuerySchema>) {
  const dashboard = getDashboardData();

  return {
    user: dashboard.profile.login,
    window: input.window,
    mode: input.mode,
    generatedAt: new Date().toISOString(),
    summary: dashboard.summary,
    timeline: dashboard.timeline,
    repositories: dashboard.repositories,
    decisions: dashboard.decisions,
  };
}
