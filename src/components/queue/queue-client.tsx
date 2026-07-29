"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Search, SlidersHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { departments } from "@/lib/data/company";
import { formatAed, formatAge, formatDate } from "@/lib/format";
import {
  defaultQuery,
  filterCases,
  isQueueFilter,
  sortForQueue,
  type AmountRange,
  type DateRange,
  type QueueFilter,
  type QueueQuery,
} from "@/lib/engine/queue-filters";
import type { DepartmentId } from "@/lib/types";
import { useAppliedOnce } from "@/lib/hooks/use-applied-once";
import { useCases, useLocale, useLocalised, useT } from "@/lib/store/hooks";
import {
  Button,
  Chip,
  EmptyState,
  Panel,
  RiskBadge,
  VerdictBadge,
} from "@/components/ui/primitives";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const filterTabs: { value: QueueFilter; labelKey: TranslationKey }[] = [
  { value: "all", labelKey: "queue.filter.all" },
  { value: "escalate", labelKey: "queue.filter.escalate" },
  { value: "flag", labelKey: "queue.filter.flag" },
  { value: "pass", labelKey: "queue.filter.pass" },
  { value: "highRisk", labelKey: "queue.filter.highRisk" },
  { value: "missingEvidence", labelKey: "queue.filter.missingEvidence" },
];

