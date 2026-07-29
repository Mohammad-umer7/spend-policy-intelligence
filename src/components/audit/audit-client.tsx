"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Bot, Cpu, FileClock, Search, User } from "lucide-react";
import { cn } from "@/lib/cn";
import type { AuditEvent, DecisionSource } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { useAppliedOnce } from "@/lib/hooks/use-applied-once";
import { useAuditEvents, useLocale, useLocalised, useT } from "@/lib/store/hooks";
import { Button, Chip, EmptyState, Panel } from "@/components/ui/primitives";
import { Drawer } from "@/components/ui/overlays";

/** Source is the audit trail's most important column, so it gets its own visual language. */
const sourceMeta: Record<
  DecisionSource,
  { icon: typeof Cpu; className: string; dot: string }
> = {
  deterministic_rule: {
    icon: Cpu,
    className: "border-info-500/30 bg-info-500/10 text-info-400",
    dot: "bg-info-400",
  },
  ai_reasoning: {
    icon: Bot,
    className: "border-accent-500/30 bg-accent-500/12 text-accent-400",
    dot: "bg-accent-400",
  },
  human_reviewer: {
    icon: User,
    className: "border-pass-500/30 bg-pass-500/12 text-pass-400",
    dot: "bg-pass-400",
  },
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
  const searchParams = useSearchParams();

  const [source, setSource] = useState<DecisionSource | "all">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AuditEvent | null>(null);

  // A deep link from a case pre-filters the trail to that transaction.
  const urlTransaction = searchParams.get("transaction");
  useAppliedOnce(urlTransaction ?? "", () => {
    if (urlTransaction) setSearch(urlTransaction);
  });

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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-mist-50">{t("audit.title")}</h1>
          <p className="mt-1 text-xs text-mist-400">{t("audit.subtitle")}</p>
        </div>
        <p className="text-xs text-mist-500">
          {t("queue.showing", { shown: rows.length, total: events.length })}
        </p>
      </div>

      <Panel variant="glass" className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-white/8 bg-white/3 p-1">
            {sources.map((value) => (
              <button
                key={value}
                onClick={() => setSource(value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.75rem] transition-colors",
                  source === value
                    ? "border border-white/12 bg-white/8 text-mist-50"
                    : "border border-transparent text-mist-400 hover:text-mist-100",
                )}
              >
                {value !== "all" ? (
                  <span className={cn("h-1.5 w-1.5 rounded-full", sourceMeta[value].dot)} />
                ) : null}
                {value === "all" ? t("audit.filter.all") : t(`audit.source.${value}`)}
              </button>
            ))}
          </div>

          <div className="relative min-w-[14rem] flex-1">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mist-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("queue.search")}
              aria-label={t("queue.search")}
              className="h-9 w-full rounded-lg border border-white/10 bg-white/4 ps-8 pe-3 text-[0.8125rem] text-mist-100 placeholder:text-mist-500 focus:border-white/20 focus:outline-none"
            />
          </div>

          {(source !== "all" || search) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSource("all");
                setSearch("");
              }}
            >
              {t("queue.filter.clear")}
            </Button>
          )}
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={<FileClock className="h-6 w-6" />}
            title={t("audit.empty.title")}
            body={t("audit.empty.body")}
          />
        ) : (
          <div className="max-h-[calc(100dvh-18rem)] overflow-auto">
            <table className="w-full min-w-[58rem] border-collapse">
              <thead className="sticky top-0 z-10 bg-ink-850/95 backdrop-blur">
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
                {rows.slice(0, 200).map((event) => {
                  const meta = sourceMeta[event.source];
                  const Icon = meta.icon;
                  return (
                    <tr
                      key={event.id}
                      onClick={() => setSelected(event)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setSelected(event);
                      }}
                      className="hairline-b cursor-pointer transition-colors last:border-b-0 hover:bg-white/4"
                    >
                      <Td>
                        <span className="numeric font-mono text-[0.6875rem] text-mist-400">
                          {formatDateTime(event.timestamp, locale)}
                        </span>
                      </Td>
                      <Td>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[0.6875rem]",
                            meta.className,
                          )}
                        >
                          <Icon className="h-3 w-3" />
                          {t(`audit.source.${event.source}`)}
                        </span>
                      </Td>
                      <Td>
                        {event.transactionId ? (
                          <Link
                            href={`/transactions/${event.transactionId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="numeric font-mono text-[0.6875rem] text-info-400 underline-offset-2 hover:underline"
                          >
                            {event.transactionId}
                          </Link>
                        ) : (
                          <span className="text-mist-600">—</span>
                        )}
                      </Td>
                      <Td>
                        <span className="block truncate text-[0.8125rem] text-mist-200">
                          {event.actor}
                        </span>
                        <span className="block truncate text-[0.625rem] text-mist-500">
                          {event.actorRole}
                        </span>
                      </Td>
                      <Td>
                        <span className="block max-w-[26rem] truncate text-[0.8125rem] text-mist-100">
                          {L(event.action, event.actionAr)}
                        </span>
                      </Td>
                      <Td>
                        {event.newStatus ? (
                          <Chip tone={event.source === "human_reviewer" ? "good" : "neutral"}>
                            {t(`status.${event.newStatus}`)}
                          </Chip>
                        ) : (
                          <span className="text-mist-600">—</span>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Detail drawer */}
      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={t("audit.detail")}
        subtitle={selected ? formatDateTime(selected.timestamp, locale) : undefined}
      >
        {selected ? (
          <div className="space-y-3 px-4 py-4">
            <DetailRow label={t("audit.col.source")} value={t(`audit.source.${selected.source}`)} />
            <DetailRow label={t("audit.col.actor")} value={`${selected.actor} · ${selected.actorRole}`} />
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
              value={selected.previousStatus ? t(`status.${selected.previousStatus}`) : t("common.none")}
            />
            <DetailRow
              label={t("audit.col.to")}
              value={selected.newStatus ? t(`status.${selected.newStatus}`) : t("common.none")}
            />
            <div>
              <p className="text-[0.625rem] uppercase tracking-wide text-mist-500">
                {t("audit.col.evidence")}
              </p>
              {selected.evidenceUsed.length === 0 ? (
                <p className="mt-1 text-[0.8125rem] text-mist-500">{t("common.none")}</p>
              ) : (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {selected.evidenceUsed.map((item) => (
                    <Chip key={item} tone="neutral">
                      {item}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
            {selected.reviewerNote ? (
              <div>
                <p className="text-[0.625rem] uppercase tracking-wide text-mist-500">
                  {t("audit.col.note")}
                </p>
                <p className="mt-1.5 rounded-lg border border-white/8 bg-white/3 px-3 py-2.5 text-[0.8125rem] leading-relaxed text-mist-200">
                  {selected.reviewerNote}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="whitespace-nowrap px-3 py-2.5 text-start text-[0.6875rem] font-medium uppercase tracking-wide text-mist-500"
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2.5 align-middle">{children}</td>;
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
        "mt-1 text-[0.8125rem] leading-relaxed text-mist-200",
        mono && "numeric font-mono text-[0.75rem]",
        href && "text-info-400 underline-offset-2 hover:underline",
      )}
    >
      {value}
    </p>
  );
  return (
    <div>
      <p className="text-[0.625rem] uppercase tracking-wide text-mist-500">{label}</p>
      {href ? <Link href={href}>{body}</Link> : body}
    </div>
  );
}
