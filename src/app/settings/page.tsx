"use client";

import Link from "next/link";
import { Languages, RotateCcw, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { company, currentReviewer } from "@/lib/data/company";
import { policy } from "@/lib/data/policy";
import { MOCK_MODEL_VERSION, MOCK_PROMPT_VERSION } from "@/lib/ai/mock";
import { useAppStore } from "@/lib/store/app-store";
import { useLocale, useLocalised, useT } from "@/lib/store/hooks";
import { Button, Chip, Panel, SectionHeading } from "@/components/ui/primitives";

export default function SettingsPage() {
  const t = useT();
  const locale = useLocale();
  const L = useLocalised();
  const setLocale = useAppStore((s) => s.setLocale);
  const resetDemo = useAppStore((s) => s.resetDemo);
  const pushToast = useAppStore((s) => s.pushToast);
  const decisions = useAppStore((s) => s.decisions);
  const humanEvents = useAppStore((s) => s.humanAuditEvents);

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-mist-50">{t("nav.settings")}</h1>
        <p className="mt-1 text-xs text-mist-400">{t("security.settings")}</p>
      </div>

      <Panel className="p-4">
        <SectionHeading title={t("security.language")} />
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              { value: "en", label: "English", hint: "Left to right" },
              { value: "ar", label: "العربية", hint: "من اليمين إلى اليسار" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              onClick={() => setLocale(option.value)}
              className={cn(
                "flex min-w-[10rem] items-start gap-2.5 rounded-lg border px-3 py-2.5 text-start transition-colors",
                locale === option.value
                  ? "border-accent-500/40 bg-accent-600/12"
                  : "border-white/10 bg-white/3 hover:border-white/20",
              )}
            >
              <Languages
                className={cn(
                  "mt-0.5 h-3.5 w-3.5 shrink-0",
                  locale === option.value ? "text-accent-400" : "text-mist-500",
                )}
              />
              <span>
                <span className="block text-[0.8125rem] text-mist-100">{option.label}</span>
                <span className="block text-[0.6875rem] text-mist-500">{option.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel className="p-4">
        <SectionHeading title={t("top.company")} />
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <Row label={t("top.company")} value={L(company.name, company.nameAr)} />
          <Row label="Country" value={company.country} />
          <Row label="Locations" value={String(company.locations)} />
          <Row label="Headcount" value={String(company.headcount)} />
          <Row label={t("policy.owner")} value={policy.owner} />
          <Row label={t("policy.version")} value={policy.version} />
        </dl>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip tone="warn">{t("app.demoBadge")}</Chip>
          <Chip tone="neutral">
            {L(currentReviewer.role, currentReviewer.roleAr)} ·{" "}
            {L(currentReviewer.name, currentReviewer.nameAr)}
          </Chip>
        </div>
      </Panel>

      <Panel className="p-4">
        <SectionHeading title={t("security.aiProvider")} />
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <Row label={t("security.promptVersion")} value={MOCK_PROMPT_VERSION} mono />
          <Row label={t("security.modelVersion")} value={MOCK_MODEL_VERSION} mono />
          <Row label={t("security.humanReview")} value={t("security.enforced")} />
        </dl>
        <Link
          href="/security"
          className="mt-3 inline-flex items-center gap-1.5 text-[0.75rem] text-info-400 underline-offset-2 hover:underline"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          {t("security.title")}
        </Link>
      </Panel>

      <Panel className="border-escalate-500/20 bg-escalate-500/5 p-4">
        <SectionHeading title={t("action.reset")} hint={t("security.resetNotice")} />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            variant="danger"
            onClick={() => {
              resetDemo();
              pushToast({ tone: "info", title: t("action.reset") });
            }}
            className="gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t("action.reset")}
          </Button>
          <p className="numeric text-[0.75rem] text-mist-400">
            {Object.keys(decisions).length} decisions · {humanEvents.length} audit events
          </p>
        </div>
      </Panel>

      <p className="text-center text-[0.6875rem] text-mist-600">{t("app.syntheticNotice")}</p>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.625rem] uppercase tracking-wide text-mist-500">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 truncate text-[0.8125rem] text-mist-100",
          mono && "numeric font-mono text-[0.75rem]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
