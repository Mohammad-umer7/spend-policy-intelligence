/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it } from "vitest";
import { baseCases } from "@/lib/engine/analysis";
import {
  NOTE_REQUIRED_ACTIONS,
  applyDecisions,
  seedAuditEvents,
  statusForAction,
  useAppStore,
  STORAGE_KEY,
} from "@/lib/store/app-store";
import { suggestPrecedents } from "@/lib/engine/precedents";
import { filterCases, defaultQuery } from "@/lib/engine/queue-filters";
import type { ReviewAction } from "@/lib/types";

const cases = baseCases();
const hotel = cases.find((c) => c.transaction.id === "TXN-2041")!;
const duplicateA = cases.find((c) => c.transaction.id === "TXN-2029")!;
const duplicateB = cases.find((c) => c.transaction.id === "TXN-2033")!;

function reset() {
  localStorage.clear();
  useAppStore.setState({
    decisions: {},
    humanAuditEvents: [],
    approvedPrecedents: [],
    declinedPrecedents: [],
    copilotMessages: [],
    toasts: [],
    locale: "en",
  });
}

describe("review status transitions", () => {
  beforeEach(reset);

  it("maps each action to the status a reviewer expects", () => {
    expect(statusForAction.approve_exception).toBe("approved");
    expect(statusForAction.request_information).toBe("info_requested");
    expect(statusForAction.escalate).toBe("escalated");
    expect(statusForAction.reject).toBe("rejected");
    // A note records context without moving the case.
    expect(statusForAction.add_note).toBeNull();
  });

  it("requires a reviewer note for the decisions that change an outcome", () => {
    expect(NOTE_REQUIRED_ACTIONS).toContain("approve_exception");
    expect(NOTE_REQUIRED_ACTIONS).toContain("reject");
    expect(NOTE_REQUIRED_ACTIONS).toContain("escalate");
    expect(NOTE_REQUIRED_ACTIONS).not.toContain("request_information");
  });

  it("records an approval and moves the case out of the queue", () => {
    useAppStore.getState().recordDecision({
      record: hotel,
      action: "approve_exception",
      note: "Conference rates verified with the organiser. Approved as a documented exception.",
      timestamp: "2026-07-24T10:00:00+04:00",
    });

    const decision = useAppStore.getState().decisions["TXN-2041"];
    expect(decision.status).toBe("approved");
    expect(decision.reviewer).toBe("Mariam Al Falasi");
    expect(decision.note).toContain("Conference rates");

    const updated = applyDecisions(cases, useAppStore.getState().decisions);
    const record = updated.find((c) => c.transaction.id === "TXN-2041")!;
    expect(record.status).toBe("approved");
    expect(record.decision?.action).toBe("approve_exception");

    // The queue count the dashboard shows must drop by one.
    const before = filterCases(cases, { ...defaultQuery, filter: "needsReview" }).length;
    const after = filterCases(updated, { ...defaultQuery, filter: "needsReview" }).length;
    expect(after).toBe(before - 1);
  });

  it("leaves the case where it is when only a note is added", () => {
    useAppStore.getState().recordDecision({
      record: duplicateA,
      action: "add_note",
      note: "Confirmed with the supplier that two deliveries were made.",
      timestamp: "2026-07-24T10:05:00+04:00",
    });
    const updated = applyDecisions(cases, useAppStore.getState().decisions);
    const record = updated.find((c) => c.transaction.id === "TXN-2029")!;
    expect(record.status).toBe("pending_review");
    expect(record.decision?.note).toContain("two deliveries");
  });

  it("does not mutate the underlying synthetic ledger", () => {
    useAppStore.getState().recordDecision({
      record: hotel,
      action: "reject",
      note: "Out of policy.",
      timestamp: "2026-07-24T10:10:00+04:00",
    });
    // baseCases() is memoised; the original record must be untouched.
    expect(baseCases().find((c) => c.transaction.id === "TXN-2041")!.status).toBe(
      "pending_review",
    );
  });
});

