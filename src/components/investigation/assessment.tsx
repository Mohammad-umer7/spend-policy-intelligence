"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { CaseRecord } from "@/lib/types";
import { formatAed, formatPercent } from "@/lib/format";
import { evidenceLabel } from "@/lib/engine/evidence";
import { isOpen } from "@/lib/engine/rules";
import { useAppliedOnce } from "@/lib/hooks/use-applied-once";
import { useLocale, useLocalised, useT } from "@/lib/store/hooks";
import { Meter, Panel, SectionHeading, VerdictBadge } from "@/components/ui/primitives";

/**
 * Fetches a Claude-written explanation when the deployment is configured for
 * it. The deterministic assessment is already on screen before this resolves,
 * so a slow or failed call never blocks the reviewer.
 */
interface Narrative {
  headline: string;
  headlineAr: string;
  explanation: string;
  explanationAr: string;
}

function useExplanation(record: CaseRecord): Narrative {
  // Only the Claude rewrite lives in state. The deterministic narrative is
  // always derived from the analysis, so it renders on the very first paint
  // and there is nothing to reset when the case changes.
  const [override, setOverride] = useState<Narrative | null>(null);
  useAppliedOnce(record.transaction.id, () => setOverride(null));

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const status = await fetch("/api/explain");
        if (!status.ok) return;
        const { provider } = (await status.json()) as { provider: string };
        if (provider !== "claude" || cancelled) return;

        const response = await fetch("/api/explain", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ transactionId: record.transaction.id }),
        });
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as Narrative;
        if (cancelled) return;
        setOverride({
          headline: data.headline,
          headlineAr: data.headlineAr,
          explanation: data.explanation,
          explanationAr: data.explanationAr,
        });
      } catch {
        // Deterministic narrative already rendered; nothing to recover.
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [record.transaction.id]);

  return (
    override ?? {
      headline: record.analysis.headline,
      headlineAr: record.analysis.headlineAr,
      explanation: record.analysis.explanation,
      explanationAr: record.analysis.explanationAr,
    }
  );
}

