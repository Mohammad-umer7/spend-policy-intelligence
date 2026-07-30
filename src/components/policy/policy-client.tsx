"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { clauseCategoryLabels, policy } from "@/lib/data/policy";
import { formatAed, formatDate, formatDateTime } from "@/lib/format";
import { useQueryParams } from "@/lib/hooks/use-query-params";
import { useCases, useLocale, useLocalised, useT } from "@/lib/store/hooks";
import { Panel, SectionHeading, VerdictBadge } from "@/components/ui/primitives";
import type { ClauseCategory } from "@/lib/types";

export function PolicyClient() {
  const t = useT();
  const locale = useLocale();
  const L = useLocalised();
  const cases = useCases();
  const searchParams = useQueryParams();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ClauseCategory | "all">("all");
  // Citations elsewhere in the product link straight to a clause. The URL
  // supplies the default selection; clicking the list overrides it.
  const urlClause = searchParams.get("clause");
  const [picked, setPicked] = useState<string | null>(null);
  const selectedId =
    picked ??
    (urlClause && policy.clauses.some((c) => c.id === urlClause)
      ? urlClause
      : policy.clauses[0].id);

  const clauses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return policy.clauses.filter((clause) => {
      if (category !== "all" && clause.category !== category) return false;
      if (!q) return true;
      return (
        clause.id.toLowerCase().includes(q) ||
        clause.title.toLowerCase().includes(q) ||
        clause.text.toLowerCase().includes(q) ||
        clause.titleAr.includes(search.trim()) ||
        clause.textAr.includes(search.trim())
      );
    });
  }, [search, category]);

  const selected = policy.clauses.find((c) => c.id === selectedId) ?? policy.clauses[0];

  /** Which clauses the engine actually cited, and how often. */
  const usage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const record of cases) {
      for (const finding of record.analysis.findings) {
        counts.set(finding.clauseId, (counts.get(finding.clauseId) ?? 0) + 1);
      }
    }
    return counts;
  }, [cases]);

  const relatedCases = useMemo(
    () =>
      cases.filter((record) =>
        record.analysis.findings.some((finding) => finding.clauseId === selected.id),
      ),
    [cases, selected.id],
  );

  const categories: (ClauseCategory | "all")[] = [
    "all",
    ...new Set(policy.clauses.map((c) => c.category)),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-ink-900">
            {t("policy.title")}
          </h1>
          <p className="mt-0.5 text-xs text-ink-500">{t("policy.subtitle")}</p>
        </div>
        <p className="text-xs text-ink-500">
          {policy.documentName} · {policy.version} · {t("policy.owner")}: {policy.owner} ·{" "}
          {t("policy.effective")} {formatDate(policy.effectiveFrom, locale)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr]">
        {/* Clause list */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("policy.search")}
              aria-label={t("policy.search")}
              className="h-8 w-full rounded-[0.1875rem] border border-[--hairline] bg-white ps-8 pe-3 text-[0.8125rem] text-ink-900 placeholder:text-ink-400 focus:border-[--hairline-strong] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-0.5">
            {categories.map((value) => (
              <button
                key={value}
                onClick={() => setCategory(value)}
                aria-pressed={category === value}
                className={cn(
                  "rounded-[0.1875rem] px-2 py-0.5 text-[0.6875rem] transition-colors",
                  category === value
                    ? "bg-ink-900 font-medium text-white"
                    : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
                )}
              >
                {value === "all" ? t("queue.filter.all") : L(clauseCategoryLabels[value].en, clauseCategoryLabels[value].ar)}
              </button>
            ))}
          </div>

          <Panel className="overflow-hidden">
            <ul className="max-h-[calc(100dvh-15rem)] divide-y divide-[--hairline] overflow-y-auto">
              {clauses.map((clause) => {
                const active = clause.id === selected.id;
                const cited = usage.get(clause.id) ?? 0;
                return (
                  <li key={clause.id}>
                    <button
                      onClick={() => setPicked(clause.id)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "flex w-full items-baseline gap-2 px-3 py-2 text-start transition-colors",
                        active ? "bg-ink-100" : "hover:bg-ink-50",
                      )}
                    >
                      <span className="numeric shrink-0 font-mono text-[0.6875rem] text-ink-600">
                        {clause.id}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink-900">
                        {L(clause.title, clause.titleAr)}
                      </span>
                      {cited > 0 ? (
                        <span className="numeric shrink-0 text-[0.6875rem] text-ink-400">
                          {cited}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>

        {/* Clause detail */}
        <div className="space-y-4">
          <Panel className="p-4">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="numeric font-mono text-[0.8125rem] font-medium text-ink-900">
                {selected.id}
              </span>
              <h2 className="text-[0.9375rem] font-semibold text-ink-900">
                {L(selected.title, selected.titleAr)}
              </h2>
              <span className="label ms-auto">{L(clauseCategoryLabels[selected.category].en, clauseCategoryLabels[selected.category].ar)}</span>
            </div>

            <p
              dir={locale === "ar" ? "rtl" : "ltr"}
              className="mt-3 border-s-2 border-[--hairline-strong] ps-3 text-[0.875rem] leading-[1.75] text-ink-800"
            >
              {L(selected.text, selected.textAr)}
            </p>

            <p className="mt-3 text-[0.6875rem] text-ink-500">
              {t("policy.effective")}: {formatDate(selected.effectiveFrom, locale)}
            </p>

            {Object.keys(selected.thresholds ?? {}).length > 0 ? (
              <dl className="hairline-t mt-3 flex flex-wrap gap-x-6 gap-y-2 pt-3">
                {Object.entries(selected.thresholds ?? {}).map(([key, value]) => (
                  <div key={key}>
                    <dt className="label">{key}</dt>
                    <dd className="numeric mt-0.5 text-[0.8125rem] font-medium text-ink-900">
                      {typeof value === "number" && key.toLowerCase().includes("aed")
                        ? formatAed(value, locale)
                        : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </Panel>

          {selected.interpretations.length > 0 ? (
            <Panel className="p-4">
              <SectionHeading title={t("policy.interpretations")} />
              <ul className="mt-2 divide-y divide-[--hairline]">
                {selected.interpretations.map((interpretation) => (
                  <li key={interpretation.id} className="py-2.5">
                    <p className="text-[0.8125rem] leading-relaxed text-ink-800">
                      {L(interpretation.summary, interpretation.summaryAr)}
                    </p>
                    <p className="mt-1 text-[0.6875rem] text-ink-500">
                      {interpretation.recordedBy} ·{" "}
                      {formatDateTime(interpretation.recordedAt, locale)}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel className="p-4">
            <SectionHeading
              title={t("policy.relatedCases")}
              hint={t("overview.acrossTransactions", { count: relatedCases.length })}
            />
            {relatedCases.length === 0 ? (
              <p className="mt-2 text-[0.8125rem] text-ink-500">{t("common.none")}</p>
            ) : (
              <ul className="mt-2 divide-y divide-[--hairline]">
                {relatedCases.slice(0, 8).map((record) => (
                  <li key={record.transaction.id}>
                    <Link
                      href={`/transactions/${record.transaction.id}`}
                      className="flex items-baseline gap-3 py-2 transition-colors hover:bg-ink-50"
                    >
                      <span className="numeric shrink-0 font-mono text-[0.6875rem] text-ink-600">
                        {record.transaction.id}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink-900">
                        {L(record.transaction.merchant, record.transaction.merchantAr)}
                      </span>
                      <VerdictBadge
                        verdict={record.analysis.verdict}
                        label={t(`verdict.${record.analysis.verdict}`)}
                      />
                      <span className="numeric shrink-0 text-[0.75rem] text-ink-700">
                        {formatAed(record.transaction.amountAed, locale)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
