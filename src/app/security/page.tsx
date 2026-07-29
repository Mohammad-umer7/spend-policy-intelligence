"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookLock,
  Boxes,
  Database,
  EyeOff,
  Fingerprint,
  Gavel,
  Lock,
  ScrollText,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { policy } from "@/lib/data/policy";
import { MOCK_MODEL_VERSION, MOCK_PROMPT_VERSION } from "@/lib/ai/mock";
import { useLocalised, useT } from "@/lib/store/hooks";
import { Chip, Panel, SectionHeading } from "@/components/ui/primitives";
import type { TranslationKey } from "@/lib/i18n/dictionary";

interface PostureRow {
  labelKey: TranslationKey;
  value: string;
  tone: "good" | "info" | "warn";
  icon: LucideIcon;
}

export default function SecurityPage() {
  const t = useT();
  const L = useLocalised();
  const [provider, setProvider] = useState<{ provider: string; model: string; promptVersion: string }>(
    { provider: "mock", model: MOCK_MODEL_VERSION, promptVersion: MOCK_PROMPT_VERSION },
  );

  // The server is the only place that knows whether a key is configured.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/explain")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && !cancelled) setProvider(data);
      })
      .catch(() => {
        /* Mock defaults already displayed. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const posture: PostureRow[] = [
    { labelKey: "security.demoMode", value: t("security.enabled"), tone: "warn", icon: Boxes },
    {
      labelKey: "security.syntheticData",
      value: t("security.enforced"),
      tone: "warn",
      icon: Database,
    },
    {
      labelKey: "security.aiProvider",
      value: provider.provider === "claude" ? "Claude (server-side)" : "Deterministic mock",
      tone: "info",
      icon: Fingerprint,
    },
    {
      labelKey: "security.residency",
      value: "Configurable — single region",
      tone: "info",
      icon: Lock,
    },
    { labelKey: "security.pii", value: t("security.enabled"), tone: "good", icon: EyeOff },
    {
      labelKey: "security.humanReview",
      value: t("security.enforced"),
      tone: "good",
      icon: UserCheck,
    },
    {
      labelKey: "security.modelLogging",
      value: t("security.on"),
      tone: "good",
      icon: ScrollText,
    },
    { labelKey: "security.retention", value: "Configurable — 90 days", tone: "info", icon: Database },
    { labelKey: "security.rbac", value: "Reviewer · Policy owner", tone: "good", icon: Gavel },
    {
      labelKey: "security.promptVersion",
      value: provider.promptVersion,
      tone: "info",
      icon: BookLock,
    },
    { labelKey: "security.modelVersion", value: provider.model, tone: "info", icon: BookLock },
    {
      labelKey: "security.auditLogging",
      value: `${t("security.on")} · ${policy.version}`,
      tone: "good",
      icon: ShieldCheck,
    },
  ];

  const principles = [
    {
      en: "No raw cardholder data is sent to a public model.",
      ar: "لا تُرسل بيانات حاملي البطاقات الخام إلى أي نموذج عام.",
    },
    {
      en: "An open-weight model can run inside the client VPC where residency requires it.",
      ar: "يمكن تشغيل نموذج مفتوح الأوزان داخل الشبكة الخاصة للعميل حيثما تتطلب متطلبات إقامة البيانات ذلك.",
    },
    {
      en: "Encryption at rest and in transit.",
      ar: "التشفير أثناء التخزين وأثناء النقل.",
    },
    { en: "Private networking between services.", ar: "شبكات خاصة بين الخدمات." },
    { en: "Role-based access for reviewers and policy owners.", ar: "وصول قائم على الأدوار للمراجعين ومالكي السياسات." },
    { en: "Complete model-call logging, including prompt and model version.", ar: "تسجيل كامل لاستدعاءات النموذج، بما في ذلك إصدار التوجيه والنموذج." },
    { en: "Human approval before any financial action.", ar: "موافقة بشرية قبل أي إجراء مالي." },
    { en: "Configurable retention, with deletion on request.", ar: "احتفاظ قابل للتهيئة، مع الحذف عند الطلب." },
    { en: "Policy and prompt versioning, recorded against every decision.", ar: "إصدارات السياسة والتوجيه مسجلة على كل قرار." },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-mist-50">{t("security.title")}</h1>
        <p className="mt-1 text-xs text-mist-400">{t("security.subtitle")}</p>
      </div>

      {/* Careful, non-certifying language, stated up front */}
      <Panel className="border-flag-500/22 bg-flag-500/6 p-4">
        <p className="text-[0.8125rem] leading-relaxed text-mist-200">
          {t("security.disclaimer")}
        </p>
      </Panel>

      <Panel className="p-4">
        <SectionHeading title={t("security.posture")} />
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {posture.map((row) => {
            const Icon = row.icon;
            return (
              <div
                key={row.labelKey}
                className="flex items-start gap-2.5 rounded-lg border border-white/8 bg-white/3 px-3 py-2.5"
              >
                <Icon
                  className={cn(
                    "mt-0.5 h-3.5 w-3.5 shrink-0",
                    row.tone === "good" && "text-pass-400",
                    row.tone === "info" && "text-info-400",
                    row.tone === "warn" && "text-flag-400",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[0.6875rem] uppercase tracking-wide text-mist-500">
                    {t(row.labelKey)}
                  </p>
                  <p className="numeric mt-0.5 truncate text-[0.8125rem] text-mist-100">
                    {row.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel className="p-4">
        <SectionHeading
          title={t("security.architecture")}
          hint="Where the boundary sits, and what crosses it."
        />
        <ArchitectureDiagram />
      </Panel>

      <Panel className="p-4">
        <SectionHeading title={t("security.principles")} />
        <ul className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
          {principles.map((principle) => (
            <li
              key={principle.en}
              className="flex items-start gap-2.5 rounded-lg border border-white/8 bg-white/3 px-3 py-2.5"
            >
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pass-400" />
              <span className="text-[0.8125rem] leading-relaxed text-mist-200">
                {L(principle.en, principle.ar)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[0.6875rem] leading-relaxed text-mist-500">
          {t("security.disclaimer")}
        </p>
      </Panel>
    </div>
  );
}

const boundarySteps: { label: string; labelAr: string; icon: LucideIcon; zone: "client" | "processing" | "human" }[] =
  [
    { label: "Client security boundary", labelAr: "حدود أمن العميل", icon: Lock, zone: "client" },
    {
      label: "Tokenisation & PII redaction",
      labelAr: "الترميز وإخفاء البيانات الشخصية",
      icon: EyeOff,
      zone: "client",
    },
    { label: "Deterministic rules engine", labelAr: "محرك القواعد الحتمي", icon: Boxes, zone: "processing" },
    { label: "Policy retrieval", labelAr: "استرجاع السياسة", icon: BookLock, zone: "processing" },
    {
      label: "Private or region-appropriate model",
      labelAr: "نموذج خاص أو مناسب للمنطقة",
      icon: Fingerprint,
      zone: "processing",
    },
    { label: "Human review", labelAr: "المراجعة البشرية", icon: UserCheck, zone: "human" },
    { label: "Approved action", labelAr: "الإجراء المعتمد", icon: ShieldCheck, zone: "human" },
  ];

function ArchitectureDiagram() {
  const L = useLocalised();

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-stretch gap-2">
        {boundarySteps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.label} className="flex items-stretch gap-2">
              <div
                className={cn(
                  "flex min-w-[9.5rem] flex-1 flex-col justify-center rounded-lg border px-3 py-2.5",
                  step.zone === "client" && "border-info-500/25 bg-info-500/8",
                  step.zone === "processing" && "border-accent-500/25 bg-accent-500/8",
                  step.zone === "human" && "border-pass-500/25 bg-pass-500/8",
                )}
              >
                <Icon
                  className={cn(
                    "h-3.5 w-3.5",
                    step.zone === "client" && "text-info-400",
                    step.zone === "processing" && "text-accent-400",
                    step.zone === "human" && "text-pass-400",
                  )}
                />
                <p className="mt-1.5 text-[0.75rem] leading-snug text-mist-100">
                  {L(step.label, step.labelAr)}
                </p>
              </div>
              {index < boundarySteps.length - 1 ? (
                <ArrowRight className="my-auto h-3.5 w-3.5 shrink-0 text-mist-600 rtl:rotate-180" />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[0.6875rem] text-mist-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-info-500/60" />
          Inside the client boundary
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-accent-500/60" />
          Processing layer
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-pass-500/60" />
          Human decision
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Chip tone="info">Raw PAN never leaves the boundary</Chip>
        <Chip tone="info">Tokenised identifiers only</Chip>
        <Chip tone="good">No financial action without a human</Chip>
      </div>
    </div>
  );
}
