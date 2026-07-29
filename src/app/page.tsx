"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  FileWarning,
  PiggyBank,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { company } from "@/lib/data/company";
import { buildDailyBrief } from "@/lib/ai/brief";
import { companyTotals, departmentBudgets } from "@/lib/engine/budget";
import { formatAed, formatAge, formatPercent } from "@/lib/format";
import { useCases, useLocale, useLocalised, useT } from "@/lib/store/hooks";
import { Button, Meter, Panel, SectionHeading, VerdictBadge } from "@/components/ui/primitives";
import { AnimatedNumber, StatTile } from "@/components/overview/stat-tiles";
import {
  DepartmentBudgetChart,
  ExceptionBreakdownChart,
  SpendTrendChart,
  priorityCases,
} from "@/components/charts/charts";

export default function OverviewPage() {
  const t = useT();
  const locale = useLocale();
  const L = useLocalised();
  const cases = useCases();

  const totals = useMemo(() => companyTotals(), []);
  const brief = useMemo(() => buildDailyBrief(cases), [cases]);
  const budgets = useMemo(() => departmentBudgets(), []);
  const priority = useMemo(() => priorityCases(cases), [cases]);

  const open = cases.filter((c) => c.status === "pending_review");
  const escalations = open.filter((c) => c.analysis.verdict === "escalate");
  const highRisk = open.filter((c) => c.analysis.riskLevel === "high");
  const missingEvidence = open.filter((c) => c.analysis.evidence.missing.length > 0);
  const atRisk = budgets.find((b) => b.isForecastOverBudget);
  const money = (n: number) => formatAed(n, locale);

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-mist-50">
            {t("overview.title")}
          </h1>
          <p className="mt-1 text-xs text-mist-400">
            {L(company.name, company.nameAr)} ·{" "}
            {L(company.fiscalPeriodLabel, company.fiscalPeriodLabelAr)}
          </p>
        </div>
        {/* "Priority" means the cases that cannot progress without a decision
            from this reviewer — the escalations, not the whole open queue. */}
        {escalations.length > 0 ? (
          <Link href="/queue?filter=escalate">
            <Button variant="primary" className="gap-2">
              {t("overview.reviewPriority", { count: escalations.length })}
              <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
            </Button>
          </Link>
        ) : null}
      </div>

      {/* AI daily brief — the first thing a finance manager should read */}
      <Panel variant="glass" className="overflow-hidden">
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-start lg:gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-accent-500 to-info-500">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </span>
              <span className="text-[0.8125rem] font-semibold text-mist-50">
                {t("brief.title")}
              </span>
              <span className="rounded border border-flag-500/25 bg-flag-500/10 px-1.5 py-0.5 text-[0.625rem] text-flag-400">
                {t("brief.draftNotice")}
              </span>
            </div>
            <p className="mt-3 max-w-4xl text-[0.9375rem] leading-relaxed text-mist-100">
              {L(brief.headline, brief.headlineAr)}
            </p>
            <div className="mt-3.5 flex flex-wrap gap-2">
              {[...brief.attention, ...brief.savings].map((insight) => (
                <Link
                  key={insight.id}
                  href={insight.href}
                  className="rounded-lg border border-white/10 bg-white/4 px-2.5 py-1.5 text-[0.75rem] text-mist-300 transition-colors hover:border-white/20 hover:bg-white/8 hover:text-mist-100"
                >
                  {L(insight.title, insight.titleAr)}
                </Link>
              ))}
            </div>
          </div>

          {/* Most urgent action */}
          {brief.mostUrgent ? (
            <Link
              href={`/transactions/${brief.mostUrgent.transaction.id}`}
              className="w-full shrink-0 lg:w-80"
            >
              <Panel variant="raised" className="elevate h-full px-3.5 py-3">
                <p className="text-[0.625rem] uppercase tracking-wide text-mist-500">
                  {t("overview.mostUrgent")}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <VerdictBadge
                    verdict={brief.mostUrgent.analysis.verdict}
                    label={t(`verdict.${brief.mostUrgent.analysis.verdict}`)}
                  />
                  <span className="numeric font-mono text-[0.6875rem] text-mist-500">
                    {brief.mostUrgent.transaction.id}
                  </span>
                </div>
                <p className="mt-2 text-[0.8125rem] leading-snug text-mist-100">
                  {L(
                    brief.mostUrgent.analysis.recommendedAction.label,
                    brief.mostUrgent.analysis.recommendedAction.labelAr,
                  )}
                </p>
                <p className="mt-1.5 truncate text-[0.6875rem] text-mist-400">
                  {L(brief.mostUrgent.transaction.merchant, brief.mostUrgent.transaction.merchantAr)}{" "}
                  · {money(brief.mostUrgent.transaction.amountAed)}
                </p>
              </Panel>
            </Link>
          ) : null}
        </div>
      </Panel>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label={t("overview.totalSpend")}
          icon={Wallet}
          value={<AnimatedNumber value={totals.totalSpend} format={(v) => money(v)} />}
          hint={`${cases.length} ${t("common.transactions")}`}
        />
        <StatTile
          label={t("overview.budgetUsed")}
          icon={TrendingUp}
          tone={totals.utilisation > 0.9 ? "warn" : "neutral"}
          value={
            <AnimatedNumber value={totals.utilisation} format={(v) => formatPercent(v, locale)} />
          }
          hint={`${money(totals.totalSpend)} ${t("common.of")} ${money(totals.totalBudget)}`}
          footer={
            <Meter value={totals.utilisation} tone={totals.utilisation > 0.9 ? "warn" : "accent"} />
          }
        />
        <StatTile
          label={t("overview.budgetRemaining")}
          value={<AnimatedNumber value={totals.remaining} format={(v) => money(v)} />}
          hint={`${money(totals.totalCommitted)} ${t("common.committed").toLowerCase()}`}
        />
        <StatTile
          label={t("overview.needsReview")}
          icon={AlertTriangle}
          tone={open.length > 0 ? "warn" : "good"}
          href="/queue?filter=needsReview"
          value={<AnimatedNumber value={open.length} format={(v) => String(Math.round(v))} />}
          hint={`${escalations.length} ${t("verdict.escalate")} · ${open.filter((c) => c.analysis.verdict === "flag").length} ${t("verdict.flag")}`}
        />
        <StatTile
          label={t("overview.highRisk")}
          icon={ShieldAlert}
          tone={highRisk.length > 0 ? "danger" : "good"}
          href="/queue?filter=highRisk"
          value={<AnimatedNumber value={highRisk.length} format={(v) => String(Math.round(v))} />}
          hint={t("risk.high")}
        />
        <StatTile
          label={t("overview.missingEvidence")}
          icon={FileWarning}
          tone={missingEvidence.length > 0 ? "info" : "good"}
          href="/queue?filter=missingEvidence"
          value={
            <AnimatedNumber value={missingEvidence.length} format={(v) => String(Math.round(v))} />
          }
          hint={t("overview.acrossTransactions", { count: missingEvidence.length })}
        />
      </div>

      {/* Charts + priority queue */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Panel className="p-4 xl:col-span-2">
          <SectionHeading
            title={t("overview.spendTrend")}
            hint={`${money(totals.totalSpend)} ${t("common.of")} ${money(totals.totalBudget)} · ${formatPercent(totals.utilisation, locale)} ${t("overview.ofBudget")}`}
          />
          <div className="mt-3">
            <SpendTrendChart />
          </div>
        </Panel>

        <Panel className="flex flex-col p-4">
          <SectionHeading
            title={t("overview.priorityCases")}
            hint={t("overview.acrossTransactions", { count: priority.length })}
            action={
              <Link
                href="/queue"
                className="text-[0.6875rem] text-info-400 underline-offset-2 hover:underline"
              >
                {t("common.viewAll")}
              </Link>
            }
          />
          <div className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto pe-0.5">
            {priority.slice(0, 6).map((record) => (
              <Link
                key={record.transaction.id}
                href={`/transactions/${record.transaction.id}`}
                className="block rounded-lg border border-white/8 bg-white/3 px-3 py-2.5 transition-colors hover:border-white/18 hover:bg-white/6"
              >
                <div className="flex items-center justify-between gap-2">
                  <VerdictBadge
                    verdict={record.analysis.verdict}
                    label={t(`verdict.${record.analysis.verdict}`)}
                  />
                  <span className="numeric text-[0.75rem] font-medium text-mist-100">
                    {money(record.transaction.amountAed)}
                  </span>
                </div>
                <p className="mt-1.5 truncate text-[0.8125rem] text-mist-100">
                  {L(record.transaction.merchant, record.transaction.merchantAr)}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-[0.6875rem] text-mist-500">
                  <span className="font-mono">{record.analysis.citedClauseIds[0]}</span>
                  <span>·</span>
                  <span className="truncate">
                    {L(record.employee.name, record.employee.nameAr)}
                  </span>
                  <span>·</span>
                  <span>{formatAge(record.ageHours, locale)}</span>
                </p>
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      {/* Budget, exceptions, savings */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <Panel className="p-4">
          <SectionHeading
            title={t("overview.spendByDepartment")}
            hint={
              atRisk
                ? `${L(atRisk.department.name, atRisk.department.nameAr)} — ${t("overview.forecastOver")}`
                : t("overview.forecastUnder")
            }
          />
          <div className="mt-3">
            <DepartmentBudgetChart />
          </div>
        </Panel>

        <Panel className="p-4">
          <SectionHeading
            title={t("overview.exceptionBreakdown")}
            hint={t("overview.acrossTransactions", { count: open.length })}
          />
          <div className="mt-3">
            <ExceptionBreakdownChart />
          </div>
        </Panel>

        <div className="space-y-3">
          <StatTile
            label={t("overview.potentialSavings")}
            icon={PiggyBank}
            tone="good"
            href="/brief"
            value={<AnimatedNumber value={brief.potentialSavingsAed} format={(v) => money(v)} />}
            hint={L(
              brief.savings[0]?.title ?? "No overlapping subscriptions identified",
              brief.savings[0]?.titleAr ?? "لم يتم تحديد اشتراكات متداخلة",
            )}
          />
          {atRisk ? (
            <StatTile
              label={t("overview.atRiskDepartment")}
              icon={TrendingUp}
              tone="warn"
              href={`/queue?department=${atRisk.department.id}`}
              value={
                <span className="text-xl">
                  {L(atRisk.department.name, atRisk.department.nameAr)}
                </span>
              }
              hint={`${t("common.forecast")} ${money(atRisk.forecastAed)} ${t("common.of")} ${money(atRisk.department.monthlyBudgetAed)} · +${money(atRisk.varianceAed)}`}
              footer={
                <Meter
                  value={atRisk.forecastAed / atRisk.department.monthlyBudgetAed}
                  tone="danger"
                />
              }
            />
          ) : null}
        </div>
      </div>

      <p className="pt-1 text-center text-[0.6875rem] text-mist-600">{t("app.syntheticNotice")}</p>
    </div>
  );
}
