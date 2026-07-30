"use client";

import { useMemo } from "react";
import Link from "next/link";
import { company } from "@/lib/data/company";
import { companyTotals, departmentBudgets } from "@/lib/engine/budget";
import { formatAed, formatAge, formatPercent } from "@/lib/format";
import { useCases, useLocale, useLocalised, useT } from "@/lib/store/hooks";
import { Panel, SectionHeading, VerdictBadge } from "@/components/ui/primitives";
import { DepartmentBudgetChart, priorityCases } from "@/components/charts/charts";

export default function OverviewPage() {
  const t = useT();
  const locale = useLocale();
  const L = useLocalised();
  const cases = useCases();

  const totals = useMemo(() => companyTotals(), []);
  const budgets = useMemo(() => departmentBudgets(), []);
  const priority = useMemo(() => priorityCases(cases), [cases]);

  const open = cases.filter((c) => c.status === "pending_review");
  const escalations = open.filter((c) => c.analysis.verdict === "escalate");
  const missingEvidence = open.filter((c) => c.analysis.evidence.missing.length > 0);
  const atRisk = budgets.find((b) => b.isForecastOverBudget);
  const money = (n: number) => formatAed(n, locale);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-ink-900">
            {t("overview.title")}
          </h1>
          <p className="mt-0.5 text-xs text-ink-500">
            {L(company.name, company.nameAr)} ·{" "}
            {L(company.fiscalPeriodLabel, company.fiscalPeriodLabelAr)}
          </p>
        </div>
        {escalations.length > 0 ? (
          <Link
            href="/queue?filter=escalate"
            className="text-[0.8125rem] font-medium text-accent-600 underline-offset-2 hover:underline"
          >
            {t("overview.reviewPriority", { count: escalations.length })} →
          </Link>
        ) : null}
      </div>

      {/* Four numbers, one rule, no cards. */}
      <div className="grid grid-cols-2 divide-x divide-[--hairline] border-y border-[--hairline] rtl:divide-x-reverse lg:grid-cols-4">
        <Figure
          label={t("overview.totalSpend")}
          value={money(totals.totalSpend)}
          hint={`${formatPercent(totals.utilisation, locale)} ${t("overview.ofBudget")}`}
        />
        <Figure
          label={t("overview.budgetRemaining")}
          value={money(totals.remaining)}
          hint={`${money(totals.totalCommitted)} ${t("common.committed").toLowerCase()}`}
        />
        <Figure
          label={t("overview.needsReview")}
          value={String(open.length)}
          hint={`${escalations.length} ${t("verdict.escalate").toLowerCase()} · ${open.length - escalations.length} ${t("verdict.flag").toLowerCase()}`}
          href="/queue?filter=needsReview"
        />
        <Figure
          label={t("overview.missingEvidence")}
          value={String(missingEvidence.length)}
          hint={t("overview.acrossTransactions", { count: missingEvidence.length })}
          href="/queue?filter=missingEvidence"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_22rem]">
        <Panel className="p-4">
          <SectionHeading
            title={t("overview.spendByDepartment")}
            hint={
              atRisk
                ? `${L(atRisk.department.name, atRisk.department.nameAr)} — ${t("overview.forecastOver")} ${money(atRisk.varianceAed)}`
                : t("overview.forecastUnder")
            }
          />
          <div className="mt-4">
            <DepartmentBudgetChart />
          </div>
        </Panel>

        <Panel className="flex flex-col p-4">
          <SectionHeading
            title={t("overview.priorityCases")}
            action={
              <Link
                href="/queue"
                className="text-[0.6875rem] text-accent-600 underline-offset-2 hover:underline"
              >
                {t("common.viewAll")}
              </Link>
            }
          />
          <ul className="mt-1 divide-y divide-[--hairline]">
            {priority.slice(0, 6).map((record) => (
              <li key={record.transaction.id}>
                <Link
                  href={`/transactions/${record.transaction.id}`}
                  className="block py-2.5 transition-colors hover:bg-ink-50"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[0.8125rem] text-ink-900">
                      {L(record.transaction.merchant, record.transaction.merchantAr)}
                    </span>
                    <span className="numeric shrink-0 text-[0.75rem] font-medium text-ink-900">
                      {money(record.transaction.amountAed)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[0.6875rem] text-ink-500">
                    <VerdictBadge
                      verdict={record.analysis.verdict}
                      label={t(`verdict.${record.analysis.verdict}`)}
                    />
                    <span className="font-mono">{record.analysis.citedClauseIds[0]}</span>
                    <span className="truncate">
                      {L(record.employee.name, record.employee.nameAr)}
                    </span>
                    <span className="ms-auto shrink-0">{formatAge(record.ageHours, locale)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="label">{label}</p>
      <p className="numeric mt-1.5 text-[1.375rem] font-semibold leading-none tracking-tight text-ink-900">
        {value}
      </p>
      <p className="mt-1.5 text-[0.6875rem] text-ink-500">{hint}</p>
    </>
  );
  return href ? (
    <Link href={href} className="px-4 py-3.5 transition-colors first:ps-0 hover:bg-ink-50">
      {body}
    </Link>
  ) : (
    <div className="px-4 py-3.5 first:ps-0">{body}</div>
  );
}
