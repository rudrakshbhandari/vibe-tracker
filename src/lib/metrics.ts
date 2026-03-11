import { z } from "zod";

import { getDashboardData } from "@/lib/dashboard";
import type { AnalyticsView } from "@/lib/dashboard";
import { getLiveMetrics } from "@/lib/live-metrics";

export const metricsQuerySchema = z.object({
  view: z.enum(["daily", "weekly", "monthly"]).default("weekly"),
  mode: z.enum(["authored", "merged"]).default("authored"),
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
  const liveMetrics = await getLiveMetrics(input.view, input.mode);
  const dashboard = liveMetrics ?? getDashboardData();

  return {
    user: dashboard.profile.login,
    view: input.view,
    mode: input.mode,
    generatedAt: new Date().toISOString(),
    filters:
      dashboard.profile.source === "live"
        ? dashboard.filters
        : [getFallbackFilters(input.view), input.mode],
    summary: dashboard.summary,
    timeline: dashboard.timeline,
    repositories: dashboard.repositories,
    decisions: dashboard.decisions,
  };
}
