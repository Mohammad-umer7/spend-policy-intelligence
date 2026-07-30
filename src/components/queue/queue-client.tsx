"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { departments } from "@/lib/data/company";
import { formatAed, formatAge, formatDate } from "@/lib/format";
import {
  defaultQuery,
  filterCases,
  isQueueFilter,
  sortForQueue,
  type QueueFilter,
  type QueueQuery,
} from "@/lib/engine/queue-filters";
import type { DepartmentId } from "@/lib/types";
import { useQueryParams } from "@/lib/hooks/use-query-params";
import { useCases, useLocale, useLocalised, useT } from "@/lib/store/hooks";
import { Button, EmptyState, Panel, RiskBadge, VerdictBadge } from "@/components/ui/primitives";
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
  const searchParams = useQueryParams();

  // Deep links from the overview set the base query; anything the reviewer
  // then changes is layered on top. Deriving rather than syncing means there
  // is no effect and no state to keep in step with the URL.
  const urlFilter = searchParams.get("filter");
  const urlDepartment = searchParams.get("department");
  const [override, setOverride] = useState<Partial<QueueQuery>>({});

  const query = useMemo<QueueQuery>(
    () => ({
      ...defaultQuery,
      filter: isQueueFilter(urlFilter) ? urlFilter : defaultQuery.filter,
      department: departments.some((d) => d.id === urlDepartment)
        ? (urlDepartment as DepartmentId)
        : defaultQuery.department,
      ...override,
    }),
    [urlFilter, urlDepartment, override],
  );

  const rows = useMemo(() => sortForQueue(filterCases(cases, query)), [cases, query]);

  const isFiltered =
    query.filter !== "all" || query.department !== "all" || query.search.trim() !== "";

  function update(patch: Partial<QueueQuery>) {
    setOverride((prev) => ({ ...prev, ...patch }));
  }

  function clearFilters() {
    setOverride(defaultQuery);
    router.replace("/queue");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-ink-900">{t("queue.title")}</h1>
          <p className="mt-0.5 text-xs text-ink-500">{t("queue.subtitle")}</p>
        </div>
        <p className="numeric text-xs text-ink-500">
          {t("queue.showing", { shown: rows.length, total: cases.length })}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-0.5">
          {filterTabs.map((tab) => {
            const active = query.filter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => update({ filter: tab.value })}
                aria-pressed={active}
                className={cn(
                  "rounded-[0.1875rem] px-2.5 py-1 text-[0.75rem] transition-colors",
                  active
                    ? "bg-ink-900 font-medium text-white"
                    : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
                )}
              >
                {t(tab.labelKey)}
              </button>
            );
          })}
        </div>

        <div className="relative ms-auto min-w-[13rem] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
          <input
            value={query.search}
            onChange={(e) => update({ search: e.target.value })}
            placeholder={t("queue.search")}
            aria-label={t("queue.search")}
            className="h-8 w-full rounded-[0.1875rem] border border-[--hairline] bg-white ps-8 pe-3 text-[0.8125rem] text-ink-900 placeholder:text-ink-400 focus:border-[--hairline-strong] focus:outline-none"
          />
        </div>

        <select
          value={query.department}
          onChange={(e) => update({ department: e.target.value as QueueQuery["department"] })}
          aria-label={t("queue.filter.department")}
          className="h-8 rounded-[0.1875rem] border border-[--hairline] bg-white px-2 text-[0.75rem] text-ink-800 focus:border-[--hairline-strong] focus:outline-none"
        >
          <option value="all">{t("queue.filter.allDepartments")}</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {L(d.name, d.nameAr)}
            </option>
          ))}
        </select>

        {isFiltered ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            {t("queue.filter.clear")}
          </Button>
        ) : null}
      </div>

      <Panel className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            title={t("queue.empty.title")}
            body={t("queue.empty.body")}
            action={
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                {t("queue.filter.clear")}
              </Button>
            }
          />
        ) : (
          <div className="max-h-[calc(100dvh-15rem)] overflow-auto">
            <table className="w-full min-w-[58rem] border-collapse text-start">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="hairline-b">
                  <Th>{t("queue.col.transaction")}</Th>
                  <Th>{t("queue.col.merchant")}</Th>
                  <Th>{t("queue.col.employee")}</Th>
                  <Th>{t("queue.col.department")}</Th>
                  <Th align="end">{t("queue.col.amount")}</Th>
                  <Th>{t("queue.col.verdict")}</Th>
                  <Th>{t("queue.col.risk")}</Th>
                  <Th>{t("queue.col.clause")}</Th>
                  <Th align="end">{t("queue.col.evidence")}</Th>
                  <Th align="end">{t("queue.col.age")}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((record) => {
                  const evidence = record.analysis.evidence;
                  return (
                    <tr
                      key={record.transaction.id}
                      onClick={() => router.push(`/transactions/${record.transaction.id}`)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") router.push(`/transactions/${record.transaction.id}`);
                      }}
                      className="hairline-b cursor-pointer transition-colors last:border-b-0 hover:bg-ink-50 focus-visible:bg-ink-50"
                    >
                      <Td>
                        <span className="numeric font-mono text-[0.75rem] text-ink-700">
                          {record.transaction.id}
                        </span>
                        <span className="mt-0.5 block text-[0.6875rem] text-ink-400">
                          {formatDate(record.transaction.occurredAt, locale)}
                        </span>
                      </Td>
                      <Td>
                        <span className="block max-w-[16rem] truncate text-ink-900">
                          {L(record.transaction.merchant, record.transaction.merchantAr)}
                        </span>
                      </Td>
                      <Td>
                        <span className="block truncate text-ink-800">
                          {L(record.employee.name, record.employee.nameAr)}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-ink-600">
                          {L(record.department.name, record.department.nameAr)}
                        </span>
                      </Td>
                      <Td align="end">
                        <span className="numeric font-medium text-ink-900">
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
                        <span className="numeric font-mono text-[0.6875rem] text-ink-600">
                          {record.analysis.citedClauseIds[0] ?? "—"}
                        </span>
                      </Td>
                      <Td align="end">
                        <span
                          className={cn(
                            "numeric text-[0.75rem]",
                            evidence.missing.length === 0 ? "text-ink-600" : "text-flag-700",
                          )}
                        >
                          {evidence.presentCount}/{evidence.requiredCount}
                        </span>
                      </Td>
                      <Td align="end">
                        <span className="numeric text-[0.75rem] text-ink-500">
                          {formatAge(record.ageHours, locale)}
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
      className={cn("label whitespace-nowrap px-3 py-2", align === "end" ? "text-end" : "text-start")}
    >
      {children}
    </th>
  );
}

function Td({ children, align = "start" }: { children: React.ReactNode; align?: "start" | "end" }) {
  return (
    <td
      className={cn(
        "px-3 py-2.5 align-middle text-[0.8125rem]",
        align === "end" ? "text-end" : "text-start",
      )}
    >
      {children}
    </td>
  );
}
