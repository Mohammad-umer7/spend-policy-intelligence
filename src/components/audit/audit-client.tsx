"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";
import type { AuditEvent, DecisionSource } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { useQueryParams } from "@/lib/hooks/use-query-params";
import { useAuditEvents, useLocale, useLocalised, useT } from "@/lib/store/hooks";
import { Button, EmptyState, Panel } from "@/components/ui/primitives";
import { Drawer } from "@/components/ui/overlays";

/*
  Source is the audit trail's most important column: it answers "who decided
  this". Each source gets a distinct dot, but the label always accompanies it.
*/
const sourceDot: Record<DecisionSource, string> = {
  deterministic_rule: "bg-ink-400",
  ai_reasoning: "bg-accent-500",
  human_reviewer: "bg-pass-600",
};

const sources: (DecisionSource | "all")[] = [
  "all",
  "human_reviewer",
  "deterministic_rule",
  "ai_reasoning",
];

export function AuditClient() {
  const t = useT();
  const locale = useLocale();
  const L = useLocalised();
  const events = useAuditEvents();
  const searchParams = useQueryParams();

  // A deep link from a case pre-filters the trail to that transaction. The URL
  // supplies the default search term; typing overrides it.
  const urlTransaction = searchParams.get("transaction");
  const [typed, setTyped] = useState<string | null>(null);
  const search = typed ?? urlTransaction ?? "";

  const [source, setSource] = useState<DecisionSource | "all">("all");
  const [selected, setSelected] = useState<AuditEvent | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((event) => {
      if (source !== "all" && event.source !== source) return false;
      if (!q) return true;
      return (
        (event.transactionId ?? "").toLowerCase().includes(q) ||
        event.actor.toLowerCase().includes(q) ||
        event.action.toLowerCase().includes(q) ||
        (event.ruleReference ?? "").toLowerCase().includes(q)
      );
    });
  }, [events, source, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-ink-900">{t("audit.title")}</h1>
          <p className="mt-0.5 text-xs text-ink-500">{t("audit.subtitle")}</p>
        </div>
        <p className="numeric text-xs text-ink-500">
          {t("queue.showing", { shown: rows.length, total: events.length })}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-0.5">
          {sources.map((value) => (
            <button
              key={value}
              onClick={() => setSource(value)}
              aria-pressed={source === value}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[0.1875rem] px-2.5 py-1 text-[0.75rem] transition-colors",
                source === value
                  ? "bg-ink-900 font-medium text-white"
                  : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
              )}
            >
              {value !== "all" ? (
                <span className={cn("h-1.5 w-1.5 rounded-full", sourceDot[value])} />
              ) : null}
              {value === "all" ? t("audit.filter.all") : t(`audit.source.${value}`)}
            </button>
          ))}
        </div>

        <div className="relative ms-auto min-w-[13rem] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={t("queue.search")}
            aria-label={t("queue.search")}
            className="h-8 w-full rounded-[0.1875rem] border border-[--hairline] bg-white ps-8 pe-3 text-[0.8125rem] text-ink-900 placeholder:text-ink-400 focus:border-[--hairline-strong] focus:outline-none"
          />
        </div>

        {source !== "all" || search ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSource("all");
              setTyped("");
            }}
          >
            {t("queue.filter.clear")}
          </Button>
        ) : null}
      </div>

      <Panel className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState title={t("audit.empty.title")} body={t("audit.empty.body")} />
        ) : (
          <div className="max-h-[calc(100dvh-15rem)] overflow-auto">
            <table className="w-full min-w-[54rem] border-collapse">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="hairline-b">
                  <Th>{t("audit.col.timestamp")}</Th>
                  <Th>{t("audit.col.source")}</Th>
                  <Th>{t("audit.col.transaction")}</Th>
                  <Th>{t("audit.col.actor")}</Th>
                  <Th>{t("audit.col.action")}</Th>
                  <Th>{t("audit.col.to")}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((event) => (
                  <tr
                    key={event.id}
                    onClick={() => setSelected(event)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setSelected(event);
                    }}
                    className="hairline-b cursor-pointer transition-colors last:border-b-0 hover:bg-ink-50"
                  >
                    <Td>
                      <span className="numeric font-mono text-[0.6875rem] text-ink-500">
                        {formatDateTime(event.timestamp, locale)}
                      </span>
                    </Td>
                    <Td>
                      <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-ink-800">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            sourceDot[event.source],
                          )}
                        />
                        {t(`audit.source.${event.source}`)}
                      </span>
                    </Td>
                    <Td>
                      {event.transactionId ? (
                        <Link
                          href={`/transactions/${event.transactionId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="numeric font-mono text-[0.6875rem] text-accent-600 underline-offset-2 hover:underline"
                        >
                          {event.transactionId}
                        </Link>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </Td>
                    <Td>
                      <span className="block truncate text-[0.8125rem] text-ink-800">
                        {event.actor}
                      </span>
                      <span className="block truncate text-[0.625rem] text-ink-500">
                        {event.actorRole}
                      </span>
                    </Td>
                    <Td>
                      <span className="block max-w-[26rem] truncate text-[0.8125rem] text-ink-900">
                        {L(event.action, event.actionAr)}
                      </span>
                    </Td>
                    <Td>
                      {event.newStatus ? (
                        <span className="text-[0.75rem] text-ink-700">
                          {t(`status.${event.newStatus}`)}
                        </span>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={t("audit.detail")}
        subtitle={selected ? formatDateTime(selected.timestamp, locale) : undefined}
      >
        {selected ? (
          <div className="space-y-3 px-4 py-4">
            <DetailRow label={t("audit.col.source")} value={t(`audit.source.${selected.source}`)} />
            <DetailRow
              label={t("audit.col.actor")}
              value={`${selected.actor} · ${selected.actorRole}`}
            />
            <DetailRow label={t("audit.col.action")} value={L(selected.action, selected.actionAr)} />
            <DetailRow
              label={t("audit.col.transaction")}
              value={selected.transactionId ?? t("common.none")}
              href={selected.transactionId ? `/transactions/${selected.transactionId}` : undefined}
            />
            <DetailRow
              label={t("audit.col.rule")}
              value={selected.ruleReference ?? t("common.none")}
              mono
            />
            <DetailRow
              label={t("audit.col.explanation")}
              value={selected.aiExplanation ?? t("common.none")}
            />
            <DetailRow label={t("audit.col.policyVersion")} value={selected.policyVersion} mono />
            <DetailRow
              label={t("audit.col.from")}
              value={
                selected.previousStatus ? t(`status.${selected.previousStatus}`) : t("common.none")
              }
            />
            <DetailRow
              label={t("audit.col.to")}
              value={selected.newStatus ? t(`status.${selected.newStatus}`) : t("common.none")}
            />
            <DetailRow
              label={t("audit.col.evidence")}
              value={
                selected.evidenceUsed.length === 0
                  ? t("common.none")
                  : selected.evidenceUsed.join(", ")
              }
            />
            {selected.reviewerNote ? (
              <DetailRow label={t("audit.col.note")} value={selected.reviewerNote} />
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="label whitespace-nowrap px-3 py-2 text-start">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 align-middle">{children}</td>;
}

function DetailRow({
  label,
  value,
  mono,
  href,
}: {
  label: string;
  value: string;
  mono?: boolean;
  href?: string;
}) {
  const body = (
    <p
      className={cn(
        "mt-0.5 text-[0.8125rem] leading-relaxed text-ink-800",
        mono && "numeric font-mono text-[0.75rem]",
        href && "text-accent-600 underline-offset-2 hover:underline",
      )}
    >
      {value}
    </p>
  );
  return (
    <div>
      <p className="label">{label}</p>
      {href ? <Link href={href}>{body}</Link> : body}
    </div>
  );
}
