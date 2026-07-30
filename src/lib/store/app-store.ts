"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AuditEvent,
  CaseRecord,
  CopilotMessage,
  Locale,
  ReviewAction,
  ReviewDecision,
  ReviewStatus,
} from "../types";
import { currentReviewer } from "../data/company";
import { policy } from "../data/policy";
import { baseCases } from "../engine/analysis";
import { isOpen } from "../engine/rules";
import { evidenceLabel } from "../engine/evidence";
import { MOCK_MODEL_VERSION, MOCK_PROMPT_VERSION } from "../ai/mock";

/**
 * All reviewer state lives here and is persisted to localStorage so reviewer state
 * survives a page refresh. The base ledger itself is never mutated — human
 * decisions are layered on top of it.
 */

export const STORAGE_KEY = "spi-state-v1";

export interface Toast {
  id: string;
  title: string;
  body?: string;
  tone: "success" | "info" | "warning";
}

/** Which actions cannot be recorded without a reviewer note. */
export const NOTE_REQUIRED_ACTIONS: ReviewAction[] = [
  "approve_exception",
  "reject",
  "escalate",
  "add_note",
];

export const statusForAction: Record<ReviewAction, ReviewStatus | null> = {
  approve_exception: "approved",
  request_information: "info_requested",
  escalate: "escalated",
  reject: "rejected",
  // A note on its own records context without changing where the case sits.
  add_note: null,
};

const actionLabels: Record<ReviewAction, { en: string; ar: string }> = {
  approve_exception: { en: "Approved exception", ar: "اعتماد استثناء" },
  request_information: { en: "Requested information", ar: "طلب معلومات" },
  escalate: { en: "Escalated for decision", ar: "تصعيد لاتخاذ قرار" },
  reject: { en: "Rejected", ar: "رفض" },
  add_note: { en: "Added reviewer note", ar: "إضافة ملاحظة مراجع" },
};

/**
 * Baseline audit events: what the engine and the narrative layer did before any
 * human touched the case. Generated deterministically from the analysis so the
 * audit trail always reconciles with the ledger.
 */
