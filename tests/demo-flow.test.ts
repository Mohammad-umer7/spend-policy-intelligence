/**
 * @vitest-environment happy-dom
 *
 * Walks the exact three-minute presenter flow, step by step. If this suite
 * passes, the demo cannot break on stage for a data reason.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { baseCases } from "@/lib/engine/analysis";
import { applyDecisions, seedAuditEvents, useAppStore } from "@/lib/store/app-store";
import { buildDailyBrief } from "@/lib/ai/brief";
import { companyTotals, departmentBudgets } from "@/lib/engine/budget";
import { defaultQuery, filterCases, sortForQueue } from "@/lib/engine/queue-filters";
import { answerQuestion } from "@/lib/ai/copilot";
import { getClause } from "@/lib/data/policy";
import { formatAed } from "@/lib/format";
import { dictionary } from "@/lib/i18n/dictionary";

describe("three-minute demo flow", () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({
      decisions: {},
      humanAuditEvents: [],
      approvedPrecedents: [],
      declinedPrecedents: [],
      copilotMessages: [],
      locale: "en",
    });
  });

  it("runs end to end", () => {
    // 1–2. Open the dashboard: spend, budget risk and priority cases are present.
    const cases = baseCases();
    const totals = companyTotals();
    expect(totals.totalSpend).toBeGreaterThan(0);
    expect(totals.totalBudget).toBeGreaterThan(totals.totalSpend);

    const brief = buildDailyBrief(cases);
    expect(brief.headline).toContain("Marketing");
    expect(brief.headline).toContain("18,400");

    const overBudget = departmentBudgets().filter((b) => b.isForecastOverBudget);
    expect(overBudget).toHaveLength(1);
    expect(overBudget[0].department.name).toBe("Marketing");

    // 3. "Review priority cases" — the CTA count matches the queue.
    const priority = filterCases(cases, { ...defaultQuery, filter: "needsReview" });
    expect(priority).toHaveLength(11);
    const escalations = priority.filter((c) => c.analysis.verdict === "escalate");
    expect(escalations).toHaveLength(3);

    // 4. The hotel case sits among the top escalations the presenter opens.
    const sorted = sortForQueue(cases);
    expect(sorted.slice(0, 3).map((c) => c.transaction.id)).toContain("TXN-2041");
    expect(sorted[0].analysis.verdict).toBe("escalate");
    const hotel = sorted.find((c) => c.transaction.id === "TXN-2041")!;

    // 5. Receipt, trip approval and travel band are all on the record.
    expect(hotel.transaction.receipt).not.toBeNull();
    expect(hotel.transaction.approval?.reference).toBe("TRV-2026-0418");
    expect(hotel.transaction.travelRequestId).toBe("TRV-2026-0418");
    expect(hotel.employee.travelBand.hotelNightlyAed * hotel.transaction.nights!).toBe(3_500);
    expect(hotel.analysis.evidence.presentCount).toBe(4);
    expect(hotel.analysis.evidence.requiredCount).toBe(5);

    // 6. The exact policy clause resolves to real published text.
    const clause = getClause("TRV-2.3");
    expect(clause).toBeDefined();
    expect(clause!.text).toContain("approved travel band");
    expect(clause!.textAr.length).toBeGreaterThan(40);

    // 7. The AI explanation is present and grounded.
    expect(hotel.analysis.verdict).toBe("escalate");
    expect(hotel.analysis.explanation).toContain(formatAed(1_350));
    expect(hotel.analysis.uncertainty).toContain("self");

    // 8. Switching the explanation to Arabic yields real Arabic prose.
    expect(/[؀-ۿ]/.test(hotel.analysis.explanationAr)).toBe(true);
    expect(hotel.analysis.explanationAr).not.toBe(hotel.analysis.explanation);
    // Core navigation is translated too.
    expect(dictionary.ar["nav.queue"]).not.toBe(dictionary.en["nav.queue"]);
    expect(Object.keys(dictionary.ar)).toEqual(Object.keys(dictionary.en));

    // 9–11. Approve the exception with a required reviewer note.
    const note = "Conference rate surge confirmed. Approved as an exception under EXC-10.1.";
    useAppStore.getState().recordDecision({
      record: hotel,
      action: "approve_exception",
      note,
      timestamp: "2026-07-24T11:30:00+04:00",
    });

    const decisions = useAppStore.getState().decisions;
    expect(decisions["TXN-2041"].status).toBe("approved");

    // 12. A new audit record exists, attributed to the human reviewer.
    const humanEvents = useAppStore.getState().humanAuditEvents;
    expect(humanEvents).toHaveLength(1);
    expect(humanEvents[0].source).toBe("human_reviewer");
    expect(humanEvents[0].reviewerNote).toBe(note);
    expect(humanEvents[0].previousStatus).toBe("pending_review");
    expect(humanEvents[0].newStatus).toBe("approved");

    // The audit trail shows all three sources together.
    const trail = [...humanEvents, ...seedAuditEvents(cases)];
    expect(new Set(trail.map((e) => e.source))).toEqual(
      new Set(["human_reviewer", "deterministic_rule", "ai_reasoning"]),
    );

    // The dashboard and queue counts both drop.
    const afterCases = applyDecisions(cases, decisions);
    expect(filterCases(afterCases, { ...defaultQuery, filter: "needsReview" })).toHaveLength(10);

    // 13–15. The copilot answers the budget question with grounded figures.
    const answer = answerQuestion(
      "Would approving this cause the department to exceed its travel budget?",
      { cases: afterCases, focusTransactionId: "TXN-2041" },
    );
    expect(answer).not.toBeNull();
    expect(answer!.answer).toContain("Marketing");
    expect(answer!.answer).toContain("18,400");
    expect(answer!.figures.map((f) => f.label)).toContain("Forecast variance");
    expect(answer!.supportingTransactionIds).toContain("TXN-2041");
    expect(answer!.citedClauseIds).toContain("EXC-10.1");
    expect(answer!.missingInformation.length).toBeGreaterThan(0);
    expect(answer!.recommendedNextAction.length).toBeGreaterThan(20);
  });

  it("keeps every route target in the brief and queue reachable", () => {
    const cases = baseCases();
    const brief = buildDailyBrief(cases);
    const routes = new Set(["/", "/queue", "/policy", "/brief", "/audit", "/security", "/settings"]);

    const hrefs = [
      ...brief.attention,
      ...brief.budgetRisks,
      ...brief.policyExceptions,
      ...brief.missingDocuments,
      ...brief.vendorObservations,
      ...brief.savings,
      ...brief.recommendedActions,
    ].map((i) => i.href);

    for (const href of hrefs) {
      const base = href.split("?")[0];
      const isTransaction = base.startsWith("/transactions/");
      expect(routes.has(base) || isTransaction, `unreachable route ${href}`).toBe(true);
      if (isTransaction) {
        const id = base.replace("/transactions/", "");
        expect(cases.some((c) => c.transaction.id === id)).toBe(true);
      }
    }
  });
});
