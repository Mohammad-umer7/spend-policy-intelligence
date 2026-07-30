"use client";

import { useMemo } from "react";
import {
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
import { departmentBudgets } from "@/lib/engine/budget";
import { formatAed } from "@/lib/format";
import { useLocale, useLocalised, useT } from "@/lib/store/hooks";
import type { CaseRecord } from "@/lib/types";

/*
  Chart conventions:
  - One axis per chart. No dual-axis anywhere.
  - Recessive grid and axes; labels wear text tokens, never a series colour.
  - "Spent" and "committed" are two steps of one hue because they are parts of a
    single magnitude. Separation is carried by lightness, so it survives any
    form of colour blindness.
  - Charts render left-to-right in both locales: the figures are Latin numerals
    and a mirrored axis reads as a data error, not a translation.
*/

const AXIS_TICK = { fill: "#7a828f", fontSize: 11 };
const GRID_STROKE = "#eceef1";
const SERIES = "#1b4f92";
const SERIES_SOFT = "#9db4d4";

/** Recharts hands the click state an index, not a payload, in v3. */
function rowAtIndex<T>(data: T[], activeIndex: unknown): T | undefined {
  const index = Number(activeIndex);
  return Number.isInteger(index) ? data[index] : undefined;
}

function TooltipShell({ title, rows }: { title: string; rows: { label: string; value: string }[] }) {
  return (
    <div className="rounded-[0.1875rem] border border-[--hairline-strong] bg-white px-2.5 py-2 shadow-md">
      <p className="text-[0.6875rem] font-medium text-ink-900">{title}</p>
      <div className="mt-1.5 space-y-0.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-5">
            <span className="text-[0.6875rem] text-ink-500">{row.label}</span>
            <span className="numeric text-[0.75rem] text-ink-900">{row.value}</span>
          </div>
        ))}
      </div>
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
        }))
        .sort((a, b) => b.spentPct + b.committedPct - (a.spentPct + a.committedPct)),
    [L],
  );

  const max = Math.max(120, ...data.map((d) => d.spentPct + d.committedPct + 8));

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.6875rem] text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2" style={{ background: SERIES }} />
          {t("common.spent")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2" style={{ background: SERIES_SOFT }} />
          {t("common.committed")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-px bg-ink-400" />
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
              cursor={{ fill: "#f6f7f9" }}
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
            <ReferenceLine x={100} stroke="#7a828f" strokeWidth={1} strokeDasharray="3 3" />
            <Bar dataKey="spentPct" stackId="b" fill={SERIES} barSize={13} />
            <Bar dataKey="committedPct" stackId="b" barSize={13}>
              {data.map((entry) => (
                <Cell key={entry.id} fill={SERIES_SOFT} stroke="#ffffff" strokeWidth={1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
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