export function seedAuditEvents(cases: CaseRecord[] = baseCases()): AuditEvent[] {
  const events: AuditEvent[] = [];

  for (const record of cases) {
    const { transaction, analysis } = record;
    const base = Date.parse(transaction.occurredAt);
    const openFindings = analysis.findings.filter(isOpen);

    events.push({
      id: `AUD-${transaction.id}-RULE`,
      timestamp: new Date(base + 4 * 60_000).toISOString(),
      transactionId: transaction.id,
      actor: "Policy rules engine",
      actorRole: "Deterministic evaluation",
      source: "deterministic_rule",
      action:
        openFindings.length === 0
          ? `Evaluated ${analysis.findings.length} applicable clauses — no exception found`
          : `Evaluated ${analysis.findings.length} applicable clauses — ${openFindings.length} ${openFindings.length === 1 ? "requires" : "require"} attention`,
      actionAr:
        openFindings.length === 0
          ? `تقييم ${analysis.findings.length} بنداً منطبقاً — لم يُعثر على استثناء`
          : `تقييم ${analysis.findings.length} بنداً منطبقاً — ${openFindings.length} تتطلب انتباهاً`,
      ruleReference: analysis.findings.map((f) => f.clauseId).join(", "),
      aiExplanation: null,
      policyVersion: policy.version,
      evidenceUsed: analysis.evidence.present.map((k) => evidenceLabel(k, "en")),
      previousStatus: null,
      newStatus: record.status,
      reviewerNote: null,
    });

    events.push({
      id: `AUD-${transaction.id}-AI`,
      timestamp: new Date(base + 5 * 60_000).toISOString(),
      transactionId: transaction.id,
      actor: "Explanation model",
      actorRole: `${MOCK_MODEL_VERSION} · ${MOCK_PROMPT_VERSION}`,
      source: "ai_reasoning",
      action: `Drafted an explanation for human review — verdict ${analysis.verdict}`,
      actionAr: `صياغة شرح للمراجعة البشرية — الحكم "${analysis.verdict}"`,
      ruleReference: null,
      aiExplanation: analysis.headline,
      policyVersion: policy.version,
      evidenceUsed: analysis.evidence.present.map((k) => evidenceLabel(k, "en")),
      previousStatus: null,
      newStatus: null,
      reviewerNote: null,
    });
  }

  return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

interface AppState {
  locale: Locale;
  decisions: Record<string, ReviewDecision>;
  humanAuditEvents: AuditEvent[];
  approvedPrecedents: string[];
  declinedPrecedents: string[];
  sidebarCollapsed: boolean;
  copilotOpen: boolean;
  copilotMessages: CopilotMessage[];
  toasts: Toast[];
  hydrated: boolean;

  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setCopilotOpen: (open: boolean) => void;
  appendCopilotMessage: (message: CopilotMessage) => void;
  clearCopilot: () => void;
  recordDecision: (input: RecordDecisionInput) => void;
  approvePrecedent: (id: string) => void;
  declinePrecedent: (id: string) => void;
  pushToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
  resetAll: () => void;
  markHydrated: () => void;
}

export interface RecordDecisionInput {
  record: CaseRecord;
  action: ReviewAction;
  note: string;
  /** Injected so decisions are testable without depending on wall-clock time. */
  timestamp?: string;
}

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter.toString(36)}-${Math.floor(counter * 7919).toString(36)}`;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      locale: "en",
      decisions: {},
      humanAuditEvents: [],
      approvedPrecedents: [],
      declinedPrecedents: [],
      sidebarCollapsed: false,
      copilotOpen: false,
      copilotMessages: [],
      toasts: [],
      hydrated: false,

      setLocale: (locale) => set({ locale }),
      toggleLocale: () => set((s) => ({ locale: s.locale === "en" ? "ar" : "en" })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setCopilotOpen: (copilotOpen) => set({ copilotOpen }),
      appendCopilotMessage: (message) =>
        set((s) => ({ copilotMessages: [...s.copilotMessages, message] })),
      clearCopilot: () => set({ copilotMessages: [] }),

      recordDecision: ({ record, action, note, timestamp }) =>
        set((state) => {
          const decidedAt = timestamp ?? new Date().toISOString();
          const previousStatus = state.decisions[record.transaction.id]?.status ?? record.status;
          const newStatus = statusForAction[action] ?? previousStatus;

          const decision: ReviewDecision = {
            transactionId: record.transaction.id,
            action,
            status: newStatus,
            reviewer: currentReviewer.name,
            reviewerRole: currentReviewer.role,
            note,
            decidedAt,
          };

          const event: AuditEvent = {
            id: nextId("AUD-HUM"),
            timestamp: decidedAt,
            transactionId: record.transaction.id,
            actor: currentReviewer.name,
            actorRole: currentReviewer.role,
            source: "human_reviewer",
            action: actionLabels[action].en,
            actionAr: actionLabels[action].ar,
            ruleReference: record.analysis.citedClauseIds.join(", "),
            aiExplanation: null,
            policyVersion: policy.version,
            evidenceUsed: record.analysis.evidence.present.map((k) => evidenceLabel(k, "en")),
            previousStatus,
            newStatus,
            reviewerNote: note || null,
          };

          return {
            decisions: { ...state.decisions, [record.transaction.id]: decision },
            humanAuditEvents: [event, ...state.humanAuditEvents],
          };
        }),

      approvePrecedent: (id) =>
        set((s) => ({
          approvedPrecedents: [...new Set([...s.approvedPrecedents, id])],
          declinedPrecedents: s.declinedPrecedents.filter((p) => p !== id),
        })),
      declinePrecedent: (id) =>
        set((s) => ({
          declinedPrecedents: [...new Set([...s.declinedPrecedents, id])],
          approvedPrecedents: s.approvedPrecedents.filter((p) => p !== id),
        })),

      pushToast: (toast) => set((s) => ({ toasts: [...s.toasts, { ...toast, id: nextId("T") }] })),
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      resetAll: () =>
        set({
          decisions: {},
          humanAuditEvents: [],
          approvedPrecedents: [],
          declinedPrecedents: [],
          copilotMessages: [],
        }),

      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Hydration is triggered manually after mount so the server-rendered and
      // first client render always agree.
      skipHydration: true,
      partialize: (state) => ({
        locale: state.locale,
        decisions: state.decisions,
        humanAuditEvents: state.humanAuditEvents,
        approvedPrecedents: state.approvedPrecedents,
        declinedPrecedents: state.declinedPrecedents,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    },
  ),
);

/** Applies persisted human decisions on top of the immutable base cases. */
export function applyDecisions(
  cases: CaseRecord[],
  decisions: Record<string, ReviewDecision>,
): CaseRecord[] {
  return cases.map((record) => {
    const decision = decisions[record.transaction.id];
    if (!decision) return record;
    return { ...record, status: decision.status, decision };
  });
}
