import { describe, expect, it } from "vitest";
import { requireTransaction, transactions } from "@/lib/data/transactions";
import { getEmployee } from "@/lib/data/company";
import { policy, threshold } from "@/lib/data/policy";
import { analyseTransaction, baseCases } from "@/lib/engine/analysis";
import { assessEvidence, exceedsHotelBand, isFuelLocationMismatch } from "@/lib/engine/evidence";
import { aggregateVerdict, businessDaysSince, evaluateRules, isOpen, riskLevel } from "@/lib/engine/rules";

const cases = baseCases();
const byId = (id: string) => {
  const record = cases.find((c) => c.transaction.id === id);
  if (!record) throw new Error(`Missing case ${id}`);
  return record;
};

describe("verdict logic", () => {
  it("escalates a hotel charge above the employee's travel band", () => {
    const record = byId("TXN-2041");
    expect(record.analysis.verdict).toBe("escalate");
    expect(record.analysis.citedClauseIds).toContain("TRV-2.3");
    // An exception is always granted under EXC-10.1, so it must be cited too.
    expect(record.analysis.citedClauseIds).toContain("EXC-10.1");
    expect(record.analysis.recommendedAction.key).toBe("request_finance_director_approval");
  });

  it("computes the exact over-band amount quoted in the explanation", () => {
    const transaction = requireTransaction("TXN-2041");
    const employee = getEmployee(transaction.employeeId);
    const band = employee.travelBand.hotelNightlyAed * (transaction.nights ?? 1);
    expect(band).toBe(3_500);
    expect(transaction.amountAed - band).toBe(1_350);
    expect(exceedsHotelBand(transaction, employee)).toBe(true);
  });

  it("flags — never escalates — a possible duplicate, and cites DUP-9.2", () => {
    for (const id of ["TXN-2029", "TXN-2033"]) {
      const record = byId(id);
      expect(record.analysis.verdict).toBe("flag");
      expect(record.analysis.citedClauseIds).toContain("DUP-9.2");
    }
  });

  it("flags a weekend team meal for the missing attendee names", () => {
    const record = byId("TXN-2036");
    expect(record.analysis.verdict).toBe("flag");
    expect(record.analysis.citedClauseIds[0]).toBe("MEA-4.1");
    expect(record.analysis.recommendedAction.key).toBe("request_attendee_details");
    // The weekend clause is satisfied — the roster justification is on file.
    const weekend = record.analysis.findings.find((f) => f.clauseId === "WKD-7.4");
    expect(weekend?.outcome).toBe("satisfied");
  });

  it("flags a fuel purchase outside the assigned emirate", () => {
    const record = byId("TXN-2052");
    const transaction = requireTransaction("TXN-2052");
    const employee = getEmployee(transaction.employeeId);
    expect(isFuelLocationMismatch(transaction, employee)).toBe(true);
    expect(record.analysis.verdict).toBe("flag");
    expect(record.analysis.recommendedAction.key).toBe("request_travel_context");
  });

  it("escalates a subscription that overlaps an existing enterprise licence", () => {
    for (const id of ["TXN-2044", "TXN-2032"]) {
      const record = byId(id);
      expect(record.analysis.verdict).toBe("escalate");
      expect(record.analysis.citedClauseIds).toContain("SUB-6.1");
      expect(record.analysis.recommendedAction.key).toBe("confirm_existing_licence");
    }
  });

  it("passes a renewal that is already on the licence register", () => {
    expect(byId("TXN-2065").analysis.verdict).toBe("pass");
    expect(byId("TXN-2071").analysis.verdict).toBe("pass");
  });

  it("produces exactly the verdict mix the dashboard reports", () => {
    const counts = { pass: 0, flag: 0, escalate: 0 };
    for (const record of cases) counts[record.analysis.verdict] += 1;
    expect(counts.escalate).toBe(3);
    expect(counts.flag).toBe(8);
    expect(counts.pass).toBe(cases.length - 11);
  });

  it("aggregates the worst open finding and ignores satisfied ones", () => {
    expect(aggregateVerdict([])).toBe("pass");
    expect(
      aggregateVerdict([
        { clauseId: "A", outcome: "satisfied", suggestedVerdict: "pass", detail: "", detailAr: "", figures: [] },
        { clauseId: "B", outcome: "attention", suggestedVerdict: "flag", detail: "", detailAr: "", figures: [] },
        { clauseId: "C", outcome: "breach", suggestedVerdict: "escalate", detail: "", detailAr: "", figures: [] },
      ]),
    ).toBe("escalate");
  });

  it("treats an observation with a pass verdict as closed, not open", () => {
    const finding = {
      clauseId: "DOC-8.1",
      outcome: "attention" as const,
      suggestedVerdict: "pass" as const,
      detail: "",
      detailAr: "",
      figures: [],
    };
    expect(isOpen(finding)).toBe(false);
    expect(aggregateVerdict([finding])).toBe("pass");
  });

  it("only ages an item that is genuinely unresolved", () => {
    // A compliant record older than five business days must not be escalated.
    const oldAndClean = byId("TXN-2002");
    expect(businessDaysSince(oldAndClean.transaction.occurredAt)).toBeGreaterThan(5);
    expect(oldAndClean.analysis.verdict).toBe("pass");
    expect(oldAndClean.analysis.citedClauseIds).not.toContain("ESC-11.2");
  });

  it("cites ESC-11.2 on an open item past the five business day threshold", () => {
    const record = byId("TXN-2029");
    expect(businessDaysSince(record.transaction.occurredAt)).toBeGreaterThan(
      threshold("ESC-11.2", "escalateAfterBusinessDays"),
    );
    expect(record.analysis.citedClauseIds).toContain("ESC-11.2");
  });

  it("never cites a clause that is not in the published policy", () => {
    const known = new Set(policy.clauses.map((c) => c.id));
    for (const record of cases) {
      for (const clauseId of record.analysis.citedClauseIds) {
        expect(known.has(clauseId), `${record.transaction.id} cites unknown ${clauseId}`).toBe(true);
      }
    }
  });

  it("is deterministic — the same transaction always yields the same verdict", () => {
    const first = analyseTransaction(requireTransaction("TXN-2041"));
    const second = analyseTransaction(requireTransaction("TXN-2041"));
    expect(second.verdict).toBe(first.verdict);
    expect(second.riskLevel).toBe(first.riskLevel);
    expect(second.citedClauseIds).toEqual(first.citedClauseIds);
    expect(second.explanation).toBe(first.explanation);
  });
});

