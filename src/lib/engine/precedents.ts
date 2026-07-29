import type { CaseRecord, ReviewDecision, SuggestedPrecedent } from "../types";

/**
 * Reviewer learning.
 *
 * A single human decision is never converted into policy. Decisions are stored
 * as labelled feedback; when the same decision recurs against the same clause,
 * a precedent is *proposed* here. It only becomes a versioned interpretation
 * once the policy owner approves it, and that approval is itself audited.
 */

/** How many matching decisions before a pattern is worth proposing. */
export const PRECEDENT_THRESHOLD = 2;

/**
 * One precedent is seeded so the mechanism is visible in a fresh demo. It is
 * shown in exactly the same "requires policy-owner approval" state as one
 * earned during the session — nothing about it is pre-approved.
 */
export const seededPrecedent: SuggestedPrecedent = {
  id: "PRE-TRV-2.3-CONFERENCE",
  clauseId: "TRV-2.3",
  summary:
    "Hotel rates above the travel band during a recognised industry conference have been approved as documented exceptions on repeated occasions, where the trip was pre-approved and the folio was attached.",
  summaryAr:
    "جرى اعتماد أسعار الفنادق التي تتجاوز نطاق السفر خلال مؤتمر قطاعي معروف كاستثناءات موثقة في مناسبات متكررة، حيث كانت الرحلة معتمدة مسبقاً وكشف الحساب مرفقاً.",
  supportingTransactionIds: ["TXN-2041"],
  observedCount: 3,
  status: "requires_policy_owner_approval",
  proposedInterpretation:
    "Where a trip is pre-approved and a conference is named on the travel request, accommodation up to 40% above the band may be approved by the Finance Director without a separate exception paper, provided third-party availability evidence is attached.",
  proposedInterpretationAr:
    "عندما تكون الرحلة معتمدة مسبقاً ويُذكر اسم المؤتمر في طلب السفر، يجوز للمدير المالي اعتماد إقامة تتجاوز النطاق بنسبة تصل إلى ٤٠٪ دون ورقة استثناء منفصلة، شريطة إرفاق دليل توافر من طرف ثالث.",
};

/**
 * Groups reviewer decisions by (clause, action) and proposes a precedent once
 * the same pairing has been seen enough times.
 */
export function suggestPrecedents(
  cases: CaseRecord[],
  decisions: Record<string, ReviewDecision>,
): SuggestedPrecedent[] {
  const groups = new Map<string, { clauseId: string; action: string; transactionIds: string[] }>();

  for (const record of cases) {
    const decision = decisions[record.transaction.id];
    if (!decision || decision.action === "add_note") continue;

    const clauseId = record.analysis.citedClauseIds[0];
    if (!clauseId) continue;

    const key = `${clauseId}::${decision.action}`;
    const existing = groups.get(key);
    if (existing) {
      existing.transactionIds.push(record.transaction.id);
    } else {
      groups.set(key, {
        clauseId,
        action: decision.action,
        transactionIds: [record.transaction.id],
      });
    }
  }

  return [...groups.values()]
    .filter((group) => group.transactionIds.length >= PRECEDENT_THRESHOLD)
    .map((group) => ({
      id: `PRE-${group.clauseId}-${group.action}`,
      clauseId: group.clauseId,
      summary: `Reviewers have taken the same decision (${group.action.replace(/_/g, " ")}) on ${group.transactionIds.length} cases citing ${group.clauseId}.`,
      summaryAr: `اتخذ المراجعون القرار نفسه (${group.action.replace(/_/g, " ")}) في ${group.transactionIds.length} حالات تستشهد بالبند ${group.clauseId}.`,
      supportingTransactionIds: group.transactionIds,
      observedCount: group.transactionIds.length,
      status: "requires_policy_owner_approval" as const,
      proposedInterpretation: `Record an interpretation against ${group.clauseId} describing the circumstances in which this outcome is expected, so future cases are assessed consistently.`,
      proposedInterpretationAr: `سجّل تفسيراً على البند ${group.clauseId} يصف الظروف التي يُتوقع فيها هذا الحكم، لضمان تقييم الحالات المستقبلية باتساق.`,
    }));
}
