"use client";

import Link from "next/link";
import { formatAed, formatAedPrecise, formatDateTime, formatWeekday } from "@/lib/format";
import { sortForQueue } from "@/lib/engine/queue-filters";
import { useCases, useLocale, useLocalised, useT } from "@/lib/store/hooks";
import { Button, EmptyState, Field, Panel, SectionHeading } from "@/components/ui/primitives";
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
  const attachedDocs = transaction.evidence.filter((item) => item.state !== "missing");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/queue"
            className="text-[0.75rem] text-ink-500 underline-offset-2 transition-colors hover:text-ink-900 hover:underline"
          >
            ← {t("queue.title")}
          </Link>
          <h1 className="mt-1 flex flex-wrap items-baseline gap-2.5 text-base font-semibold tracking-tight text-ink-900">
            {t("case.title")}
            <span className="numeric font-mono text-[0.8125rem] font-normal text-ink-500">
              {transaction.id}
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-1.5">
          {previous ? (
            <Link href={`/transactions/${previous.transaction.id}`}>
              <Button variant="secondary" size="sm">
                ← {t("case.prev")}
              </Button>
            </Link>
          ) : null}
          {next ? (
            <Link href={`/transactions/${next.transaction.id}`}>
              <Button variant="secondary" size="sm">
                {t("case.next")} →
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* LEFT — the record itself */}
        <div className="space-y-4 lg:col-span-5 xl:col-span-3">
          <Panel className="p-4">
            <SectionHeading title={t("case.details")} />
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3">
              <Field
                label={t("case.merchant")}
                value={L(transaction.merchant, transaction.merchantAr)}
                className="col-span-2"
              />
              <Field label={t("case.amount")} value={money(transaction.amountAed)} mono />
              <Field
                label={t("case.date")}
                value={`${formatDateTime(transaction.occurredAt, locale)} · ${formatWeekday(transaction.occurredAt, locale)}`}
                mono
              />
              <Field label={t("case.employee")} value={L(employee.name, employee.nameAr)} />
              <Field label={t("case.department")} value={L(department.name, department.nameAr)} />
              <Field
                label={t("case.paymentSource")}
                value={`${transaction.paymentSource} ···· ${transaction.cardLast4}`}
              />
              <Field label={t("case.location")} value={transaction.location} />
              <div className="col-span-2 hairline-t pt-3">
                <p className="label">{L(employee.jobTitle, employee.jobTitleAr)}</p>
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-700">
                  {L(transaction.description, transaction.descriptionAr)}
                </p>
              </div>
            </dl>
          </Panel>

          <Panel className="p-4">
            <SectionHeading title={t("case.receiptPreview")} />
            {transaction.receipt ? (
              <div className="mt-3">
                <div className="border border-[--hairline] bg-ink-50 p-3.5">
                  <p className="text-[0.8125rem] font-semibold text-ink-900">
                    {transaction.receipt.merchantOnReceipt}
                  </p>
                  <p className="numeric mt-0.5 font-mono text-[0.6875rem] text-ink-500">
                    {transaction.receipt.reference}
                  </p>
                  <div className="my-2.5 border-t border-dashed border-ink-300" />
                  <ul className="space-y-1">
                    {transaction.receipt.lines.map((line) => (
                      <li
                        key={line.description}
                        className="flex items-baseline justify-between gap-3 text-[0.75rem] text-ink-700"
                      >
                        <span className="min-w-0 flex-1">
                          {L(line.description, line.descriptionAr)}
                        </span>
                        <span className="numeric shrink-0">
                          {formatAedPrecise(line.amountAed, locale)}
                        </span>
                      </li>
                    ))}
                    <li className="flex items-baseline justify-between gap-3 text-[0.75rem] text-ink-500">
                      <span>VAT 5%</span>
                      <span className="numeric">
                        {formatAedPrecise(transaction.receipt.vatAed, locale)}
                      </span>
                    </li>
                  </ul>
                  <div className="my-2.5 border-t border-dashed border-ink-300" />
                  <div className="flex items-baseline justify-between text-[0.8125rem] font-semibold text-ink-900">
                    <span>{t("case.amount")}</span>
                    <span className="numeric">
                      {formatAedPrecise(transaction.receipt.totalAed, locale)}
                    </span>
                  </div>
                  {transaction.receipt.mismatch ? (
                    <p className="mt-2 text-[0.6875rem] text-escalate-700">
                      Receipt total does not reconcile with the settled amount.
                    </p>
                  ) : null}
                </div>
                <p className="numeric mt-1.5 text-[0.6875rem] text-ink-400">
                  {formatDateTime(transaction.receipt.uploadedAt, locale)}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-[0.8125rem] text-escalate-700">{t("case.noReceipt")}</p>
            )}
          </Panel>

          <Panel className="p-4">
            <SectionHeading title={t("case.supportingDocs")} />
            <ul className="mt-2 divide-y divide-[--hairline]">
              {attachedDocs.map((item) => (
                <li key={item.kind} className="py-2">
                  <p className="text-[0.8125rem] leading-snug text-ink-800">
                    {L(item.label, item.labelAr)}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[0.6875rem] text-ink-500">
                    {item.reference ? (
                      <span className="numeric font-mono">{item.reference}</span>
                    ) : null}
                    {item.state === "self_reported" ? (
                      <span className="text-flag-700">{t("case.selfReported")}</span>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>

            {transaction.approval ? (
              <div className="hairline-t mt-3 pt-3">
                <p className="label">{t("case.approvalHistory")}</p>
                <p className="numeric mt-1 font-mono text-[0.6875rem] text-ink-600">
                  {transaction.approval.reference}
                </p>
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-800">
                  {L(transaction.approval.scope, transaction.approval.scopeAr)}
                </p>
                <p className="mt-1 text-[0.6875rem] text-ink-500">
                  {transaction.approval.approver} · {transaction.approval.approverRole} ·{" "}
                  {formatDateTime(transaction.approval.approvedAt, locale)}
                </p>
              </div>
            ) : null}
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