describe("risk level", () => {
  it("keeps a well-evidenced escalation at medium rather than high", () => {
    expect(riskLevel("escalate", 0.8, 4_850, 1)).toBe("medium");
    expect(byId("TXN-2041").analysis.riskLevel).toBe("medium");
  });

  it("raises an escalation with thin evidence to high", () => {
    expect(riskLevel("escalate", 0.5, 6_300, 2)).toBe("high");
    expect(byId("TXN-2044").analysis.riskLevel).toBe("high");
  });

  it("never presents a small-value item as high risk on its own", () => {
    expect(riskLevel("flag", 0, 310, 2)).toBe("medium");
  });

  it("rates a clean record low", () => {
    expect(riskLevel("pass", 1, 50_000, 0)).toBe("low");
  });
});

describe("evidence completeness", () => {
  it("reports 4 of 5 for the hotel case, with availability self-reported", () => {
    const transaction = requireTransaction("TXN-2041");
    const assessment = assessEvidence(transaction, getEmployee(transaction.employeeId));
    expect(assessment.requiredCount).toBe(5);
    expect(assessment.presentCount).toBe(4);
    expect(assessment.selfReported).toEqual(["availability_evidence"]);
    // Self-reported evidence deliberately does not count towards completeness.
    expect(assessment.completeness).toBeCloseTo(0.8);
  });

  it("counts a missing required item even when the record does not name it", () => {
    const transaction = requireTransaction("TXN-2034");
    const assessment = assessEvidence(transaction, getEmployee(transaction.employeeId));
    expect(assessment.presentCount).toBe(0);
    expect(assessment.missing).toContain("receipt");
    expect(assessment.missing).toContain("manager_confirmation");
  });

  it("requires attendee names only above the meals threshold", () => {
    const limit = threshold("MEA-4.1", "attendeeNamesRequiredAboveAed");
    const big = requireTransaction("TXN-2036");
    expect(big.amountAed).toBeGreaterThan(limit);
    const assessment = assessEvidence(big, getEmployee(big.employeeId));
    expect(assessment.required).toContain("attendee_list");
  });

  it("never reports a completeness outside 0–1", () => {
    for (const transaction of transactions) {
      const assessment = assessEvidence(transaction, getEmployee(transaction.employeeId));
      expect(assessment.completeness).toBeGreaterThanOrEqual(0);
      expect(assessment.completeness).toBeLessThanOrEqual(1);
      expect(assessment.presentCount).toBeLessThanOrEqual(assessment.requiredCount);
    }
  });
});

describe("rule evaluation", () => {
  it("evaluates at least one clause for every transaction, so coverage is complete", () => {
    for (const transaction of transactions) {
      const employee = getEmployee(transaction.employeeId);
      const evidence = assessEvidence(transaction, employee);
      const findings = evaluateRules({ transaction, employee, evidence });
      expect(findings.length).toBeGreaterThan(0);
    }
    expect(cases.every((c) => c.analysis.policyCoverage === "complete")).toBe(true);
  });

  it("requires human review for anything that is not a pass", () => {
    for (const record of cases) {
      expect(record.analysis.humanReviewRequired).toBe(record.analysis.verdict !== "pass");
    }
  });
});
