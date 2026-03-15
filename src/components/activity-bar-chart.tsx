"use client";

import { useState, useRef } from "react";
import { formatNumber } from "@/lib/dashboard";

const CHART_WIDTH = 960;
const CHART_HEIGHT = 360;
const CHART_PADDING = { top: 20, right: 16, bottom: 40, left: 62 };

type BarGeometry = {
  ticks: number[];
  maxAdditions: number;
  maxDeletions: number;
  bars: Array<{
    label: string;
    centerX: number;
    additionsValue: number;
    deletionsValue: number;
    additions: { x: number; y: number; height: number };
    deletions: { x: number; y: number; height: number };
  }>;
  barWidth: number;
  maxValue: number;
  innerHeight: number;
  baselineY: number;
};

type ActivityBarChartProps = {
  chartGeometry: BarGeometry;
  timelineLength: number;
  view: "daily" | "weekly" | "monthly";
  chartTitle: string;
};

function shouldShowXAxisLabel(index: number, total: number, view: "daily" | "weekly" | "monthly") {
  if (index === 0 || index === total - 1) return true;
  if (view === "monthly") return true;
  return index % 2 === 0;
}

export function ActivityBarChart({ chartGeometry, timelineLength, view, chartTitle }: ActivityBarChartProps) {
  const [tooltip, setTooltip] = useState<{
    label: string;
    type: "additions" | "deletions";
    value: number;
    x: number;
    y: number;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleBarMouseEnter = (
    label: string,
    type: "additions" | "deletions",
    value: number,
    e: React.MouseEvent
  ) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = rect.width / CHART_WIDTH;
    const scaleY = rect.height / CHART_HEIGHT;
    // Use mouse position relative to SVG for tooltip placement
    const x = (e.clientX - rect.left) / scaleX;
    const y = (e.clientY - rect.top) / scaleY;
    setTooltip({ label, type, value, x, y });
  };

  const handleBarMouseLeave = () => setTooltip(null);

  return (
    <div className="bar-chart-shell relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="h-[24rem] w-full"
        role="img"
        aria-label={`${chartTitle} additions and deletions bar chart`}
      >
        {chartGeometry.ticks.map((tick) => {
          const y =
            chartGeometry.baselineY -
            (tick <= 0 ? 0 : (tick / chartGeometry.maxValue) * chartGeometry.innerHeight);
          return (
            <g key={tick}>
              <line
                x1={CHART_PADDING.left}
                x2={CHART_WIDTH - CHART_PADDING.right}
                y1={y}
                y2={y}
                stroke="rgba(89, 98, 112, 0.16)"
                strokeDasharray="4 10"
              />
              <text
                x={CHART_PADDING.left - 12}
                y={y + 4}
                textAnchor="end"
                fill="rgba(91, 99, 111, 0.85)"
                fontSize="12"
              >
                {tick === 0 ? "0" : formatNumber(tick)}
              </text>
            </g>
          );
        })}

        {chartGeometry.bars.map((bar, index) => (
          <g key={bar.label}>
            {/* Additions bar - rx 2 for subtle corner, not overly rounded */}
            <rect
              x={bar.additions.x}
              y={bar.additions.y}
              width={chartGeometry.barWidth}
              height={bar.additions.height}
              rx="0"
              fill="#6e84ad"
              onMouseEnter={(e) => handleBarMouseEnter(bar.label, "additions", bar.additionsValue, e)}
              onMouseLeave={handleBarMouseLeave}
              className="cursor-pointer transition-opacity hover:opacity-90"
            />
            <rect
              x={bar.deletions.x}
              y={bar.deletions.y}
              width={chartGeometry.barWidth}
              height={bar.deletions.height}
              rx="0"
              fill="#d4a06a"
              onMouseEnter={(e) => handleBarMouseEnter(bar.label, "deletions", bar.deletionsValue, e)}
              onMouseLeave={handleBarMouseLeave}
              className="cursor-pointer transition-opacity hover:opacity-90"
            />
            {shouldShowXAxisLabel(index, timelineLength, view) ? (
              <text
                x={bar.centerX}
                y={CHART_HEIGHT - 10}
                textAnchor="middle"
                fill="rgba(91, 99, 111, 0.85)"
                fontSize="12"
              >
                {bar.label}
              </text>
            ) : null}
          </g>
        ))}

        {tooltip ? (
          <foreignObject
            x={Math.max(CHART_PADDING.left, Math.min(tooltip.x - 48, CHART_WIDTH - CHART_PADDING.right - 96))}
            y={Math.max(CHART_PADDING.top - 36, tooltip.y - 44)}
            width="96"
            height="40"
            className="pointer-events-none"
          >
            <div
              className="rounded-lg border border-line bg-[var(--panel-strong)] px-2.5 py-1.5 text-left shadow-lg"
              style={{ font: '12px var(--font-manrope), sans-serif' }}
            >
              <p className="font-medium text-foreground">{tooltip.label}</p>
              <p className="text-muted">
                {tooltip.type === "additions"
                  ? `+${formatNumber(tooltip.value)}`
                  : `-${formatNumber(tooltip.value)}`}
              </p>
            </div>
          </foreignObject>
        ) : null}
      </svg>
    </div>
  );
}
