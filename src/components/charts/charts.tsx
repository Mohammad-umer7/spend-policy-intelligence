"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import { departmentBudgets, dailySpendSeries } from "@/lib/engine/budget";
import { formatAed, formatAedCompact, formatPercent } from "@/lib/format";
import { requireClause } from "@/lib/data/policy";
import { isOpen } from "@/lib/engine/rules";
import { useCases, useLocale, useLocalised, useT } from "@/lib/store/hooks";
import type { CaseRecord } from "@/lib/types";

/*
  Chart conventions used throughout:
  - One axis per chart. No dual-axis anywhere.
  - Recessive grid and axes; values and labels wear text tokens, never a series colour.
  - Status colours (emerald / amber / coral) are reserved for verdicts and always
    ship alongside a text label, never as the sole encoding.
  - Charts render left-to-right in both locales: the figures are Latin numerals and
    a mirrored time axis reads as a data error, not a translation.
*/

const AXIS_TICK = { fill: "#5d6b98", fontSize: 11 };
const GRID_STROKE = "rgb(255 255 255 / 0.06)";
const SERIES = "#6366f1";
const SERIES_SOFT = "rgb(99 102 241 / 0.42)";

/** Recharts hands the click state an index, not a payload, in v3. */
function rowAtIndex<T>(data: T[], activeIndex: unknown): T | undefined {
  const index = Number(activeIndex);
  return Number.isInteger(index) ? data[index] : undefined;
}

