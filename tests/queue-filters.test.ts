import { describe, expect, it } from "vitest";
import { baseCases } from "@/lib/engine/analysis";
import {
  defaultQuery,
  filterCases,
  isQueueFilter,
  sortForQueue,
} from "@/lib/engine/queue-filters";

const cases = baseCases();

describe("queue filters", () => {
  it("returns everything by default", () => {
    expect(filterCases(cases, defaultQuery)).toHaveLength(cases.length);
  });

  it("filters by verdict", () => {
    expect(filterCases(cases, { ...defaultQuery, filter: "escalate" })).toHaveLength(3);
    expect(filterCases(cases, { ...defaultQuery, filter: "flag" })).toHaveLength(8);
    expect(filterCases(cases, { ...defaultQuery, filter: "pass" })).toHaveLength(cases.length - 11);
  });

  it("filters to the cases waiting on a human", () => {
    const rows = filterCases(cases, { ...defaultQuery, filter: "needsReview" });
    expect(rows).toHaveLength(11);
    expect(rows.every((r) => r.status === "pending_review")).toBe(true);
  });

  it("filters by risk and by missing evidence", () => {
    const highRisk = filterCases(cases, { ...defaultQuery, filter: "highRisk" });
    expect(highRisk.every((r) => r.analysis.riskLevel === "high")).toBe(true);

    const missing = filterCases(cases, { ...defaultQuery, filter: "missingEvidence" });
    expect(missing.length).toBeGreaterThan(0);
    expect(missing.every((r) => r.analysis.evidence.missing.length > 0)).toBe(true);
  });

  it("filters by department", () => {
    const rows = filterCases(cases, { ...defaultQuery, department: "marketing" });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.department.id === "marketing")).toBe(true);
  });

  it("filters by amount band", () => {
    expect(
      filterCases(cases, { ...defaultQuery, amount: "under1k" }).every(
        (r) => r.transaction.amountAed < 1_000,
      ),
    ).toBe(true);
    expect(
      filterCases(cases, { ...defaultQuery, amount: "over10k" }).every(
        (r) => r.transaction.amountAed > 10_000,
      ),
    ).toBe(true);
    const mid = filterCases(cases, { ...defaultQuery, amount: "1kTo10k" });
    expect(
      mid.every((r) => r.transaction.amountAed >= 1_000 && r.transaction.amountAed <= 10_000),
    ).toBe(true);
  });

  it("filters by date window against the fixed demo clock", () => {
    const last7 = filterCases(cases, { ...defaultQuery, date: "last7" });
    const last14 = filterCases(cases, { ...defaultQuery, date: "last14" });
    expect(last7.length).toBeLessThanOrEqual(last14.length);
    expect(last14.length).toBeLessThanOrEqual(cases.length);
    expect(last7.length).toBeGreaterThan(0);
  });

  it("searches ids, merchants, employees, departments and clauses", () => {
    expect(filterCases(cases, { ...defaultQuery, search: "TXN-2041" })).toHaveLength(1);
    expect(
      filterCases(cases, { ...defaultQuery, search: "gulf fresh" }).length,
    ).toBeGreaterThanOrEqual(2);
    expect(filterCases(cases, { ...defaultQuery, search: "Rana" }).length).toBeGreaterThan(0);
    expect(filterCases(cases, { ...defaultQuery, search: "SUB-6.1" }).length).toBeGreaterThan(0);
    expect(filterCases(cases, { ...defaultQuery, search: "zzzz-no-match" })).toHaveLength(0);
  });

  it("searches Arabic merchant names too", () => {
    expect(filterCases(cases, { ...defaultQuery, search: "طلبات" }).length).toBeGreaterThan(0);
  });

  it("combines filters", () => {
    const rows = filterCases(cases, {
      ...defaultQuery,
      filter: "escalate",
      department: "marketing",
    });
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.department.id === "marketing")).toBe(true);
  });

  it("sorts open exceptions to the top, highest value first", () => {
    const sorted = sortForQueue(cases);
    expect(sorted[0].analysis.verdict).toBe("escalate");
    const escalations = sorted.filter(
      (r) => r.status === "pending_review" && r.analysis.verdict === "escalate",
    );
    for (let i = 1; i < escalations.length; i += 1) {
      expect(escalations[i - 1].transaction.amountAed).toBeGreaterThanOrEqual(
        escalations[i].transaction.amountAed,
      );
    }
  });

  it("validates filter values coming from the URL", () => {
    expect(isQueueFilter("escalate")).toBe(true);
    expect(isQueueFilter("needsReview")).toBe(true);
    expect(isQueueFilter("nonsense")).toBe(false);
    expect(isQueueFilter(null)).toBe(false);
  });
});
