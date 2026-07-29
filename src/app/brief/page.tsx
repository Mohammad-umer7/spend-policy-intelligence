"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  ClipboardCopy,
  FileWarning,
  ListChecks,
  PiggyBank,
  Store,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { buildDailyBrief, buildSummary, type BriefInsight, type SummaryAudience } from "@/lib/ai/brief";
import { useCases, useLocale, useLocalised, useT } from "@/lib/store/hooks";
import { useAppStore } from "@/lib/store/app-store";
import { Button, Chip, Panel, SectionHeading } from "@/components/ui/primitives";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const audiences: { value: SummaryAudience; labelKey: TranslationKey }[] = [
  { value: "ceo", labelKey: "brief.ceo" },
  { value: "finance", labelKey: "brief.finance" },
  { value: "manager", labelKey: "brief.manager" },
];

export default function BriefPage() {
  const t = useT();
  const locale = useLocale();
  const L = useLocalised();
  const cases = useCases();
  const pushToast = useAppStore((s) => s.pushToast);

  const brief = useMemo(() => buildDailyBrief(cases), [cases]);
  const [audience, setAudience] = useState<SummaryAudience>("ceo");
  const [copied, setCopied] = useState(false);

  const summary = useMemo(
    () => buildSummary(audience, cases, locale),
    [audience, cases, locale],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      pushToast({ tone: "success", title: t("brief.copied") });
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      pushToast({ tone: "warning", title: t("common.error") });
    }
  }

  const sections: { titleKey: TranslationKey; icon: LucideIcon; items: BriefInsight[] }[] = [
    { titleKey: "brief.attention", icon: AlertTriangle, items: brief.attention },
    { titleKey: "brief.budgetRisks", icon: TrendingUp, items: brief.budgetRisks },
    { titleKey: "brief.policyExceptions", icon: ListChecks, items: brief.policyExceptions },
    { titleKey: "brief.missingDocuments", icon: FileWarning, items: brief.missingDocuments },
    { titleKey: "brief.vendorAnomalies", icon: Store, items: brief.vendorObservations },
    { titleKey: "brief.savings", icon: PiggyBank, items: brief.savings },
    { titleKey: "brief.recommended", icon: Check, items: brief.recommendedActions },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-mist-50">{t("brief.title")}</h1>
          <p className="mt-1 text-xs text-mist-400">{t("brief.subtitle")}</p>
        </div>
        <Chip tone="warn">{t("brief.draftNotice")}</Chip>
      </div>

      {/* Headline */}
      <Panel variant="glass" className="p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-accent-500 to-info-500">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </span>
          <span className="text-[0.8125rem] font-semibold text-mist-50">{t("brief.attention")}</span>
        </div>
        <p className="mt-3 max-w-4xl text-[1.0625rem] leading-relaxed text-mist-50">
          {L(brief.headline, brief.headlineAr)}
        </p>
      </Panel>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        {/* Sections */}
        <div className="space-y-3 xl:col-span-2">
          {sections
            .filter((section) => section.items.length > 0)
            .map((section) => {
              const Icon = section.icon;
              return (
                <Panel key={section.titleKey} className="p-4">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-mist-400" />
                    <h2 className="text-[0.875rem] font-semibold text-mist-50">
                      {t(section.titleKey)}
                    </h2>
                    <span className="numeric rounded bg-white/6 px-1.5 py-0.5 text-[0.625rem] text-mist-400">
                      {section.items.length}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    {section.items.map((insight) => (
                      <Link
                        key={insight.id}
                        href={insight.href}
                        className={cn(
                          "block rounded-lg border px-3.5 py-3 transition-colors",
                          insight.severity === "critical"
                            ? "border-escalate-500/22 bg-escalate-500/6 hover:border-escalate-500/40"
                            : insight.severity === "warning"
                              ? "border-flag-500/22 bg-flag-500/6 hover:border-flag-500/40"
                              : "border-white/8 bg-white/3 hover:border-white/20",
                        )}
                      >
                        <p className="text-[0.875rem] font-medium leading-snug text-mist-50">
                          {L(insight.title, insight.titleAr)}
                        </p>
                        <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-mist-300">
                          {L(insight.body, insight.bodyAr)}
                        </p>

                        {insight.transactionIds.length > 0 || insight.clauseIds.length > 0 ? (
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            <span className="text-[0.625rem] uppercase tracking-wide text-mist-500">
                              {t("brief.supporting")}
                            </span>
                            {insight.transactionIds.slice(0, 4).map((id) => (
                              <span
                                key={id}
                                className="numeric rounded border border-info-500/25 bg-info-500/10 px-1.5 py-0.5 font-mono text-[0.625rem] text-info-400"
                              >
                                {id}
                              </span>
                            ))}
                            {insight.clauseIds.slice(0, 3).map((id) => (
                              <span
                                key={id}
                                className="rounded border border-white/10 bg-white/4 px-1.5 py-0.5 font-mono text-[0.625rem] text-mist-400"
                              >
                                {id}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                </Panel>
              );
            })}
        </div>

        {/* Summary generator */}
        <div className="xl:col-span-1">
          <Panel className="sticky top-20 p-4">
            <SectionHeading title={t("brief.generate")} hint={t("brief.draftNotice")} />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {audiences.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setAudience(option.value)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-[0.75rem] transition-colors",
                    audience === option.value
                      ? "border-white/22 bg-white/10 text-mist-50"
                      : "border-white/10 bg-white/3 text-mist-400 hover:text-mist-100",
                  )}
                >
                  {t(option.labelKey)}
                </button>
              ))}
            </div>

            <pre className="mt-3 max-h-[26rem] overflow-auto whitespace-pre-wrap rounded-lg border border-white/8 bg-ink-950/60 p-3.5 font-sans text-[0.8125rem] leading-relaxed text-mist-200">
              {summary}
            </pre>

            <Button variant="secondary" size="sm" className="mt-3 w-full gap-1.5" onClick={copy}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
              {copied ? t("brief.copied") : t("brief.copy")}
            </Button>
          </Panel>
        </div>
      </div>
    </div>
  );
}
