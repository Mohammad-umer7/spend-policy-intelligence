"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  CircleSlash,
  FileSignature,
  MessageSquarePlus,
  Send,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";
import type { CaseRecord, ReviewAction } from "@/lib/types";
import { getClause, policy } from "@/lib/data/policy";
import { currentReviewer } from "@/lib/data/company";
import { formatDateTime } from "@/lib/format";
import { NOTE_REQUIRED_ACTIONS, useAppStore } from "@/lib/store/app-store";
import { useLocale, useLocalised, useT } from "@/lib/store/hooks";
import { Button, Chip, Panel, SectionHeading } from "@/components/ui/primitives";
import { Modal, ModalActions } from "@/components/ui/overlays";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const actions: {
  action: ReviewAction;
  labelKey: TranslationKey;
  icon: typeof ShieldCheck;
  variant: "primary" | "secondary" | "danger" | "success";
}[] = [
  { action: "approve_exception", labelKey: "action.approve_exception", icon: ShieldCheck, variant: "success" },
  { action: "request_information", labelKey: "action.request_information", icon: Send, variant: "primary" },
  { action: "escalate", labelKey: "action.escalate", icon: TrendingUp, variant: "secondary" },
  { action: "reject", labelKey: "action.reject", icon: CircleSlash, variant: "danger" },
  { action: "add_note", labelKey: "action.add_note", icon: MessageSquarePlus, variant: "secondary" },
];