function TooltipShell({ title, rows }: { title: string; rows: { label: string; value: string }[] }) {
  return (
    <div className="panel-raised px-3 py-2 shadow-xl">
      <p className="text-[0.6875rem] font-medium text-mist-200">{title}</p>
      <div className="mt-1.5 space-y-0.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4">
            <span className="text-[0.6875rem] text-mist-500">{row.label}</span>
            <span className="numeric text-[0.75rem] text-mist-100">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Cumulative spend over the month ───────────────────────────────────── */

export function SpendTrendChart({ height = 220 }: { height?: number }) {
  const locale = useLocale();
  const t = useT();
  const data = useMemo(() => dailySpendSeries(), []);

  return (
    <div dir="ltr" style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="spend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES} stopOpacity={0.34} />
              <stop offset="100%" stopColor={SERIES} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID_STROKE} vertical={false} />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={18}
          />
          <YAxis
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={54}
            tickFormatter={(value: number) => formatAedCompact(value)}
          />
          <Tooltip
            cursor={{ stroke: "rgb(255 255 255 / 0.18)", strokeWidth: 1 }}
            content={(props: TooltipContentProps) => {
              const point = props.payload?.[0]?.payload as
                | { day: string; amountAed: number; cumulativeAed: number }
                | undefined;
              if (!point) return null;
              return (
                <TooltipShell
                  title={point.day}
                  rows={[
                    { label: t("common.spent"), value: formatAed(point.amountAed, locale) },
                    {
                      label: t("overview.totalSpend"),
                      value: formatAed(point.cumulativeAed, locale),
                    },
                  ]}
                />
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="cumulativeAed"
            stroke={SERIES}
            strokeWidth={2}
            fill="url(#spend-fill)"
            animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Spend against budget, normalised so one axis serves every department ─ */

export function DepartmentBudgetChart({
  height = 236,
  onSelect,
}: {
  height?: number;
  onSelect?: (departmentId: string) => void;
}) {
  const locale = useLocale();
  const L = useLocalised();
  const t = useT();

  const data = useMemo(
    () =>
      departmentBudgets()
        .map((b) => ({
          id: b.department.id,
          name: L(b.department.name, b.department.nameAr),
          spentPct: (b.spentAed / b.department.monthlyBudgetAed) * 100,
          committedPct: (b.committedAed / b.department.monthlyBudgetAed) * 100,
          spentAed: b.spentAed,
          committedAed: b.committedAed,
          budgetAed: b.department.monthlyBudgetAed,
          forecastAed: b.forecastAed,
          over: b.isForecastOverBudget,
        }))
        .sort((a, b) => b.spentPct + b.committedPct - (a.spentPct + a.committedPct)),
    [L],
  );

  const max = Math.max(120, ...data.map((d) => d.spentPct + d.committedPct + 8));

  return (
    <div className="w-full">
      {/* Two series, so a legend is always present. */}
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.6875rem] text-mist-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: SERIES }} />
          {t("common.spent")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: SERIES_SOFT }} />
          {t("common.committed")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-px bg-mist-400" />
          {t("common.budget")}
        </span>
      </div>
      <div dir="ltr" style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 2, right: 16, bottom: 0, left: 4 }}
            barCategoryGap={12}
            onClick={(state) => {
              const row = rowAtIndex(data, state?.activeIndex);
              if (row && onSelect) onSelect(row.id);
            }}
          >
            <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
            <XAxis
              type="number"
              domain={[0, max]}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${Math.round(v)}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={92}
            />
            <Tooltip
              cursor={{ fill: "rgb(255 255 255 / 0.04)" }}
              content={(props: TooltipContentProps) => {
                const point = props.payload?.[0]?.payload as (typeof data)[number] | undefined;
                if (!point) return null;
                return (
                  <TooltipShell
                    title={point.name}
                    rows={[
                      { label: t("common.spent"), value: formatAed(point.spentAed, locale) },
                      {
                        label: t("common.committed"),
                        value: formatAed(point.committedAed, locale),
                      },
                      { label: t("common.forecast"), value: formatAed(point.forecastAed, locale) },
                      { label: t("common.budget"), value: formatAed(point.budgetAed, locale) },
                    ]}
                  />
                );
              }}
            />
            {/* The single target line every department is measured against. */}
            <ReferenceLine
              x={100}
              stroke="rgb(255 255 255 / 0.45)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <Bar dataKey="spentPct" stackId="b" fill={SERIES} radius={[0, 0, 0, 3]} barSize={13} />
            <Bar dataKey="committedPct" stackId="b" radius={[3, 3, 3, 0]} barSize={13}>
              {data.map((entry) => (
                <Cell
                  key={entry.id}
                  fill={SERIES_SOFT}
                  // 2px surface gap so the two segments never merge visually.
                  stroke="#0d1226"
                  strokeWidth={2}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Open exceptions grouped by the clause that raised them ────────────── */

export function ExceptionBreakdownChart({
  height = 200,
  onSelect,
}: {
  height?: number;
  onSelect?: (clauseId: string) => void;
}) {
  const L = useLocalised();
  const t = useT();
  const cases = useCases();

  const data = useMemo(() => {
    const counts = new Map<string, number>();
    for (const record of cases) {
      if (record.status !== "pending_review") continue;
      for (const finding of record.analysis.findings.filter(isOpen)) {
        counts.set(finding.clauseId, (counts.get(finding.clauseId) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([clauseId, count]) => {
        const clause = requireClause(clauseId);
        return { clauseId, count, title: L(clause.title, clause.titleAr) };
      })
      .sort((a, b) => b.count - a.count);
  }, [cases, L]);

  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-xs text-mist-500">{t("queue.empty.title")}</p>
    );
  }

  return (
    <div dir="ltr" style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 2, right: 28, bottom: 0, left: 4 }}
          barCategoryGap={9}
          onClick={(state) => {
            const row = rowAtIndex(data, state?.activeIndex);
            if (row && onSelect) onSelect(row.clauseId);
          }}
        >
          <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
          <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="clauseId"
            tick={{ ...AXIS_TICK, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={false}
            width={72}
          />
          <Tooltip
            cursor={{ fill: "rgb(255 255 255 / 0.04)" }}
            content={(props: TooltipContentProps) => {
              const point = props.payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!point) return null;
              return (
                <TooltipShell
                  title={`${point.clauseId} · ${point.title}`}
                  rows={[{ label: t("common.transactions"), value: String(point.count) }]}
                />
              );
            }}
          />
          <Bar dataKey="count" fill={SERIES} radius={[0, 4, 4, 0]} barSize={12} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Shared helper so priority ordering is identical everywhere it is used. */
export function priorityCases(cases: CaseRecord[]): CaseRecord[] {
  const rank = { escalate: 0, flag: 1, pass: 2 } as const;
  return cases
    .filter((c) => c.status === "pending_review")
    .sort(
      (a, b) =>
        rank[a.analysis.verdict] - rank[b.analysis.verdict] ||
        b.transaction.amountAed - a.transaction.amountAed,
    );
}

export { formatPercent };
