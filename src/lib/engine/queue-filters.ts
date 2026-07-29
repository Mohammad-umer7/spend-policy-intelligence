import type { CaseRecord, DepartmentId } from "../types";
import { DEMO_NOW_MS } from "../format";

/**
 * Queue filtering, kept as pure functions so the same logic drives the table,
 * the dashboard tiles that link into it, and the tests.
 */

export type QueueFilter =
  | "all"
  | "needsReview"
  | "pass"
  | "flag"
  | "escalate"
  | "highRisk"
  | "missingEvidence";

export type AmountRange = "any" | "under1k" | "1kTo10k" | "over10k";
export type DateRange = "any" | "last7" | "last14";

export interface QueueQuery {
  filter: QueueFilter;
  department: DepartmentId | "all";
  amount: AmountRange;
  date: DateRange;
  search: string;
}

export const defaultQuery: QueueQuery = {
  filter: "all",
  department: "all",
  amount: "any",
  date: "any",
  search: "",
};

const amountPredicates: Record<AmountRange, (amount: number) => boolean> = {
  any: () => true,
  under1k: (amount) => amount < 1_000,
  "1kTo10k": (amount) => amount >= 1_000 && amount <= 10_000,
  over10k: (amount) => amount > 10_000,
};

const dateWindows: Record<DateRange, number | null> = {
  any: null,
  last7: 7 * 24 * 3_600_000,
  last14: 14 * 24 * 3_600_000,
};

function matchesFilter(record: CaseRecord, filter: QueueFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "needsReview":
      return record.status === "pending_review";
    case "pass":
      return record.analysis.verdict === "pass";
    case "flag":
      return record.analysis.verdict === "flag";
    case "escalate":
      return record.analysis.verdict === "escalate";
    case "highRisk":
      return record.analysis.riskLevel === "high";
    case "missingEvidence":
      return record.analysis.evidence.missing.length > 0;
  }
}

function matchesSearch(record: CaseRecord, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const raw = search.trim();
  return (
    record.transaction.id.toLowerCase().includes(q) ||
    record.transaction.merchant.toLowerCase().includes(q) ||
    record.transaction.merchantAr.includes(raw) ||
    record.employee.name.toLowerCase().includes(q) ||
    record.employee.nameAr.includes(raw) ||
    record.department.name.toLowerCase().includes(q) ||
    record.department.nameAr.includes(raw) ||
    record.analysis.citedClauseIds.some((id) => id.toLowerCase().includes(q))
  );
}

export function filterCases(cases: CaseRecord[], query: QueueQuery): CaseRecord[] {
  const window = dateWindows[query.date];
  return cases.filter((record) => {
    if (!matchesFilter(record, query.filter)) return false;
    if (query.department !== "all" && record.department.id !== query.department) return false;
    if (!amountPredicates[query.amount](record.transaction.amountAed)) return false;
    if (window !== null && DEMO_NOW_MS - Date.parse(record.transaction.occurredAt) > window) {
      return false;
    }
    return matchesSearch(record, query.search);
  });
}

/** Open exceptions first, then by value — the order a reviewer would choose. */
export function sortForQueue(cases: CaseRecord[]): CaseRecord[] {
  const verdictRank = { escalate: 0, flag: 1, pass: 2 } as const;
  const statusRank: Record<CaseRecord["status"], number> = {
    pending_review: 0,
    info_requested: 1,
    escalated: 1,
    approved: 2,
    rejected: 2,
    cleared: 3,
  };
  return [...cases].sort(
    (a, b) =>
      statusRank[a.status] - statusRank[b.status] ||
      verdictRank[a.analysis.verdict] - verdictRank[b.analysis.verdict] ||
      b.transaction.amountAed - a.transaction.amountAed,
  );
}

export function isQueueFilter(value: string | null): value is QueueFilter {
  return (
    value === "all" ||
    value === "needsReview" ||
    value === "pass" ||
    value === "flag" ||
    value === "escalate" ||
    value === "highRisk" ||
    value === "missingEvidence"
  );
}