export function ReviewPanel({ record }: { record: CaseRecord }) {
  const t = useT();
  const locale = useLocale();
  const L = useLocalised();
  const recordDecision = useAppStore((s) => s.recordDecision);
  const pushToast = useAppStore((s) => s.pushToast);

  const [pending, setPending] = useState<ReviewAction | null>(null);
  const [note, setNote] = useState("");
  const [openClause, setOpenClause] = useState<string | null>(
    record.analysis.citedClauseIds[0] ?? null,
  );

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

  const priorInterpretations = record.analysis.citedClauseIds
    .flatMap((id) => getClause(id)?.interpretations ?? [])
    .filter((interpretation) => interpretation.status === "active");

  return (
    <div className="space-y-3">
      {/* Policy clauses applied */}
      <Panel className="p-4">
        <SectionHeading
          title={t("case.policyClauses")}
          hint={`${policy.documentName} · ${policy.version}`}
        />
        <div className="mt-3 space-y-1.5">
          {record.analysis.citedClauseIds.map((clauseId) => {
            const clause = getClause(clauseId);
            if (!clause) return null;
            const expanded = openClause === clauseId;
            return (
              <div
                key={clauseId}
                className="overflow-hidden rounded-lg border border-white/8 bg-white/3"
              >
                <button
                  onClick={() => setOpenClause(expanded ? null : clauseId)}
                  aria-expanded={expanded}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-start transition-colors hover:bg-white/4"
                >
                  <span className="numeric shrink-0 rounded border border-white/12 bg-white/5 px-1.5 py-0.5 font-mono text-[0.6875rem] text-mist-200">
                    {clause.id}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-mist-100">
                    {L(clause.title, clause.titleAr)}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 text-mist-500 transition-transform",
                      expanded && "rotate-180",
                    )}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {expanded ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {/* Verbatim clause text on a solid surface — never glass */}
                      <div className="hairline-t bg-ink-900/60 px-3 py-3">
                        <p className="text-[0.8125rem] leading-[1.7] text-mist-200">
                          {L(clause.text, clause.textAr)}
                        </p>
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          <Chip tone="neutral">
                            {t("policy.effective")}: {formatDateTime(clause.effectiveFrom, locale)}
                          </Chip>
                          <Link
                            href={`/policy?clause=${clause.id}`}
                            className="text-[0.6875rem] text-info-400 underline-offset-2 hover:underline"
                          >
                            {t("policy.title")}
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Recommended action */}
      <Panel className="border-accent-500/25 bg-accent-600/8 p-4">
        <SectionHeading title={t("case.recommendedAction")} />
        <p className="mt-2.5 text-[0.875rem] font-medium leading-snug text-mist-50">
          {L(record.analysis.recommendedAction.label, record.analysis.recommendedAction.labelAr)}
        </p>
        <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-mist-300">
          {L(record.analysis.recommendedAction.detail, record.analysis.recommendedAction.detailAr)}
        </p>
      </Panel>

      {/* Human review controls */}
      <Panel className="p-4">
        <SectionHeading
          title={t("case.reviewControls")}
          hint={`${L(currentReviewer.name, currentReviewer.nameAr)} · ${L(currentReviewer.role, currentReviewer.roleAr)}`}
        />
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
          {actions.map(({ action, labelKey, icon: Icon, variant }) => (
            <Button
              key={action}
              variant={variant}
              onClick={() => {
                setPending(action);
                setNote("");
              }}
              className="justify-start"
            >
              <Icon className="h-3.5 w-3.5" />
              {t(labelKey)}
            </Button>
          ))}
        </div>

        <div className="mt-3 rounded-lg border border-white/8 bg-white/3 px-3 py-2.5">
          <p className="text-[0.6875rem] uppercase tracking-wide text-mist-500">
            {t("case.currentStatus")}
          </p>
          <p className="mt-1 text-[0.8125rem] text-mist-100">{t(`status.${record.status}`)}</p>
        </div>
      </Panel>

      {/* Reviewer notes */}
      <Panel className="p-4">
        <SectionHeading title={t("case.reviewerNotes")} />
        {record.decision ? (
          <div className="mt-3 rounded-lg border border-white/8 bg-white/3 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="good">{t(`action.${record.decision.action}`)}</Chip>
              <span className="numeric text-[0.6875rem] text-mist-500">
                {formatDateTime(record.decision.decidedAt, locale)}
              </span>
            </div>
            {record.decision.note ? (
              <p className="mt-2 text-[0.8125rem] leading-relaxed text-mist-200">
                {record.decision.note}
              </p>
            ) : null}
            <p className="mt-2 text-[0.6875rem] text-mist-500">
              {t("case.decisionBy")}: {record.decision.reviewer} · {record.decision.reviewerRole}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-[0.8125rem] text-mist-500">{t("common.none")}</p>
        )}
      </Panel>

      {/* Related previous decisions */}
      <Panel className="p-4">
        <SectionHeading title={t("case.priorDecisions")} />
        {priorInterpretations.length === 0 ? (
          <p className="mt-3 text-[0.8125rem] text-mist-500">{t("policy.noInterpretations")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {priorInterpretations.map((interpretation) => (
              <li
                key={interpretation.id}
                className="rounded-lg border border-white/8 bg-white/3 px-3 py-2.5"
              >
                <p className="text-[0.8125rem] leading-relaxed text-mist-200">
                  {L(interpretation.summary, interpretation.summaryAr)}
                </p>
                <p className="numeric mt-1.5 text-[0.6875rem] text-mist-500">
                  {interpretation.recordedBy} · {formatDateTime(interpretation.recordedAt, locale)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Audit information */}
      <Panel className="p-4">
        <SectionHeading title={t("case.auditInfo")} />
        <dl className="mt-3 space-y-2 text-[0.75rem]">
          <AuditRow label={t("policy.version")} value={policy.version} />
          <AuditRow label={t("security.promptVersion")} value={record.analysis.promptVersion} />
          <AuditRow label={t("security.modelVersion")} value={record.analysis.modelVersion} />
          <AuditRow label={t("audit.col.transaction")} value={record.transaction.id} />
        </dl>
        <Link
          href={`/audit?transaction=${record.transaction.id}`}
          className="mt-3 inline-flex items-center gap-1.5 text-[0.75rem] text-info-400 underline-offset-2 hover:underline"
        >
          <FileSignature className="h-3.5 w-3.5" />
          {t("audit.title")}
        </Link>
      </Panel>

      {/* Confirmation modal — every action passes through here */}
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
            confirmVariant={pending === "reject" ? "danger" : "primary"}
            disabled={!canConfirm}
          />
        }
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-white/8 bg-white/3 px-3 py-2.5 text-[0.8125rem]">
            <p className="text-mist-100">
              {record.transaction.id} ·{" "}
              {L(record.transaction.merchant, record.transaction.merchantAr)}
            </p>
            <p className="mt-1 text-[0.75rem] text-mist-400">
              {record.analysis.citedClauseIds.slice(0, 3).join(", ")}
            </p>
          </div>

          <div>
            <label
              htmlFor="reviewer-note"
              className="mb-1.5 block text-[0.6875rem] uppercase tracking-wide text-mist-500"
            >
              {noteRequired ? t("case.noteLabel") : t("case.noteOptional")}
            </label>
            <textarea
              id="reviewer-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder={t("case.notePlaceholder")}
              className="w-full resize-none rounded-lg border border-white/10 bg-ink-950/60 px-3 py-2.5 text-[0.8125rem] leading-relaxed text-mist-100 placeholder:text-mist-600 focus:border-white/25 focus:outline-none"
            />
            {noteRequired && note.trim().length === 0 ? (
              <p className="mt-1.5 text-[0.6875rem] text-flag-400">{t("case.noteRequired")}</p>
            ) : null}
          </div>

          <p className="text-[0.6875rem] leading-relaxed text-mist-500">{t("case.aiNotice")}</p>
        </div>
      </Modal>
    </div>
  );
}

function AuditRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-mist-500">{label}</dt>
      <dd className="numeric truncate font-mono text-[0.6875rem] text-mist-200">{value}</dd>
    </div>
  );
}