describe("audit events", () => {
  beforeEach(reset);

  it("seeds a deterministic-rule and an AI event for every transaction", () => {
    const seeded = seedAuditEvents(cases);
    expect(seeded).toHaveLength(cases.length * 2);
    expect(seeded.filter((e) => e.source === "deterministic_rule")).toHaveLength(cases.length);
    expect(seeded.filter((e) => e.source === "ai_reasoning")).toHaveLength(cases.length);
    // The rule event carries a rule reference and no model prose, and vice versa.
    const rule = seeded.find((e) => e.source === "deterministic_rule")!;
    expect(rule.ruleReference).toBeTruthy();
    expect(rule.aiExplanation).toBeNull();
    const ai = seeded.find((e) => e.source === "ai_reasoning")!;
    expect(ai.aiExplanation).toBeTruthy();
    expect(ai.ruleReference).toBeNull();
  });

  it("creates a human event for each reviewer decision, with before and after status", () => {
    useAppStore.getState().recordDecision({
      record: hotel,
      action: "approve_exception",
      note: "Approved under EXC-10.1.",
      timestamp: "2026-07-24T11:00:00+04:00",
    });

    const events = useAppStore.getState().humanAuditEvents;
    expect(events).toHaveLength(1);
    const [event] = events;
    expect(event.source).toBe("human_reviewer");
    expect(event.transactionId).toBe("TXN-2041");
    expect(event.previousStatus).toBe("pending_review");
    expect(event.newStatus).toBe("approved");
    expect(event.reviewerNote).toBe("Approved under EXC-10.1.");
    expect(event.policyVersion).toBe("v4.2");
    expect(event.ruleReference).toContain("TRV-2.3");
  });

  it("keeps the previous status accurate across two decisions on one case", () => {
    const store = useAppStore.getState();
    store.recordDecision({
      record: hotel,
      action: "request_information",
      note: "",
      timestamp: "2026-07-24T11:00:00+04:00",
    });
    useAppStore.getState().recordDecision({
      record: hotel,
      action: "approve_exception",
      note: "Evidence supplied.",
      timestamp: "2026-07-24T12:00:00+04:00",
    });

    const events = useAppStore.getState().humanAuditEvents;
    expect(events).toHaveLength(2);
    // Newest first.
    expect(events[0].previousStatus).toBe("info_requested");
    expect(events[0].newStatus).toBe("approved");
  });

  it("gives every event a unique id", () => {
    const store = useAppStore.getState();
    store.recordDecision({ record: hotel, action: "escalate", note: "n1" });
    useAppStore.getState().recordDecision({ record: duplicateA, action: "escalate", note: "n2" });
    useAppStore.getState().recordDecision({ record: duplicateB, action: "escalate", note: "n3" });
    const ids = useAppStore.getState().humanAuditEvents.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("reviewer learning", () => {
  beforeEach(reset);

  it("does not propose a precedent from a single decision", () => {
    useAppStore.getState().recordDecision({
      record: duplicateA,
      action: "approve_exception",
      note: "Two genuine deliveries.",
    });
    expect(suggestPrecedents(cases, useAppStore.getState().decisions)).toHaveLength(0);
  });

  it("proposes a precedent once the same decision repeats, still requiring approval", () => {
    const store = useAppStore.getState();
    store.recordDecision({ record: duplicateA, action: "approve_exception", note: "a" });
    useAppStore.getState().recordDecision({
      record: duplicateB,
      action: "approve_exception",
      note: "b",
    });

    const precedents = suggestPrecedents(cases, useAppStore.getState().decisions);
    expect(precedents).toHaveLength(1);
    expect(precedents[0].clauseId).toBe("DUP-9.2");
    expect(precedents[0].observedCount).toBe(2);
    // Crucially: never auto-applied.
    expect(precedents[0].status).toBe("requires_policy_owner_approval");
  });

  it("records the policy owner's approval separately from the reviewer decisions", () => {
    useAppStore.getState().approvePrecedent("PRE-TRV-2.3-CONFERENCE");
    expect(useAppStore.getState().approvedPrecedents).toContain("PRE-TRV-2.3-CONFERENCE");
    useAppStore.getState().declinePrecedent("PRE-TRV-2.3-CONFERENCE");
    expect(useAppStore.getState().approvedPrecedents).not.toContain("PRE-TRV-2.3-CONFERENCE");
    expect(useAppStore.getState().declinedPrecedents).toContain("PRE-TRV-2.3-CONFERENCE");
  });
});

describe("demo reset", () => {
  beforeEach(reset);

  it("clears decisions and audit events but leaves the ledger intact", () => {
    const store = useAppStore.getState();
    store.recordDecision({ record: hotel, action: "approve_exception", note: "x" });
    expect(Object.keys(useAppStore.getState().decisions)).toHaveLength(1);

    useAppStore.getState().resetDemo();
    expect(useAppStore.getState().decisions).toEqual({});
    expect(useAppStore.getState().humanAuditEvents).toHaveLength(0);
    expect(baseCases()).toHaveLength(cases.length);
  });
});

describe("storage key", () => {
  it("is versioned so a schema change cannot corrupt an existing demo", () => {
    expect(STORAGE_KEY).toMatch(/-v\d+$/);
  });
});

const allActions: ReviewAction[] = [
  "approve_exception",
  "request_information",
  "escalate",
  "reject",
  "add_note",
];

describe("every reviewer action", () => {
  beforeEach(reset);

  it("produces exactly one audit event and one decision", () => {
    for (const action of allActions) {
      reset();
      useAppStore.getState().recordDecision({ record: hotel, action, note: "note" });
      expect(useAppStore.getState().humanAuditEvents).toHaveLength(1);
      expect(Object.keys(useAppStore.getState().decisions)).toHaveLength(1);
    }
  });
});
