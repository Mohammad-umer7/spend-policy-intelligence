"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  GitCompareArrows,
  Info,
  Languages,
  ShieldQuestion,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import type { CaseRecord } from "@/lib/types";
import { formatAed, formatDateTime, formatPercent } from "@/lib/format";
import { evidenceLabel } from "@/lib/engine/evidence";
import { isOpen } from "@/lib/engine/rules";
import { useAppliedOnce } from "@/lib/hooks/use-applied-once";
import { useLocale, useLocalised, useT } from "@/lib/store/hooks";
import { Chip, Meter, Panel, SectionHeading, VerdictBadge } from "@/components/ui/primitives";

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

  const verdictAccent =
    analysis.verdict === "escalate"
      ? "from-escalate-500/18"
      : analysis.verdict === "flag"
        ? "from-flag-500/16"
        : "from-pass-500/14";

  return (
    <div className="space-y-3">
      {/* Verdict */}
      <Panel className="overflow-hidden">
        <div className={cn("bg-gradient-to-b to-transparent px-4 pb-4 pt-4", verdictAccent)}>
          <div className="flex flex-wrap items-center gap-2">
            <VerdictBadge
              verdict={analysis.verdict}
              label={t(`verdict.${analysis.verdict}`)}
              size="lg"
            />
            <span className="text-[0.6875rem] text-mist-400">
              {t(`verdict.${analysis.verdict}.help`)}
            </span>
          </div>

          <h2 className="mt-3 text-base font-semibold leading-snug text-mist-50">
            {L(narrative.headline, narrative.headlineAr)}
          </h2>

          {/* Indicator row — deliberately no model confidence percentage */}
          <div className="mt-3.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Indicator
              label={t("case.policyCoverage")}
              value={t(`case.coverage.${analysis.policyCoverage}`)}
              tone={analysis.policyCoverage === "complete" ? "good" : "warn"}
            />
            <Indicator
              label={t("case.evidenceCompleteness")}
              value={t("case.evidenceOf", {
                present: analysis.evidence.presentCount,
                required: analysis.evidence.requiredCount,
              })}
              tone={analysis.evidence.missing.length === 0 ? "good" : "warn"}
            />
            <Indicator
              label={t("risk.label")}
              value={t(`risk.${analysis.riskLevel}`)}
              tone={
                analysis.riskLevel === "high"
                  ? "danger"
                  : analysis.riskLevel === "medium"
                    ? "warn"
                    : "good"
              }
            />
            <Indicator
              label={t("case.humanReview")}
              value={
                analysis.humanReviewRequired
                  ? t("case.humanReviewRequired")
                  : t("case.humanReviewNotRequired")
              }
              tone={analysis.humanReviewRequired ? "warn" : "good"}
            />
          </div>
        </div>

        {/* Explanation with its own language switch */}
        <div className="hairline-t px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[0.6875rem] uppercase tracking-wide text-mist-500">
              {t("case.explanation")}
            </p>
            <div className="flex items-center gap-1 rounded-lg border border-white/8 bg-white/3 p-0.5">
              {(["en", "ar"] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setExplanationLocale(value)}
                  className={cn(
                    "relative rounded-md px-2 py-1 text-[0.6875rem] transition-colors",
                    explanationLocale === value
                      ? "text-mist-50"
                      : "text-mist-400 hover:text-mist-100",
                  )}
                >
                  {explanationLocale === value ? (
                    <motion.span
                      layoutId={`explain-lang-${record.transaction.id}`}
                      className="absolute inset-0 -z-10 rounded-md border border-white/12 bg-white/8"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  ) : null}
                  <span className="inline-flex items-center gap-1">
                    <Languages className="h-3 w-3" />
                    {value === "en" ? "English" : "العربية"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <p
            key={explanationLocale}
            dir={explanationLocale === "ar" ? "rtl" : "ltr"}
            className={cn(
              "mt-2.5 text-[0.875rem] leading-[1.75] text-mist-100",
              explanationLocale === "ar" && "font-[family-name:var(--font-noto-kufi)]",
            )}
          >
            {explanationLocale === "ar" ? narrative.explanationAr : narrative.explanation}
          </p>

          {analysis.uncertainty ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-flag-500/20 bg-flag-500/8 px-3 py-2.5">
              <ShieldQuestion className="mt-0.5 h-3.5 w-3.5 shrink-0 text-flag-400" />
              <div>
                <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-flag-400">
                  {t("case.uncertainty")}
                </p>
                <p className="mt-0.5 text-[0.75rem] leading-relaxed text-mist-300">
                  {L(analysis.uncertainty, analysis.uncertaintyAr ?? analysis.uncertainty)}
                </p>
              </div>
            </div>
          ) : null}

          <p className="mt-3 flex items-start gap-1.5 text-[0.6875rem] leading-relaxed text-mist-500">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            {t("case.aiNotice")}
          </p>
        </div>
      </Panel>

      {/* Findings — what each clause actually observed */}
      <Panel className="p-4">
        <SectionHeading
          title={t("case.findings")}
          hint={analysis.findings.map((f) => f.clauseId).join(" · ")}
        />
        <div className="mt-3 space-y-2">
          {analysis.findings.map((finding) => {
            const open = isOpen(finding);
            return (
              <div
                key={finding.clauseId}
                className={cn(
                  "rounded-lg border px-3 py-2.5",
                  open
                    ? finding.outcome === "breach"
                      ? "border-escalate-500/25 bg-escalate-500/6"
                      : "border-flag-500/25 bg-flag-500/6"
                    : "border-white/8 bg-white/3",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/policy?clause=${finding.clauseId}`}
                    className="numeric rounded border border-white/12 bg-white/5 px-1.5 py-0.5 font-mono text-[0.6875rem] text-mist-200 transition-colors hover:border-white/25 hover:text-mist-50"
                  >
                    {finding.clauseId}
                  </Link>
                  <Chip
                    tone={
                      finding.outcome === "breach"
                        ? "danger"
                        : open
                          ? "warn"
                          : "good"
                    }
                  >
                    {finding.outcome === "breach"
                      ? t("common.breach")
                      : open
                        ? t("common.attention")
                        : t("common.satisfied")}
                  </Chip>
                </div>
                <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-mist-200">
                  {L(finding.detail, finding.detailAr)}
                </p>
                {finding.figures.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {finding.figures.map((figure) => (
                      <span
                        key={figure.label}
                        className="inline-flex items-center gap-1.5 rounded border border-white/8 bg-white/4 px-1.5 py-0.5 text-[0.6875rem]"
                      >
                        <span className="text-mist-500">{L(figure.label, figure.labelAr)}</span>
                        <span className="numeric text-mist-100">{figure.value}</span>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Evidence checklist — every required item, with its state */}
      <Panel className="p-4">
        <SectionHeading
          title={t("case.evidenceUsed")}
          hint={t("case.evidenceOf", {
            present: analysis.evidence.presentCount,
            required: analysis.evidence.requiredCount,
          })}
        />
        <div className="mt-3">
          <Meter
            value={analysis.evidence.completeness}
            tone={analysis.evidence.missing.length === 0 ? "good" : "warn"}
          />
        </div>
        <ul className="mt-3 space-y-1.5">
          {analysis.evidence.required.map((kind) => {
            const item = transaction.evidence.find((e) => e.kind === kind);
            const state = item?.state ?? "missing";
            const Icon =
              state === "present"
                ? CheckCircle2
                : state === "self_reported"
                  ? CircleDashed
                  : AlertCircle;
            return (
              <li key={kind} className="flex items-start gap-2 text-[0.8125rem]">
                <Icon
                  className={cn(
                    "mt-0.5 h-3.5 w-3.5 shrink-0",
                    state === "present"
                      ? "text-pass-400"
                      : state === "self_reported"
                        ? "text-flag-400"
                        : "text-escalate-400",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="text-mist-200">
                    {item ? L(item.label, item.labelAr) : evidenceLabel(kind, locale)}
                  </span>
                  {state === "self_reported" ? (
                    <span className="ms-2 rounded border border-flag-500/25 bg-flag-500/10 px-1.5 py-0.5 text-[0.625rem] text-flag-400">
                      {t("case.selfReported")}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>

        {/* The gaps, called out separately so they are impossible to miss */}
        <div className="mt-3 rounded-lg border border-white/8 bg-ink-900/60 px-3 py-2.5">
          <p className="text-[0.625rem] uppercase tracking-wide text-mist-500">
            {t("case.evidenceMissing")}
          </p>
          {analysis.evidence.missing.length === 0 ? (
            <p className="mt-1 text-[0.8125rem] text-pass-400">{t("case.evidenceComplete")}</p>
          ) : (
            <ul className="mt-1.5 space-y-1">
              {analysis.evidence.missing.map((kind) => {
                const item = transaction.evidence.find((e) => e.kind === kind);
                return (
                  <li key={kind} className="flex gap-2 text-[0.8125rem] text-mist-200">
                    <span className="text-escalate-400">•</span>
                    {item ? L(item.label, item.labelAr) : evidenceLabel(kind, locale)}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Panel>

      {/* Related transactions */}
      {transaction.related.length > 0 ? (
        <Panel className="p-4">
          <SectionHeading title={t("case.relatedTransactions")} />
          <div className="mt-3 space-y-2">
            {transaction.related.map((link) => (
              <Link
                key={link.transactionId}
                href={`/transactions/${link.transactionId}`}
                className="flex items-start gap-2.5 rounded-lg border border-white/8 bg-white/3 px-3 py-2.5 transition-colors hover:border-white/18 hover:bg-white/6"
              >
                <GitCompareArrows className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info-400" />
                <span className="min-w-0 flex-1">
                  <span className="numeric block font-mono text-[0.75rem] text-info-400">
                    {link.transactionId}
                  </span>
                  <span className="mt-0.5 block text-[0.75rem] leading-relaxed text-mist-300">
                    {L(link.reason, link.reasonAr)}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </Panel>
      ) : null}

      {/* Budget impact */}
      <Panel className="p-4">
        <SectionHeading
          title={t("case.budgetImpact")}
          hint={L(record.department.name, record.department.nameAr)}
        />
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Figure label={t("common.spent")} value={money(budget.spentAed)} />
          <Figure label={t("common.committed")} value={money(budget.committedAed)} />
          <Figure label={t("common.budget")} value={money(budget.monthlyBudgetAed)} />
          <Figure
            label={t("common.variance")}
            value={`${budget.forecastVarianceAed >= 0 ? "+" : ""}${money(budget.forecastVarianceAed)}`}
            tone={budget.wouldExceedBudget ? "danger" : "good"}
          />
        </div>
        <div className="mt-3">
          <Meter
            value={budget.forecastAed / budget.monthlyBudgetAed}
            tone={budget.wouldExceedBudget ? "danger" : "accent"}
          />
          <p className="mt-2 text-[0.75rem] leading-relaxed text-mist-400">
            {t("common.forecast")} {money(budget.forecastAed)} ({formatPercent(
              budget.forecastAed / budget.monthlyBudgetAed,
              locale,
            )}
            ) — {budget.wouldExceedBudget ? t("overview.forecastOver") : t("overview.forecastUnder")}
          </p>
        </div>
      </Panel>

      {/* Context timeline */}
      <Panel className="p-4">
        <SectionHeading title={t("case.timeline")} />
        <ol className="mt-3 space-y-3">
          {buildTimeline(record).map((entry, index) => (
            <li key={index} className="relative flex gap-3 ps-1">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400" />
              <div className="min-w-0 flex-1 pb-0.5">
                <p className="text-[0.8125rem] leading-snug text-mist-200">
                  {L(entry.label, entry.labelAr)}
                </p>
                <p className="numeric mt-0.5 text-[0.6875rem] text-mist-500">
                  {formatDateTime(entry.at, locale)}
                </p>
              </div>
            </li>
          ))}
        </ol>
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
  tone: "good" | "warn" | "danger";
}) {
  return (
    <div className="rounded-lg border border-white/8 bg-ink-900/50 px-2.5 py-2">
      <p className="text-[0.625rem] uppercase leading-tight tracking-wide text-mist-500">{label}</p>
      <p
        className={cn(
          "mt-1 text-[0.8125rem] font-medium",
          tone === "good" && "text-pass-400",
          tone === "warn" && "text-flag-400",
          tone === "danger" && "text-escalate-400",
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
  tone?: "neutral" | "good" | "danger";
}) {
  return (
    <div>
      <p className="text-[0.625rem] uppercase tracking-wide text-mist-500">{label}</p>
      <p
        className={cn(
          "numeric mt-1 text-[0.875rem] font-medium",
          tone === "neutral" && "text-mist-100",
          tone === "good" && "text-pass-400",
          tone === "danger" && "text-escalate-400",
        )}
      >
        {value}
      </p>
    </div>
  );
}

interface TimelineEntry {
  at: string;
  label: string;
  labelAr: string;
}

/** Assembles the case history from the records already attached to it. */
function buildTimeline(record: CaseRecord): TimelineEntry[] {
  const { transaction, analysis } = record;
  const entries: TimelineEntry[] = [];

  if (transaction.approval) {
    entries.push({
      at: transaction.approval.approvedAt,
      label: `${transaction.approval.scope} — ${transaction.approval.approver}`,
      labelAr: `${transaction.approval.scopeAr} — ${transaction.approval.approver}`,
    });
  }

  entries.push({
    at: transaction.occurredAt,
    label: `Transaction settled at ${transaction.merchant}`,
    labelAr: `تمت تسوية المعاملة لدى ${transaction.merchantAr}`,
  });

  if (transaction.receipt) {
    entries.push({
      at: transaction.receipt.uploadedAt,
      label: `Receipt ${transaction.receipt.reference} uploaded`,
      labelAr: `تم رفع الإيصال ${transaction.receipt.reference}`,
    });
  }

  const engineAt = new Date(Date.parse(transaction.occurredAt) + 4 * 60_000).toISOString();
  entries.push({
    at: engineAt,
    label: `Policy engine evaluated ${analysis.findings.length} clauses — verdict ${analysis.verdict}`,
    labelAr: `قيَّم محرك السياسات ${analysis.findings.length} بنداً — الحكم ${analysis.verdict}`,
  });

  if (record.decision) {
    entries.push({
      at: record.decision.decidedAt,
      label: `${record.decision.reviewer} recorded a decision`,
      labelAr: `سجّل ${record.decision.reviewer} قراراً`,
    });
  }

  // Timestamps mix Gulf offsets with UTC, so compare parsed instants — a
  // lexical compare would put 14:46Z before 18:42+04:00.
  return entries.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}