export function QueueClient() {
  const t = useT();
  const locale = useLocale();
  const L = useLocalised();
  const cases = useCases();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState<QueueQuery>(defaultQuery);

  // Deep links from the dashboard and notifications land here. Applying them
  // during render means the first paint already shows the filtered queue.
  const urlFilter = searchParams.get("filter");
  const urlDepartment = searchParams.get("department");
  useAppliedOnce(`${urlFilter ?? ""}|${urlDepartment ?? ""}`, () => {
    setQuery((prev) => ({
      ...prev,
      filter: isQueueFilter(urlFilter) ? urlFilter : prev.filter,
      department: departments.some((d) => d.id === urlDepartment)
        ? (urlDepartment as DepartmentId)
        : prev.department,
    }));
  });

  const rows = useMemo(
    () => sortForQueue(filterCases(cases, query)),
    [cases, query],
  );

  const isFiltered =
    query.filter !== "all" ||
    query.department !== "all" ||
    query.amount !== "any" ||
    query.date !== "any" ||
    query.search.trim() !== "";

  function update(patch: Partial<QueueQuery>) {
    setQuery((prev) => ({ ...prev, ...patch }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-mist-50">{t("queue.title")}</h1>
          <p className="mt-1 text-xs text-mist-400">{t("queue.subtitle")}</p>
        </div>
        <p className="text-xs text-mist-500">
          {t("queue.showing", { shown: rows.length, total: cases.length })}
        </p>
      </div>

      {/* Filters */}
      <Panel variant="glass" className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-white/8 bg-white/3 p-1">
            {filterTabs.map((tab) => {
              const active = query.filter === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => update({ filter: tab.value })}
                  className={cn(
                    "relative rounded-md px-2.5 py-1.5 text-[0.75rem] transition-colors",
                    active ? "text-mist-50" : "text-mist-400 hover:text-mist-100",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="queue-tab"
                      className="absolute inset-0 -z-10 rounded-md border border-white/12 bg-white/8"
                      transition={{ type: "spring", stiffness: 400, damping: 34 }}
                    />
                  ) : null}
                  {t(tab.labelKey)}
                </button>
              );
            })}
          </div>

          <div className="relative min-w-[13rem] flex-1">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mist-500" />
            <input
              value={query.search}
              onChange={(e) => update({ search: e.target.value })}
              placeholder={t("queue.search")}
              aria-label={t("queue.search")}
              className="h-9 w-full rounded-lg border border-white/10 bg-white/4 ps-8 pe-3 text-[0.8125rem] text-mist-100 placeholder:text-mist-500 focus:border-white/20 focus:outline-none"
            />
          </div>

          <Select
            value={query.department}
            onChange={(v) => update({ department: v as QueueQuery["department"] })}
            ariaLabel={t("queue.filter.department")}
            options={[
              { value: "all", label: t("queue.filter.allDepartments") },
              ...departments.map((d) => ({ value: d.id, label: L(d.name, d.nameAr) })),
            ]}
          />

          <Select
            value={query.amount}
            onChange={(v) => update({ amount: v as AmountRange })}
            ariaLabel={t("queue.filter.amount")}
            options={[
              { value: "any", label: t("queue.filter.anyAmount") },
              { value: "under1k", label: `< ${formatAed(1000, locale)}` },
              { value: "1kTo10k", label: `${formatAed(1000, locale)} – ${formatAed(10000, locale)}` },
              { value: "over10k", label: `> ${formatAed(10000, locale)}` },
            ]}
          />

          <Select
            value={query.date}
            onChange={(v) => update({ date: v as DateRange })}
            ariaLabel={t("queue.filter.date")}
            options={[
              { value: "any", label: t("queue.filter.anyDate") },
              { value: "last7", label: t("queue.filter.last7") },
              { value: "last14", label: t("queue.filter.last14") },
            ]}
          />

          {isFiltered ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery(defaultQuery);
                router.replace("/queue");
              }}
            >
              {t("queue.filter.clear")}
            </Button>
          ) : null}
        </div>
      </Panel>

      {/* Table — solid panel, never glass, so rows stay readable */}
      <Panel className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={<SlidersHorizontal className="h-6 w-6" />}
            title={t("queue.empty.title")}
            body={t("queue.empty.body")}
            action={
              <Button variant="secondary" size="sm" onClick={() => setQuery(defaultQuery)}>
                {t("queue.filter.clear")}
              </Button>
            }
          />
        ) : (
          <div className="max-h-[calc(100dvh-19rem)] overflow-auto">
            <table className="w-full min-w-[68rem] border-collapse text-start">
              <thead className="sticky top-0 z-10 bg-ink-850/95 backdrop-blur">
                <tr className="hairline-b">
                  <Th>{t("queue.col.transaction")}</Th>
                  <Th>{t("queue.col.employee")}</Th>
                  <Th>{t("queue.col.department")}</Th>
                  <Th>{t("queue.col.merchant")}</Th>
                  <Th align="end">{t("queue.col.amount")}</Th>
                  <Th>{t("queue.col.verdict")}</Th>
                  <Th>{t("queue.col.risk")}</Th>
                  <Th>{t("queue.col.clause")}</Th>
                  <Th>{t("queue.col.evidence")}</Th>
                  <Th align="end">{t("queue.col.age")}</Th>
                  <Th align="end">{t("queue.col.action")}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((record) => {
                  const evidence = record.analysis.evidence;
                  const complete = evidence.missing.length === 0;
                  return (
                    <tr
                      key={record.transaction.id}
                      onClick={() => router.push(`/transactions/${record.transaction.id}`)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") router.push(`/transactions/${record.transaction.id}`);
                      }}
                      className="hairline-b cursor-pointer transition-colors last:border-b-0 hover:bg-white/4 focus-visible:bg-white/6"
                    >
                      <Td>
                        <span className="numeric font-mono text-[0.75rem] text-mist-200">
                          {record.transaction.id}
                        </span>
                        <span className="mt-0.5 block text-[0.6875rem] text-mist-500">
                          {formatDate(record.transaction.occurredAt, locale)}
                        </span>
                      </Td>
                      <Td>
                        <span className="block truncate text-mist-100">
                          {L(record.employee.name, record.employee.nameAr)}
                        </span>
                        <span className="mt-0.5 block truncate text-[0.6875rem] text-mist-500">
                          {record.employee.level}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-mist-300">
                          {L(record.department.name, record.department.nameAr)}
                        </span>
                      </Td>
                      <Td>
                        <span className="block max-w-[15rem] truncate text-mist-100">
                          {L(record.transaction.merchant, record.transaction.merchantAr)}
                        </span>
                      </Td>
                      <Td align="end">
                        <span className="numeric font-medium text-mist-50">
                          {formatAed(record.transaction.amountAed, locale)}
                        </span>
                      </Td>
                      <Td>
                        <VerdictBadge
                          verdict={record.analysis.verdict}
                          label={t(`verdict.${record.analysis.verdict}`)}
                        />
                      </Td>
                      <Td>
                        <RiskBadge
                          risk={record.analysis.riskLevel}
                          label={t(`risk.${record.analysis.riskLevel}`)}
                        />
                      </Td>
                      <Td>
                        <span className="numeric font-mono text-[0.6875rem] text-mist-300">
                          {record.analysis.citedClauseIds[0] ?? "—"}
                        </span>
                      </Td>
                      <Td>
                        <Chip tone={complete ? "good" : "warn"}>
                          <span className="numeric">
                            {evidence.presentCount}/{evidence.requiredCount}
                          </span>
                        </Chip>
                      </Td>
                      <Td align="end">
                        <span className="numeric text-[0.75rem] text-mist-400">
                          {formatAge(record.ageHours, locale)}
                        </span>
                      </Td>
                      <Td align="end">
                        <span className="inline-flex items-center gap-1 text-[0.75rem] text-info-400">
                          {t("action.viewCase")}
                          <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Th({ children, align = "start" }: { children: React.ReactNode; align?: "start" | "end" }) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap px-3 py-2.5 text-[0.6875rem] font-medium uppercase tracking-wide text-mist-500",
        align === "end" ? "text-end" : "text-start",
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, align = "start" }: { children: React.ReactNode; align?: "start" | "end" }) {
  return (
    <td
      className={cn(
        "px-3 py-3 align-middle text-[0.8125rem]",
        align === "end" ? "text-end" : "text-start",
      )}
    >
      {children}
    </td>
  );
}

function Select({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className="h-9 rounded-lg border border-white/10 bg-white/4 px-2.5 text-[0.75rem] text-mist-200 focus:border-white/20 focus:outline-none"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} className="bg-ink-850 text-mist-100">
          {option.label}
        </option>
      ))}
    </select>
  );
}
