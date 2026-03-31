"use client";

import { useRef, useState } from "react";
import { formatNumber } from "@/lib/dashboard";

const CHART_WIDTH = 960;
const CHART_HEIGHT = 360;
const CHART_PADDING = { top: 20, right: 16, bottom: 40, left: 62 };

type BarGeometry = {
  ticks: number[];
  maxAdditions: number;
  maxDeletions: number;
  displayMaxValue: number;
  hasScaleBreak: boolean;
  bars: Array<{
    label: string;
    centerX: number;
    additionsValue: number;
    deletionsValue: number;
    additions: { x: number; y: number; height: number; truncated: boolean };
    deletions: { x: number; y: number; height: number; truncated: boolean };
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

function getBarTooltip(label: string, series: "Additions" | "Deletions", value: number) {
  return `${label} ${series}: ${value === 0 ? "0" : formatNumber(value)}`;
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

  const handleBarEnter = (
    label: string,
    type: "additions" | "deletions",
    value: number,
    x: number,
    y: number,
  ) => {
    setTooltip({ label, type, value, x, y });
  };

  const handleBarMouseEnter = (
    label: string,
    type: "additions" | "deletions",
    value: number,
    e: React.MouseEvent,
  ) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = rect.width / CHART_WIDTH;
    const scaleY = rect.height / CHART_HEIGHT;
    handleBarEnter(label, type, value, (e.clientX - rect.left) / scaleX, (e.clientY - rect.top) / scaleY);
  };

  const handleBarFocus = (
    label: string,
    type: "additions" | "deletions",
    value: number,
    x: number,
    y: number,
  ) => {
    handleBarEnter(label, type, value, x, y);
  };

  const handleBarMouseLeave = () => setTooltip(null);

  return (
    <div className="bar-chart-shell relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="h-[14rem] w-full sm:h-[20rem] md:h-[24rem]"
        role="img"
        aria-label={`${chartTitle} additions above zero and deletions below zero bar chart${chartGeometry.hasScaleBreak ? ", with overflow caps for outlier periods" : ""}`}
      >
        {chartGeometry.ticks.map((tick) => {
          const ratio = tick <= 0 ? 0 : tick / chartGeometry.displayMaxValue;
          const offset = ratio * ((chartGeometry.innerHeight - 18) / 2);
          const topY = chartGeometry.baselineY - offset;
          const bottomY = chartGeometry.baselineY + offset;
          return (
            <g key={tick}>
              <line
                x1={CHART_PADDING.left}
                x2={CHART_WIDTH - CHART_PADDING.right}
                y1={topY}
                y2={topY}
                stroke="rgba(89, 98, 112, 0.16)"
                strokeDasharray="4 10"
              />
              <text
                x={CHART_PADDING.left - 12}
                y={topY + 4}
                textAnchor="end"
                fill="rgba(91, 99, 111, 0.85)"
                fontSize="12"
              >
                {tick === 0 ? "0" : formatNumber(tick)}
              </text>
              {tick > 0 ? (
                <>
                  <line
                    x1={CHART_PADDING.left}
                    x2={CHART_WIDTH - CHART_PADDING.right}
                    y1={bottomY}
                    y2={bottomY}
                    stroke="rgba(89, 98, 112, 0.1)"
                    strokeDasharray="4 10"
                  />
                  <text
                    x={CHART_PADDING.left - 12}
                    y={bottomY + 4}
                    textAnchor="end"
                    fill="rgba(91, 99, 111, 0.78)"
                    fontSize="12"
                  >
                    -{formatNumber(tick)}
                  </text>
                </>
              ) : null}
            </g>
          );
        })}

        <line
          x1={CHART_PADDING.left}
          x2={CHART_WIDTH - CHART_PADDING.right}
          y1={chartGeometry.baselineY}
          y2={chartGeometry.baselineY}
          stroke="rgba(89, 98, 112, 0.28)"
        />

        <text x={CHART_PADDING.left} y={CHART_PADDING.top - 2} className="chart-axis-caption">
          Additions
        </text>
        <text x={CHART_PADDING.left} y={CHART_HEIGHT - CHART_PADDING.bottom + 28} className="chart-axis-caption">
          Deletions
        </text>

        {chartGeometry.bars.map((bar, index) => (
          <g key={bar.label}>
            <g
              className="chart-bar-group"
              tabIndex={0}
              role="img"
              aria-label={getBarTooltip(bar.label, "Additions", bar.additionsValue)}
              onFocus={() =>
                handleBarFocus(
                  bar.label,
                  "additions",
                  bar.additionsValue,
                  bar.additions.x + chartGeometry.barWidth / 2,
                  Math.max(CHART_PADDING.top, bar.additions.y - 12),
                )
              }
              onBlur={handleBarMouseLeave}
            >
              <title>{getBarTooltip(bar.label, "Additions", bar.additionsValue)}</title>
              <rect
                x={bar.additions.x}
                y={bar.additions.y}
                width={chartGeometry.barWidth}
                height={bar.additions.height}
                rx="3"
                fill="#6e84ad"
                onMouseEnter={(e) => handleBarMouseEnter(bar.label, "additions", bar.additionsValue, e)}
                onMouseLeave={handleBarMouseLeave}
                className="chart-bar chart-bar-additions"
              />
              {bar.additions.truncated ? (
                <line
                  x1={bar.additions.x}
                  x2={bar.additions.x + chartGeometry.barWidth}
                  y1={bar.additions.y + 3}
                  y2={bar.additions.y + 3}
                  className="chart-overflow-cap"
                />
              ) : null}
            </g>
            <g
              className="chart-bar-group"
              tabIndex={0}
              role="img"
              aria-label={getBarTooltip(bar.label, "Deletions", bar.deletionsValue)}
              onFocus={() =>
                handleBarFocus(
                  bar.label,
                  "deletions",
                  bar.deletionsValue,
                  bar.deletions.x + chartGeometry.barWidth / 2,
                  Math.max(CHART_PADDING.top, bar.deletions.y - 12),
                )
              }
              onBlur={handleBarMouseLeave}
            >
              <title>{getBarTooltip(bar.label, "Deletions", bar.deletionsValue)}</title>
              <rect
                x={bar.deletions.x}
                y={bar.deletions.y}
                width={chartGeometry.barWidth}
                height={bar.deletions.height}
                rx="3"
                fill="#d4a06a"
                onMouseEnter={(e) => handleBarMouseEnter(bar.label, "deletions", bar.deletionsValue, e)}
                onMouseLeave={handleBarMouseLeave}
                className="chart-bar chart-bar-deletions"
              />
              {bar.deletions.truncated ? (
                <line
                  x1={bar.deletions.x}
                  x2={bar.deletions.x + chartGeometry.barWidth}
                  y1={bar.deletions.y + bar.deletions.height - 3}
                  y2={bar.deletions.y + bar.deletions.height - 3}
                  className="chart-overflow-cap"
                />
              ) : null}
            </g>
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