export function AssessmentColumn({ record }: { record: CaseRecord }) {
  const t = useT();
  const locale = useLocale();
  const L = useLocalised();
  const narrative = useExplanation(record);
  // The explanation has its own language switch so a presenter can show the
  // Arabic wording without changing the whole interface. It follows the global
  // locale until the reviewer overrides it here.
  const [explanationLocale, setExplanationLocale] = useState<"en" | "ar">(locale);
  useAppliedOnce(locale, () => setExplanationLocale(locale));

  const { analysis, transaction } = record;
  const money = (n: number) => formatAed(n, locale);
  const budget = analysis.budgetImpact;

  return (
    <div className="space-y-4">
      <Panel>
        <div className="px-4 pt-4">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <VerdictBadge
              verdict={analysis.verdict}
              label={t(`verdict.${analysis.verdict}`)}
              size="lg"
            />
            <span className="text-[0.6875rem] text-ink-500">
              {t(`verdict.${analysis.verdict}.help`)}
            </span>
          </div>

          <h2 className="mt-2 text-[0.9375rem] font-semibold leading-snug text-ink-900">
            {L(narrative.headline, narrative.headlineAr)}
          </h2>
        </div>

        {/* Indicator row — deliberately no model confidence percentage */}
        <div className="mt-3.5 grid grid-cols-2 divide-x divide-[--hairline] border-y border-[--hairline] rtl:divide-x-reverse sm:grid-cols-4">
          <Indicator
            label={t("case.policyCoverage")}
            value={t(`case.coverage.${analysis.policyCoverage}`)}
            tone={analysis.policyCoverage === "complete" ? "neutral" : "warn"}
          />
          <Indicator
            label={t("case.evidenceCompleteness")}
            value={t("case.evidenceOf", {
              present: analysis.evidence.presentCount,
              required: analysis.evidence.requiredCount,
            })}
            tone={analysis.evidence.missing.length === 0 ? "neutral" : "warn"}
          />
          <Indicator
            label={t("risk.label")}
            value={t(`risk.${analysis.riskLevel}`)}
            tone={
              analysis.riskLevel === "high"
                ? "danger"
                : analysis.riskLevel === "medium"
                  ? "warn"
                  : "neutral"
            }
          />
          <Indicator
            label={t("case.humanReview")}
            value={
              analysis.humanReviewRequired
                ? t("case.humanReviewRequired")
                : t("case.humanReviewNotRequired")
            }
            tone={analysis.humanReviewRequired ? "warn" : "neutral"}
          />
        </div>

        <div className="px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="label">{t("case.explanation")}</p>
            <div className="flex items-center gap-0.5">
              {(["en", "ar"] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setExplanationLocale(value)}
                  aria-pressed={explanationLocale === value}
                  className={cn(
                    "rounded-[0.1875rem] px-1.5 py-0.5 text-[0.6875rem] transition-colors",
                    explanationLocale === value
                      ? "bg-ink-100 font-medium text-ink-900"
                      : "text-ink-500 hover:text-ink-900",
                  )}
                >
                  {value === "en" ? "English" : "العربية"}
                </button>
              ))}
            </div>
          </div>

          <p
            key={explanationLocale}
            dir={explanationLocale === "ar" ? "rtl" : "ltr"}
            className="mt-2 text-[0.875rem] leading-[1.7] text-ink-800"
          >
            {explanationLocale === "ar" ? narrative.explanationAr : narrative.explanation}
          </p>

          {analysis.uncertainty ? (
            <div className="mt-3 border-s-2 border-flag-600 ps-3">
              <p className="label text-flag-700">{t("case.uncertainty")}</p>
              <p className="mt-0.5 text-[0.75rem] leading-relaxed text-ink-700">
                {L(analysis.uncertainty, analysis.uncertaintyAr ?? analysis.uncertainty)}
              </p>
            </div>
          ) : null}

          <p className="mt-3 text-[0.6875rem] leading-relaxed text-ink-400">{t("case.aiNotice")}</p>
        </div>
      </Panel>

      {/* Findings — what each clause actually observed */}
      <Panel className="p-4">
        <SectionHeading
          title={t("case.findings")}
          hint={analysis.findings.map((f) => f.clauseId).join(" · ")}
        />
        <ul className="mt-2 divide-y divide-[--hairline]">
          {analysis.findings.map((finding) => {
            const open = isOpen(finding);
            return (
              <li key={finding.clauseId} className="py-3 first:pt-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <Link
                    href={`/policy?clause=${finding.clauseId}`}
                    className="numeric font-mono text-[0.75rem] text-accent-600 underline-offset-2 hover:underline"
                  >
                    {finding.clauseId}
                  </Link>
                  <span
                    className={cn(
                      "text-[0.6875rem] font-medium",
                      finding.outcome === "breach"
                        ? "text-escalate-700"
                        : open
                          ? "text-flag-700"
                          : "text-ink-500",
                    )}
                  >
                    {finding.outcome === "breach"
                      ? t("common.breach")
                      : open
                        ? t("common.attention")
                        : t("common.satisfied")}
                  </span>
                </div>
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-800">
                  {L(finding.detail, finding.detailAr)}
                </p>
                {finding.figures.length > 0 ? (
                  <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                    {finding.figures.map((figure) => (
                      <div key={figure.label} className="flex items-baseline gap-1.5">
                        <dt className="text-[0.6875rem] text-ink-500">
                          {L(figure.label, figure.labelAr)}
                        </dt>
                        <dd className="numeric text-[0.6875rem] font-medium text-ink-900">
                          {figure.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Panel>

      {/* Evidence — every required item, with its state */}
      <Panel className="p-4">
        <SectionHeading
          title={t("case.evidenceUsed")}
          hint={t("case.evidenceOf", {
            present: analysis.evidence.presentCount,
            required: analysis.evidence.requiredCount,
          })}
        />
        <ul className="mt-3 space-y-1.5">
          {analysis.evidence.required.map((kind) => {
            const item = transaction.evidence.find((e) => e.kind === kind);
            const state = item?.state ?? "missing";
            return (
              <li key={kind} className="flex items-baseline gap-2 text-[0.8125rem]">
                <span
                  className={cn(
                    "w-3 shrink-0 text-[0.75rem]",
                    state === "present"
                      ? "text-pass-600"
                      : state === "self_reported"
                        ? "text-flag-600"
                        : "text-escalate-600",
                  )}
                >
                  {state === "present" ? "✓" : state === "self_reported" ? "~" : "✕"}
                </span>
                <span className="min-w-0 flex-1 text-ink-800">
                  {item ? L(item.label, item.labelAr) : evidenceLabel(kind, locale)}
                  {state === "self_reported" ? (
                    <span className="ms-2 text-[0.6875rem] text-flag-700">
                      {t("case.selfReported")}
                    </span>
                  ) : null}
                  {state === "missing" ? (
                    <span className="ms-2 text-[0.6875rem] text-escalate-700">
                      {t("case.evidenceMissing")}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>

      {transaction.related.length > 0 ? (
        <Panel className="p-4">
          <SectionHeading title={t("case.relatedTransactions")} />
          <ul className="mt-2 divide-y divide-[--hairline]">
            {transaction.related.map((link) => (
              <li key={link.transactionId} className="py-2">
                <Link href={`/transactions/${link.transactionId}`} className="group block">
                  <span className="numeric font-mono text-[0.75rem] text-accent-600 group-hover:underline">
                    {link.transactionId}
                  </span>
                  <span className="mt-0.5 block text-[0.75rem] leading-relaxed text-ink-700">
                    {L(link.reason, link.reasonAr)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel className="p-4">
        <SectionHeading
          title={t("case.budgetImpact")}
          hint={L(record.department.name, record.department.nameAr)}
        />
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          <Figure label={t("common.spent")} value={money(budget.spentAed)} />
          <Figure label={t("common.committed")} value={money(budget.committedAed)} />
          <Figure label={t("common.budget")} value={money(budget.monthlyBudgetAed)} />
          <Figure
            label={t("common.variance")}
            value={`${budget.forecastVarianceAed >= 0 ? "+" : ""}${money(budget.forecastVarianceAed)}`}
            tone={budget.wouldExceedBudget ? "danger" : "neutral"}
          />
        </dl>
        <div className="mt-3">
          <Meter
            value={budget.forecastAed / budget.monthlyBudgetAed}
            tone={budget.wouldExceedBudget ? "danger" : "accent"}
          />
          <p className="mt-2 text-[0.75rem] leading-relaxed text-ink-600">
            {t("common.forecast")} {money(budget.forecastAed)} (
            {formatPercent(budget.forecastAed / budget.monthlyBudgetAed, locale)}) —{" "}
            {budget.wouldExceedBudget ? t("overview.forecastOver") : t("overview.forecastUnder")}
          </p>
        </div>
      </Panel>
    </div>
  );
}

function Indicator({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "warn" | "danger";
}) {
  return (
    <div className="px-4 py-2.5">
      <p className="label">{label}</p>
      <p
        className={cn(
          "mt-1 text-[0.8125rem] font-medium",
          tone === "neutral" && "text-ink-900",
          tone === "warn" && "text-flag-700",
          tone === "danger" && "text-escalate-700",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Figure({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "danger";
}) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd
        className={cn(
          "numeric mt-0.5 text-[0.8125rem] font-medium",
          tone === "neutral" ? "text-ink-900" : "text-escalate-700",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
