"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, Lock, Search, ShieldCheck, Upload } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { clauseCategoryLabels, policy } from "@/lib/data/policy";
import { formatDate, formatDateTime } from "@/lib/format";
import { seededPrecedent, suggestPrecedents } from "@/lib/engine/precedents";
import { useAppliedOnce } from "@/lib/hooks/use-applied-once";
import { useAppStore } from "@/lib/store/app-store";
import { useCases, useLocale, useLocalised, useT } from "@/lib/store/hooks";
import {
  Button,
  Chip,
  Meter,
  Panel,
  SectionHeading,
  VerdictBadge,
} from "@/components/ui/primitives";
import type { ClauseCategory, SuggestedPrecedent } from "@/lib/types";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const ingestionSteps: TranslationKey[] = [
  "policy.step.upload",
  "policy.step.extract",
  "policy.step.identify",
  "policy.step.structure",
  "policy.step.validate",
  "policy.step.review",
  "policy.step.publish",
];

export function PolicyClient() {
  const t = useT();
  const locale = useLocale();
  const L = useLocalised();
  const cases = useCases();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ClauseCategory | "all">("all");
  const [selectedId, setSelectedId] = useState(policy.clauses[0].id);

  // Citations elsewhere in the product link straight to a clause.
  const urlClause = searchParams.get("clause");
  useAppliedOnce(urlClause ?? "", () => {
    if (urlClause && policy.clauses.some((c) => c.id === urlClause)) {
      setSelectedId(urlClause);
    }
  });

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

  const clausesExercised = policy.clauses.filter((c) => (usage.get(c.id) ?? 0) > 0).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-mist-50">{t("policy.title")}</h1>
        <p className="mt-1 text-xs text-mist-400">{t("policy.subtitle")}</p>
      </div>

      {/* Document header */}
      <Panel variant="glass" className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[0.6875rem] uppercase tracking-wide text-mist-500">
              {t("policy.document")}
            </p>
            <p className="mt-1 text-[0.9375rem] font-semibold text-mist-50">
              {policy.documentName}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <Meta label={t("policy.version")} value={policy.version} />
            <Meta label={t("policy.effective")} value={formatDate(policy.effectiveFrom, locale)} />
            <Meta label={t("policy.owner")} value={policy.owner} />
            <Meta label={t("policy.updated")} value={formatDate(policy.lastUpdatedAt, locale)} />
          </div>
          <Chip tone="good">
            <ShieldCheck className="h-3 w-3" />
            {t("policy.published")}
          </Chip>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="text-[0.6875rem] uppercase tracking-wide text-mist-500">
              {t("policy.coverage")}
            </p>
            <p className="mt-1.5 text-[0.8125rem] text-mist-200">
              <span className="numeric font-medium text-mist-50">
                {clausesExercised}/{policy.clauses.length}
              </span>{" "}
              {t("policy.clausesCovered")}
            </p>
            <div className="mt-2">
              <Meter value={clausesExercised / policy.clauses.length} tone="accent" />
            </div>
          </div>
          <IngestionSimulator />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        {/* Clause browser */}
        <Panel className="lg:col-span-5 xl:col-span-4">
          <div className="hairline-b space-y-2 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mist-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("policy.search")}
                aria-label={t("policy.search")}
                className="h-9 w-full rounded-lg border border-white/10 bg-white/4 ps-8 pe-3 text-[0.8125rem] text-mist-100 placeholder:text-mist-500 focus:border-white/20 focus:outline-none"
              />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ClauseCategory | "all")}
              aria-label={t("policy.categories")}
              className="h-9 w-full rounded-lg border border-white/10 bg-white/4 px-2.5 text-[0.75rem] text-mist-200 focus:border-white/20 focus:outline-none"
            >
              <option value="all" className="bg-ink-850">
                {t("policy.allCategories")}
              </option>
              {Object.entries(clauseCategoryLabels).map(([key, value]) => (
                <option key={key} value={key} className="bg-ink-850">
                  {L(value.en, value.ar)}
                </option>
              ))}
            </select>
          </div>

          <div className="max-h-[28rem] overflow-y-auto p-2">
            {clauses.map((clause) => {
              const active = clause.id === selected.id;
              const count = usage.get(clause.id) ?? 0;
              return (
                <button
                  key={clause.id}
                  onClick={() => setSelectedId(clause.id)}
                  className={cn(
                    "relative mb-1 flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-start transition-colors",
                    active ? "text-mist-50" : "text-mist-300 hover:bg-white/4",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="clause-active"
                      className="absolute inset-0 -z-10 rounded-lg border border-white/12 bg-white/8"
                      transition={{ type: "spring", stiffness: 400, damping: 34 }}
                    />
                  ) : null}
                  <span className="numeric mt-0.5 shrink-0 rounded border border-white/12 bg-white/5 px-1.5 py-0.5 font-mono text-[0.625rem]">
                    {clause.id}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.8125rem]">
                      {L(clause.title, clause.titleAr)}
                    </span>
                    <span className="mt-0.5 block truncate text-[0.625rem] text-mist-500">
                      {L(
                        clauseCategoryLabels[clause.category].en,
                        clauseCategoryLabels[clause.category].ar,
                      )}
                    </span>
                  </span>
                  {count > 0 ? (
                    <span className="numeric mt-0.5 shrink-0 rounded bg-white/8 px-1.5 py-0.5 text-[0.625rem] text-mist-400">
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
            {clauses.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-mist-500">
                {t("queue.empty.title")}
              </p>
            ) : null}
          </div>
        </Panel>

        {/* Clause detail */}
        <div className="space-y-3 lg:col-span-7 xl:col-span-8">
          <Panel className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="numeric rounded border border-white/12 bg-white/5 px-2 py-0.5 font-mono text-[0.75rem] text-mist-200">
                {selected.id}
              </span>
              <Chip tone="neutral">
                {L(
                  clauseCategoryLabels[selected.category].en,
                  clauseCategoryLabels[selected.category].ar,
                )}
              </Chip>
              <Chip tone="neutral">
                {t("policy.effective")}: {formatDate(selected.effectiveFrom, locale)}
              </Chip>
            </div>
            <h2 className="mt-2.5 text-base font-semibold text-mist-50">
              {L(selected.title, selected.titleAr)}
            </h2>

            {/* Verbatim wording, solid surface, generous leading */}
            <div className="mt-3 rounded-lg border border-white/8 bg-ink-900/70 p-4">
              <p className="text-[0.6875rem] uppercase tracking-wide text-mist-500">
                {t("policy.clauseText")}
              </p>
              <p className="mt-2 text-[0.875rem] leading-[1.8] text-mist-100">
                {L(selected.text, selected.textAr)}
              </p>
            </div>

            {selected.thresholds ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Object.entries(selected.thresholds).map(([key, value]) => (
                  <Chip key={key} tone="info">
                    <span className="text-mist-400">{key}</span>
                    <span className="numeric">{value.toLocaleString("en-AE")}</span>
                  </Chip>
                ))}
              </div>
            ) : null}
          </Panel>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <Panel className="p-4">
              <SectionHeading
                title={t("policy.relatedTransactions")}
                hint={t("overview.acrossTransactions", { count: relatedCases.length })}
              />
              <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto pe-0.5">
                {relatedCases.slice(0, 12).map((record) => (
                  <Link
                    key={record.transaction.id}
                    href={`/transactions/${record.transaction.id}`}
                    className="flex items-center gap-2.5 rounded-lg border border-white/8 bg-white/3 px-3 py-2 transition-colors hover:border-white/18 hover:bg-white/6"
                  >
                    <span className="numeric shrink-0 font-mono text-[0.6875rem] text-mist-400">
                      {record.transaction.id}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[0.75rem] text-mist-200">
                      {L(record.transaction.merchant, record.transaction.merchantAr)}
                    </span>
                    <VerdictBadge
                      verdict={record.analysis.verdict}
                      label={t(`verdict.${record.analysis.verdict}`)}
                    />
                  </Link>
                ))}
                {relatedCases.length === 0 ? (
                  <p className="py-6 text-center text-xs text-mist-500">{t("common.none")}</p>
                ) : null}
              </div>
            </Panel>

            <Panel className="p-4">
              <SectionHeading title={t("policy.interpretations")} />
              {selected.interpretations.length === 0 ? (
                <p className="mt-3 text-[0.8125rem] text-mist-500">
                  {t("policy.noInterpretations")}
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {selected.interpretations.map((interpretation) => (
                    <li
                      key={interpretation.id}
                      className="rounded-lg border border-white/8 bg-white/3 px-3 py-2.5"
                    >
                      <p className="text-[0.8125rem] leading-relaxed text-mist-200">
                        {L(interpretation.summary, interpretation.summaryAr)}
                      </p>
                      <p className="numeric mt-1.5 text-[0.6875rem] text-mist-500">
                        {interpretation.recordedBy} ·{" "}
                        {formatDateTime(interpretation.recordedAt, locale)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <PrecedentPanel />
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.625rem] uppercase tracking-wide text-mist-500">{label}</p>
      <p className="mt-0.5 truncate text-[0.8125rem] text-mist-100">{value}</p>
    </div>
  );
}

/**
 * Simulated policy ingestion. It runs through the same stages a production
 * pipeline would, then stops — a policy is never activated automatically.
 */
function IngestionSimulator() {
  const t = useT();
  const [step, setStep] = useState(-1);
  const [published, setPublished] = useState(false);
  const pushToast = useAppStore((s) => s.pushToast);

  useEffect(() => {
    if (step < 0 || step >= ingestionSteps.length - 1) return;
    const timer = setTimeout(() => setStep((s) => s + 1), 620);
    return () => clearTimeout(timer);
  }, [step]);

  const running = step >= 0 && step < ingestionSteps.length - 1;
  const awaitingPublication = step === ingestionSteps.length - 1 && !published;

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.6875rem] uppercase tracking-wide text-mist-500">
          {t("policy.upload")}
        </p>
        {step < 0 ? (
          <Button size="sm" variant="secondary" onClick={() => setStep(0)} className="gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            {t("policy.uploadStart")}
          </Button>
        ) : null}
      </div>

      <ol className="mt-2.5 flex flex-wrap gap-1.5">
        {ingestionSteps.map((key, index) => {
          const done = step > index || published;
          const active = step === index && running;
          const isPublishStep = index === ingestionSteps.length - 1;
          return (
            <li
              key={key}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[0.625rem] transition-colors",
                done && "border-pass-500/30 bg-pass-500/10 text-pass-400",
                active && "border-info-500/30 bg-info-500/10 text-info-400",
                !done && !active && "border-white/8 bg-white/3 text-mist-500",
                isPublishStep && awaitingPublication && "border-flag-500/30 bg-flag-500/10 text-flag-400",
              )}
            >
              {done ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : active ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : isPublishStep ? (
                <Lock className="h-3 w-3" />
              ) : null}
              {t(key)}
            </li>
          );
        })}
      </ol>

      <AnimatePresence>
        {awaitingPublication ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2.5 rounded-lg border border-flag-500/25 bg-flag-500/8 px-3 py-2.5">
              <p className="text-[0.75rem] leading-relaxed text-mist-200">
                {t("policy.publishNotice")}
              </p>
              <Button
                size="sm"
                variant="primary"
                className="mt-2"
                onClick={() => {
                  setPublished(true);
                  pushToast({
                    tone: "success",
                    title: t("policy.publish"),
                    body: `${policy.documentName} · ${policy.version}`,
                  });
                }}
              >
                {t("policy.publish")}
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {published ? (
        <p className="mt-2 text-[0.75rem] text-pass-400">{t("policy.published")}</p>
      ) : null}
    </div>
  );
}

/** Suggested precedents — proposals only, never auto-applied. */
function PrecedentPanel() {
  const t = useT();
  const L = useLocalised();
  const cases = useCases();
  const decisions = useAppStore((s) => s.decisions);
  const approved = useAppStore((s) => s.approvedPrecedents);
  const declined = useAppStore((s) => s.declinedPrecedents);
  const approve = useAppStore((s) => s.approvePrecedent);
  const decline = useAppStore((s) => s.declinePrecedent);
  const pushToast = useAppStore((s) => s.pushToast);

  const earned = suggestPrecedents(cases, decisions);
  const all: SuggestedPrecedent[] = [seededPrecedent, ...earned].filter(
    (p) => !declined.includes(p.id),
  );

  if (all.length === 0) return null;

  return (
    <Panel className="border-accent-500/20 bg-accent-600/6 p-4">
      <SectionHeading title={t("policy.precedent")} hint={t("policy.precedentNotice")} />
      <div className="mt-3 space-y-2.5">
        {all.map((precedent) => {
          const isApproved = approved.includes(precedent.id);
          return (
            <div
              key={precedent.id}
              className="rounded-lg border border-white/10 bg-ink-900/60 px-3.5 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/policy?clause=${precedent.clauseId}`}
                  className="numeric rounded border border-white/12 bg-white/5 px-1.5 py-0.5 font-mono text-[0.6875rem] text-mist-200 hover:border-white/25"
                >
                  {precedent.clauseId}
                </Link>
                <Chip tone={isApproved ? "good" : "warn"}>
                  {isApproved ? t("policy.published") : t("policy.precedentStatus")}
                </Chip>
                <Chip tone="neutral">
                  {t("policy.observedIn", { count: precedent.observedCount })}
                </Chip>
              </div>

              <p className="mt-2 text-[0.8125rem] leading-relaxed text-mist-200">
                {L(precedent.summary, precedent.summaryAr)}
              </p>
              <p className="mt-2 rounded-md border border-white/8 bg-white/3 px-3 py-2 text-[0.75rem] leading-relaxed text-mist-300">
                {L(precedent.proposedInterpretation, precedent.proposedInterpretationAr)}
              </p>

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {precedent.supportingTransactionIds.map((id) => (
                  <Link
                    key={id}
                    href={`/transactions/${id}`}
                    className="numeric font-mono text-[0.6875rem] text-info-400 underline-offset-2 hover:underline"
                  >
                    {id}
                  </Link>
                ))}
              </div>

              {!isApproved ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => {
                      approve(precedent.id);
                      pushToast({
                        tone: "success",
                        title: t("policy.approvePrecedent"),
                        body: precedent.clauseId,
                      });
                    }}
                  >
                    {t("policy.approvePrecedent")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => decline(precedent.id)}>
                    {t("policy.declinePrecedent")}
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
