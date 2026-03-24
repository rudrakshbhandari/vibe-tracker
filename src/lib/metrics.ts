import { z } from "zod";

import { getDashboardData } from "@/lib/dashboard";
import type { AnalyticsView } from "@/lib/dashboard";
import { getLiveMetrics } from "@/lib/live-metrics";

export const metricsQuerySchema = z.object({
  view: z.enum(["daily", "weekly", "monthly"]).default("daily"),
  mode: z.enum(["shipped", "merged"]).default("shipped"),
});

function getFallbackFilters(view: AnalyticsView) {
  if (view === "daily") {
    return "Last 14 days";
  }
  if (view === "monthly") {
    return "Last 12 months";
  }
  return "Last 12 weeks";
}

export async function getMetricsResponseAsync(
  input: z.infer<typeof metricsQuerySchema>,
) {
  const normalizedMode = "shipped";
  const liveMetrics = await getLiveMetrics(input.view, normalizedMode);
  const dashboard = liveMetrics ?? getDashboardData(input.view);

  return {
    user: dashboard.profile.login,
    view: input.view,
    mode: normalizedMode,
    generatedAt: new Date().toISOString(),
    filters:
      dashboard.profile.source === "live"
        ? dashboard.filters
        : [getFallbackFilters(input.view), normalizedMode],
    summary: dashboard.summary,
    timeline: dashboard.timeline,
    repositories: dashboard.repositories,
  };
}
