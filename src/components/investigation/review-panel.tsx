"use client";

import { useState } from "react";
import Link from "next/link";
import type { CaseRecord, ReviewAction } from "@/lib/types";
import { getClause, policy } from "@/lib/data/policy";
import { currentReviewer } from "@/lib/data/company";
import { formatDateTime } from "@/lib/format";
import { NOTE_REQUIRED_ACTIONS, useAppStore } from "@/lib/store/app-store";
import { useLocale, useLocalised, useT } from "@/lib/store/hooks";
import { Button, Panel, SectionHeading } from "@/components/ui/primitives";
import { Modal, ModalActions } from "@/components/ui/overlays";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const actions: { action: ReviewAction; labelKey: TranslationKey }[] = [
  { action: "approve_exception", labelKey: "action.approve_exception" },
  { action: "request_information", labelKey: "action.request_information" },
  { action: "escalate", labelKey: "action.escalate" },
  { action: "reject", labelKey: "action.reject" },
];

export function ReviewPanel({ record }: { record: CaseRecord }) {
  const t = useT();
  const locale = useLocale();
  const L = useLocalised();
  const recordDecision = useAppStore((s) => s.recordDecision);
  const pushToast = useAppStore((s) => s.pushToast);

  const [pending, setPending] = useState<ReviewAction | null>(null);
  const [note, setNote] = useState("");

  const noteRequired = pending ? NOTE_REQUIRED_ACTIONS.includes(pending) : false;
  const canConfirm = pending !== null && (!noteRequired || note.trim().length > 0);

  function confirm() {
    if (!pending || !canConfirm) return;
    recordDecision({ record, action: pending, note: note.trim() });
    pushToast({
      tone: pending === "reject" ? "warning" : "success",
      title: t("case.decided"),
      body: `${record.transaction.id} · ${t(`action.${pending}`)}`,
    });
    setPending(null);
    setNote("");
  }

  const primaryClause = getClause(record.analysis.citedClauseIds[0] ?? "");
  const otherClauses = record.analysis.citedClauseIds
    .slice(1)
    .map((id) => getClause(id))
    .filter((c) => c !== undefined);

  return (
    <div className="space-y-4">
      {/* The clause the verdict rests on, verbatim. */}
      <Panel className="p-4">
        <SectionHeading
          title={t("case.policyClauses")}
          hint={`${policy.documentName} · ${policy.version}`}
        />
        {primaryClause ? (
          <div className="mt-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="numeric font-mono text-[0.75rem] font-medium text-ink-900">
                {primaryClause.id}
              </span>
              <span className="text-[0.8125rem] text-ink-800">
                {L(primaryClause.title, primaryClause.titleAr)}
              </span>
            </div>
            <p className="mt-2 border-s-2 border-[--hairline-strong] ps-3 text-[0.8125rem] leading-[1.7] text-ink-700">
              {L(primaryClause.text, primaryClause.textAr)}
            </p>
            <p className="mt-2 text-[0.6875rem] text-ink-500">
              {t("policy.effective")}: {formatDateTime(primaryClause.effectiveFrom, locale)}
            </p>
          </div>
        ) : null}

        {otherClauses.length > 0 ? (
          <ul className="hairline-t mt-3 flex flex-wrap gap-x-4 gap-y-1 pt-3">
            {otherClauses.map((clause) => (
              <li key={clause.id}>
                <Link
                  href={`/policy?clause=${clause.id}`}
                  className="text-[0.75rem] text-ink-600 underline-offset-2 hover:text-ink-900 hover:underline"
                >
                  <span className="numeric font-mono">{clause.id}</span>{" "}
                  {L(clause.title, clause.titleAr)}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>

      <Panel className="p-4">
        <SectionHeading title={t("case.recommendedAction")} />
        <p className="mt-2 text-[0.875rem] font-medium leading-snug text-ink-900">
          {L(record.analysis.recommendedAction.label, record.analysis.recommendedAction.labelAr)}
        </p>
        <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-700">
          {L(record.analysis.recommendedAction.detail, record.analysis.recommendedAction.detailAr)}
        </p>
      </Panel>

      <Panel className="p-4">
        <SectionHeading
          title={t("case.reviewControls")}
          hint={`${L(currentReviewer.name, currentReviewer.nameAr)} · ${L(currentReviewer.role, currentReviewer.roleAr)}`}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map(({ action, labelKey }, i) => (
            <Button
              key={action}
              variant={i === 0 ? "primary" : "secondary"}
              onClick={() => {
                setPending(action);
                setNote("");
              }}
            >
              {t(labelKey)}
            </Button>
          ))}
        </div>

        <div className="hairline-t mt-4 flex items-baseline justify-between gap-3 pt-3">
          <span className="label">{t("case.currentStatus")}</span>
          <span className="text-[0.8125rem] font-medium text-ink-900">
            {t(`status.${record.status}`)}
          </span>
        </div>

        {record.decision ? (
          <div className="hairline-t mt-3 pt-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[0.8125rem] font-medium text-ink-900">
                {t(`action.${record.decision.action}`)}
              </span>
              <span className="numeric text-[0.6875rem] text-ink-500">
                {formatDateTime(record.decision.decidedAt, locale)}
              </span>
            </div>
            {record.decision.note ? (
              <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-700">
                {record.decision.note}
              </p>
            ) : null}
            <p className="mt-1.5 text-[0.6875rem] text-ink-500">
              {t("case.decisionBy")}: {record.decision.reviewer} · {record.decision.reviewerRole}
            </p>
          </div>
        ) : null}
      </Panel>

      <Panel className="p-4">
        <SectionHeading title={t("case.auditInfo")} />
        <dl className="mt-3 space-y-1.5 text-[0.75rem]">
          <AuditRow label={t("policy.version")} value={policy.version} />
          <AuditRow label={t("security.promptVersion")} value={record.analysis.promptVersion} />
          <AuditRow label={t("security.modelVersion")} value={record.analysis.modelVersion} />
        </dl>
        <Link
          href={`/audit?transaction=${record.transaction.id}`}
          className="mt-3 inline-block text-[0.75rem] text-accent-600 underline-offset-2 hover:underline"
        >
          {t("audit.title")} →
        </Link>
      </Panel>

      {/* Confirmation — every action passes through here */}
      <Modal
        open={pending !== null}
        onClose={() => setPending(null)}
        title={pending ? t(`action.${pending}`) : ""}
        description={
          pending
            ? L(
                record.analysis.recommendedAction.detail,
                record.analysis.recommendedAction.detailAr,
              )
            : undefined
        }
        footer={
          <ModalActions
            onCancel={() => setPending(null)}
            onConfirm={confirm}
            confirmLabel={t("action.confirm")}
            cancelLabel={t("action.cancel")}
            disabled={!canConfirm}
          />
        }
      >
        <div className="space-y-3">
          <div className="text-[0.8125rem]">
            <p className="text-ink-900">
              {record.transaction.id} ·{" "}
              {L(record.transaction.merchant, record.transaction.merchantAr)}
            </p>
            <p className="numeric mt-0.5 font-mono text-[0.75rem] text-ink-500">
              {record.analysis.citedClauseIds.slice(0, 3).join(", ")}
            </p>
          </div>

          <div>
            <label htmlFor="reviewer-note" className="label mb-1.5 block">
              {noteRequired ? t("case.noteLabel") : t("case.noteOptional")}
            </label>
            <textarea
              id="reviewer-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder={t("case.notePlaceholder")}
              className="w-full resize-none rounded-[0.1875rem] border border-[--hairline-strong] bg-white px-3 py-2 text-[0.8125rem] leading-relaxed text-ink-900 placeholder:text-ink-400 focus:border-accent-500 focus:outline-none"
            />
            {noteRequired && note.trim().length === 0 ? (
              <p className="mt-1.5 text-[0.6875rem] text-flag-700">{t("case.noteRequired")}</p>
            ) : null}
          </div>

          <p className="text-[0.6875rem] leading-relaxed text-ink-500">{t("case.aiNotice")}</p>
        </div>
      </Modal>
    </div>
  );
}

function AuditRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-ink-500">{label}</dt>
      <dd className="numeric truncate font-mono text-[0.6875rem] text-ink-800">{value}</dd>
    </div>
  );
}
