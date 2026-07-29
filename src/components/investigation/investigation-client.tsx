"use client";

import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, FileX2, ReceiptText, Stamp } from "lucide-react";
import { formatAed, formatAedPrecise, formatDateTime, formatWeekday } from "@/lib/format";
import { sortForQueue } from "@/lib/engine/queue-filters";
import { useCases, useLocale, useLocalised, useT } from "@/lib/store/hooks";
import {
  Button,
  Chip,
  EmptyState,
  Field,
  Panel,
  SectionHeading,
} from "@/components/ui/primitives";
import { AssessmentColumn } from "./assessment";
import { ReviewPanel } from "./review-panel";

export function InvestigationClient({ transactionId }: { transactionId: string }) {
  const t = useT();
  const locale = useLocale();
  const L = useLocalised();
  const cases = useCases();

  const ordered = sortForQueue(cases);
  const index = ordered.findIndex((c) => c.transaction.id === transactionId);
  const record = index >= 0 ? ordered[index] : undefined;

  if (!record) {
    return (
      <Panel className="mx-auto max-w-lg">
        <EmptyState
          icon={<FileX2 className="h-6 w-6" />}
          title={t("case.notFound")}
          body={t("case.notFoundBody")}
          action={
            <Link href="/queue">
              <Button variant="secondary" size="sm">
                {t("queue.title")}
              </Button>
            </Link>
          }
        />
      </Panel>
    );
  }

  const previous = index > 0 ? ordered[index - 1] : null;
  const next = index < ordered.length - 1 ? ordered[index + 1] : null;
  const { transaction, employee, department } = record;
  const money = (n: number) => formatAed(n, locale);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/queue"
            className="inline-flex items-center gap-1.5 text-[0.75rem] text-mist-400 transition-colors hover:text-mist-100"
          >
            <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
            {t("queue.title")}
          </Link>
          <h1 className="mt-1.5 flex flex-wrap items-center gap-2.5 text-xl font-semibold tracking-tight text-mist-50">
            {t("case.title")}
            <span className="numeric rounded-md border border-white/12 bg-white/5 px-2 py-0.5 font-mono text-[0.75rem] font-normal text-mist-300">
              {transaction.id}
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-1.5">
          {previous ? (
            <Link href={`/transactions/${previous.transaction.id}`}>
              <Button variant="secondary" size="sm" className="gap-1.5">
                <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
                <span className="hidden sm:inline">{t("case.prev")}</span>
              </Button>
            </Link>
          ) : null}
          {next ? (
            <Link href={`/transactions/${next.transaction.id}`}>
              <Button variant="secondary" size="sm" className="gap-1.5">
                <span className="hidden sm:inline">{t("case.next")}</span>
                <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        {/* LEFT — the record itself */}
        <div className="space-y-3 lg:col-span-5 xl:col-span-3">
          <Panel className="p-4">
            <SectionHeading title={t("case.details")} />
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3.5">
              <Field
                label={t("case.merchant")}
                value={L(transaction.merchant, transaction.merchantAr)}
                className="col-span-2"
              />
              <Field label={t("case.amount")} value={money(transaction.amountAed)} mono />
              <Field
                label={t("case.date")}
                value={formatDateTime(transaction.occurredAt, locale)}
                mono
              />
              <Field
                label={t("case.employee")}
                value={L(employee.name, employee.nameAr)}
              />
              <Field label={t("case.department")} value={L(department.name, department.nameAr)} />
              <Field label={t("case.paymentSource")} value={transaction.paymentSource} />
              <Field label={t("case.card")} value={`•••• ${transaction.cardLast4}`} mono />
              <Field label={t("case.location")} value={transaction.location} />
              <Field label="" value={formatWeekday(transaction.occurredAt, locale)} />
              <div className="col-span-2">
                <p className="text-[0.6875rem] uppercase tracking-wide text-mist-500">
                  {L(employee.jobTitle, employee.jobTitleAr)}
                </p>
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-mist-200">
                  {L(transaction.description, transaction.descriptionAr)}
                </p>
              </div>
            </dl>
          </Panel>

          {/* Receipt preview */}
          <Panel className="overflow-hidden">
            <div className="px-4 pt-4">
              <SectionHeading title={t("case.receiptPreview")} />
            </div>
            {transaction.receipt ? (
              <div className="mt-3 px-4 pb-4">
                {/* Rendered as a document, on a light surface, so it reads like paper */}
                <div className="rounded-lg border border-white/10 bg-mist-50 p-4 text-ink-900 shadow-inner">
                  <p className="text-[0.8125rem] font-semibold">
                    {transaction.receipt.merchantOnReceipt}
                  </p>
                  <p className="numeric mt-0.5 font-mono text-[0.6875rem] text-ink-700/70">
                    {transaction.receipt.reference}
                  </p>
                  <div className="my-3 border-t border-dashed border-ink-900/20" />
                  <ul className="space-y-1.5">
                    {transaction.receipt.lines.map((line) => (
                      <li
                        key={line.description}
                        className="flex items-baseline justify-between gap-3 text-[0.75rem]"
                      >
                        <span className="min-w-0 flex-1 text-ink-800/85">
                          {L(line.description, line.descriptionAr)}
                        </span>
                        <span className="numeric shrink-0 font-medium">
                          {formatAedPrecise(line.amountAed, locale)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="my-3 border-t border-dashed border-ink-900/20" />
                  <div className="flex items-baseline justify-between text-[0.75rem] text-ink-700/70">
                    <span>VAT 5%</span>
                    <span className="numeric">
                      {formatAedPrecise(transaction.receipt.vatAed, locale)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between text-[0.875rem] font-semibold">
                    <span>{t("case.amount")}</span>
                    <span className="numeric">
                      {formatAedPrecise(transaction.receipt.totalAed, locale)}
                    </span>
                  </div>
                  {transaction.receipt.mismatch ? (
                    <p className="mt-2 rounded bg-escalate-900/10 px-2 py-1 text-[0.6875rem] text-escalate-500">
                      Receipt total does not reconcile with the settled amount.
                    </p>
                  ) : null}
                </div>
                <p className="numeric mt-2 text-[0.6875rem] text-mist-500">
                  <ReceiptText className="me-1 inline h-3 w-3" />
                  {formatDateTime(transaction.receipt.uploadedAt, locale)}
                </p>
              </div>
            ) : (
              <div className="px-4 pb-4">
                <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-dashed border-escalate-500/30 bg-escalate-500/5 px-3 py-4">
                  <FileX2 className="h-4 w-4 shrink-0 text-escalate-400" />
                  <p className="text-[0.8125rem] text-mist-300">{t("case.noReceipt")}</p>
                </div>
              </div>
            )}
          </Panel>

          {/* Supporting documents */}
          <Panel className="p-4">
            <SectionHeading title={t("case.supportingDocs")} />
            <ul className="mt-3 space-y-1.5">
              {transaction.evidence
                .filter((item) => item.state !== "missing")
                .map((item) => (
                  <li
                    key={item.kind}
                    className="rounded-lg border border-white/8 bg-white/3 px-3 py-2"
                  >
                    <p className="text-[0.8125rem] leading-snug text-mist-200">
                      {L(item.label, item.labelAr)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {item.reference ? (
                        <span className="numeric font-mono text-[0.6875rem] text-mist-500">
                          {item.reference}
                        </span>
                      ) : null}
                      {item.state === "self_reported" ? (
                        <Chip tone="warn">{t("case.selfReported")}</Chip>
                      ) : null}
                    </div>
                  </li>
                ))}
            </ul>
          </Panel>

          {/* Approval history */}
          <Panel className="p-4">
            <SectionHeading title={t("case.approvalHistory")} />
            {transaction.approval ? (
              <div className="mt-3 rounded-lg border border-pass-500/20 bg-pass-500/6 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Stamp className="h-3.5 w-3.5 shrink-0 text-pass-400" />
                  <span className="numeric font-mono text-[0.6875rem] text-pass-400">
                    {transaction.approval.reference}
                  </span>
                </div>
                <p className="mt-2 text-[0.8125rem] leading-relaxed text-mist-200">
                  {L(transaction.approval.scope, transaction.approval.scopeAr)}
                </p>
                <p className="mt-1.5 text-[0.6875rem] text-mist-500">
                  {transaction.approval.approver} · {transaction.approval.approverRole}
                </p>
                <p className="numeric mt-0.5 text-[0.6875rem] text-mist-500">
                  {formatDateTime(transaction.approval.approvedAt, locale)}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-[0.8125rem] text-mist-500">{t("case.noApproval")}</p>
            )}
          </Panel>
        </div>

        {/* CENTRE — the assessment */}
        <div className="lg:col-span-7 xl:col-span-5">
          <AssessmentColumn record={record} />
        </div>

        {/* RIGHT — policy and the human decision */}
        <div className="lg:col-span-12 xl:col-span-4">
          <ReviewPanel record={record} />
        </div>
      </div>
    </div>
  );
}
