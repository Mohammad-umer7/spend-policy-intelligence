import type {
  Employee,
  EvidenceAssessment,
  EvidenceKind,
  RuleFigure,
  RuleFinding,
  Transaction,
  Verdict,
} from "../types";
import { REFERENCE_NOW_MS, dayKey, formatAed, formatWeekday, isWeekend } from "../format";
import { overlappingLicence, publicHolidays, threshold } from "../data/policy";
import { exceedsHotelBand, hotelBandForTrip, isFuelLocationMismatch } from "./evidence";

/**
 * The deterministic policy engine.
 *
 * Every verdict in this product is produced here, from the transaction facts
 * and the published policy thresholds. The AI layer writes the explanation on
 * top of these findings — it never decides the verdict itself. That separation
 * is what makes the audit trail able to say which conclusion came from a rule
 * and which words came from a model.
 */

export interface RuleContext {
  transaction: Transaction;
  employee: Employee;
  evidence: EvidenceAssessment;
}

type Rule = (ctx: RuleContext) => RuleFinding | null;

function figure(label: string, labelAr: string, value: string): RuleFigure {
  return { label, labelAr, value };
}

function hasEvidence(ctx: RuleContext, kind: EvidenceKind): boolean {
  return ctx.transaction.evidence.some((e) => e.kind === kind && e.state === "present");
}

/** Whole business days (excluding Saturday and Sunday) since a timestamp. */
export function businessDaysSince(iso: string, nowMs: number = REFERENCE_NOW_MS): number {
  const start = Date.parse(iso);
  if (Number.isNaN(start) || start >= nowMs) return 0;
  let count = 0;
  const cursor = new Date(start);
  cursor.setUTCHours(cursor.getUTCHours() + 24);
  while (cursor.getTime() <= nowMs) {
    if (!isWeekend(cursor.toISOString())) count += 1;
    cursor.setUTCHours(cursor.getUTCHours() + 24);
  }
  return count;
}

export function isPublicHoliday(iso: string): boolean {
  return publicHolidays.some((h) => h.date === dayKey(iso));
}

// ── GEN-1.2 — approval authority ────────────────────────────────────────────
const approvalAuthority: Rule = ({ transaction }) => {
  const limit = threshold("GEN-1.2", "approvalThresholdAed");
  if (transaction.amountAed <= limit) return null;

  const figures = [
    figure("Amount", "المبلغ", formatAed(transaction.amountAed)),
    figure("Approval threshold", "حد الاعتماد", formatAed(limit)),
  ];

  if (transaction.approval) {
    return {
      clauseId: "GEN-1.2",
      outcome: "satisfied",
      suggestedVerdict: "pass",
      detail: `Approval ${transaction.approval.reference} was recorded by ${transaction.approval.approver} (${transaction.approval.approverRole}) before settlement.`,
      detailAr: `سُجلت الموافقة ${transaction.approval.reference} من ${transaction.approval.approver} (${transaction.approval.approverRole}) قبل السداد.`,
      figures: [...figures, figure("Approved by", "اعتمدها", transaction.approval.approver)],
    };
  }

  return {
    clauseId: "GEN-1.2",
    outcome: "breach",
    suggestedVerdict: "escalate",
    detail: `The amount is above the ${formatAed(limit)} threshold and no Finance Director approval is recorded against the transaction.`,
    detailAr: `يتجاوز المبلغ حد ${formatAed(limit)} ولا توجد موافقة مسجلة من المدير المالي على المعاملة.`,
    figures,
  };
};

// ── TRV-2.1 — approved travel request ───────────────────────────────────────
const travelRequest: Rule = ({ transaction }) => {
  if (transaction.category !== "accommodation" && transaction.category !== "airfare") return null;

  if (transaction.travelRequestId) {
    return {
      clauseId: "TRV-2.1",
      outcome: "satisfied",
      suggestedVerdict: "pass",
      detail: `Travel request ${transaction.travelRequestId} was approved before the booking date.`,
      detailAr: `تمت الموافقة على طلب السفر ${transaction.travelRequestId} قبل تاريخ الحجز.`,
      figures: [figure("Travel request", "طلب السفر", transaction.travelRequestId)],
    };
  }

  return {
    clauseId: "TRV-2.1",
    outcome: "attention",
    suggestedVerdict: "flag",
    detail: "No approved travel request is linked to this booking.",
    detailAr: "لا يوجد طلب سفر معتمد مرتبط بهذا الحجز.",
    figures: [figure("Travel request", "طلب السفر", "Not linked")],
  };
};

// ── TRV-2.3 — hotel within the approved travel band ─────────────────────────
const hotelBand: Rule = ({ transaction, employee }) => {
  if (transaction.category !== "accommodation") return null;

  const band = hotelBandForTrip(transaction, employee);
  const nights = transaction.nights ?? 1;
  const figures = [
    figure("Charged", "المبلغ المحتسب", formatAed(transaction.amountAed)),
    figure("Approved band", "النطاق المعتمد", formatAed(band)),
    figure("Nights", "عدد الليالي", String(nights)),
    figure("Grade", "الدرجة الوظيفية", employee.level),
  ];

  if (!exceedsHotelBand(transaction, employee)) {
    return {
      clauseId: "TRV-2.3",
      outcome: "satisfied",
      suggestedVerdict: "pass",
      detail: `The charge is within the ${formatAed(band)} band for ${nights} night${nights === 1 ? "" : "s"} at ${employee.level} grade.`,
      detailAr: `المبلغ ضمن نطاق ${formatAed(band)} لعدد ${nights} ليلة عند درجة ${employee.level}.`,
      figures,
    };
  }

  const excess = transaction.amountAed - band;
  return {
    clauseId: "TRV-2.3",
    outcome: "breach",
    suggestedVerdict: "escalate",
    detail: `The charge exceeds the approved travel band by ${formatAed(excess)}. Clause TRV-2.3 requires the difference to be approved as a documented exception.`,
    detailAr: `يتجاوز المبلغ نطاق السفر المعتمد بمقدار ${formatAed(excess)}. ويشترط البند TRV-2.3 اعتماد الفرق كاستثناء موثَّق.`,
    figures: [...figures, figure("Above band", "فوق النطاق", formatAed(excess))],
  };
};

// ── MEA-4.1 — team meals ────────────────────────────────────────────────────
const teamMeals: Rule = ({ transaction }) => {
  if (transaction.category !== "meals") return null;
  const limit = threshold("MEA-4.1", "attendeeNamesRequiredAboveAed");
  if (transaction.amountAed <= limit) return null;

  const attendees = transaction.attendeeCount ?? 0;
  const named = transaction.attendeeNames?.length ?? 0;
  const perHead = attendees > 0 ? Math.round(transaction.amountAed / attendees) : null;
  const figures = [
    figure("Amount", "المبلغ", formatAed(transaction.amountAed)),
    figure("Attendees claimed", "الحاضرون المُعلنون", String(attendees)),
    figure("Names provided", "الأسماء المقدَّمة", String(named)),
    ...(perHead !== null ? [figure("Per head", "للفرد", formatAed(perHead))] : []),
  ];

  if (named >= attendees && attendees > 0) {
    return {
      clauseId: "MEA-4.1",
      outcome: "satisfied",
      suggestedVerdict: "pass",
      detail: `All ${attendees} attendees are named and a business purpose is recorded.`,
      detailAr: `جميع الحاضرين البالغ عددهم ${attendees} مذكورون بالاسم، والغرض التجاري مسجل.`,
      figures,
    };
  }

  return {
    clauseId: "MEA-4.1",
    outcome: "attention",
    suggestedVerdict: "flag",
    detail: `${attendees} attendees are claimed but no attendee names are recorded. Clause MEA-4.1 requires names for meals above ${formatAed(limit)}.`,
    detailAr: `تم إعلان ${attendees} حاضرين دون تسجيل أسمائهم. ويشترط البند MEA-4.1 ذكر الأسماء للوجبات التي تتجاوز ${formatAed(limit)}.`,
    figures,
  };
};

// ── ENT-4.6 — client entertainment pre-approval ─────────────────────────────
const clientEntertainment: Rule = ({ transaction }) => {
  if (transaction.category !== "client_entertainment") return null;
  const limit = threshold("ENT-4.6", "preApprovalAboveAed");
  if (transaction.amountAed <= limit) return null;

  const figures = [
    figure("Amount", "المبلغ", formatAed(transaction.amountAed)),
    figure("Pre-approval threshold", "حد الموافقة المسبقة", formatAed(limit)),
  ];

  if (transaction.approval) {
    return {
      clauseId: "ENT-4.6",
      outcome: "satisfied",
      suggestedVerdict: "pass",
      detail: `Pre-approval ${transaction.approval.reference} is recorded and the counterparty is identified in the attendee list.`,
      detailAr: `الموافقة المسبقة ${transaction.approval.reference} مسجلة، والطرف المقابل محدد في قائمة الحاضرين.`,
      figures,
    };
  }

  return {
    clauseId: "ENT-4.6",
    outcome: "attention",
    suggestedVerdict: "flag",
    detail: `No department head pre-approval is recorded for client entertainment above ${formatAed(limit)}.`,
    detailAr: `لا توجد موافقة مسبقة من رئيس القسم لضيافة العملاء التي تتجاوز ${formatAed(limit)}.`,
    figures,
  };
};

// ── FUE-5.2 — fuel and assigned location ────────────────────────────────────
const fuelLocation: Rule = ({ transaction, employee }) => {
  if (transaction.category !== "fuel") return null;

  const figures = [
    figure("Purchase location", "موقع الشراء", transaction.location),
    figure("Assigned location", "الموقع المخصص", employee.assignedLocation),
    figure("Amount", "المبلغ", formatAed(transaction.amountAed)),
  ];

  if (!isFuelLocationMismatch(transaction, employee)) {
    return {
      clauseId: "FUE-5.2",
      outcome: "satisfied",
      suggestedVerdict: "pass",
      detail: transaction.travelRequestId
        ? `The purchase is covered by approved travel request ${transaction.travelRequestId}.`
        : `The purchase is within the employee's assigned emirate.`,
      detailAr: transaction.travelRequestId
        ? `الشراء مشمول بطلب السفر المعتمد ${transaction.travelRequestId}.`
        : `الشراء ضمن الإمارة المخصصة للموظف.`,
      figures,
    };
  }

  return {
    clauseId: "FUE-5.2",
    outcome: "attention",
    suggestedVerdict: "flag",
    detail: `The purchase was recorded in ${transaction.location} while the employee is assigned to ${employee.assignedLocation}, and no travel request is linked. Clause FUE-5.2 asks for operational context before settlement; this is a reconciliation step, not a finding about the employee.`,
    detailAr: `سُجل الشراء في ${transaction.location} بينما الموظف مخصص لـ${employee.assignedLocation}، ولا يوجد طلب سفر مرتبط. ويطلب البند FUE-5.2 سياقاً تشغيلياً قبل السداد، وهو إجراء تسوية وليس استنتاجاً بشأن الموظف.`,
    figures,
  };
};

// ── TRN-5.7 — ground transport justification ────────────────────────────────
const groundTransport: Rule = (ctx) => {
  const { transaction } = ctx;
  if (transaction.category !== "ground_transport") return null;
  const limit = threshold("TRN-5.7", "justificationAboveAed");
  if (transaction.amountAed <= limit) return null;

  const figures = [
    figure("Amount", "المبلغ", formatAed(transaction.amountAed)),
    figure("Justification threshold", "حد التبرير", formatAed(limit)),
  ];

  if (hasEvidence(ctx, "business_purpose")) {
    return {
      clauseId: "TRN-5.7",
      outcome: "satisfied",
      suggestedVerdict: "pass",
      detail: "A business justification is recorded for the journey.",
      detailAr: "يوجد تبرير تجاري مسجل للرحلة.",
      figures,
    };
  }

  return {
    clauseId: "TRN-5.7",
    outcome: "attention",
    suggestedVerdict: "flag",
    detail: `No business justification is recorded for a single journey above ${formatAed(limit)}.`,
    detailAr: `لا يوجد تبرير تجاري مسجل لرحلة واحدة تتجاوز ${formatAed(limit)}.`,
    figures,
  };
};

// ── SUB-6.1 — licence register check ────────────────────────────────────────
const licenceCheck: Rule = (ctx) => {
  const { transaction } = ctx;
  if (transaction.category !== "software") return null;

  if (hasEvidence(ctx, "licence_register_check")) {
    return {
      clauseId: "SUB-6.1",
      outcome: "satisfied",
      suggestedVerdict: "pass",
      detail: `${transaction.softwareTool ?? transaction.merchant} is on the active licence register and this settlement is a renewal of existing capability.`,
      detailAr: `${transaction.softwareTool ?? transaction.merchant} مدرج في سجل التراخيص النشط، وهذه التسوية تجديد لقدرة قائمة.`,
      figures: [figure("Licence register", "سجل التراخيص", "Matched")],
    };
  }

  const overlap = overlappingLicence(transaction.softwareTool);
  if (overlap) {
    const unused = overlap.seats - overlap.seatsUsed;
    return {
      clauseId: "SUB-6.1",
      outcome: "breach",
      suggestedVerdict: "escalate",
      detail: `The company already holds an enterprise licence for ${overlap.tool}, which provides ${overlap.capability.toLowerCase()} with ${unused} unused seats. Clause SUB-6.1 requires written confirmation of why the existing licence cannot meet the requirement before a new subscription is approved.`,
      detailAr: `تمتلك الشركة بالفعل ترخيصاً مؤسسياً لـ${overlap.tool} يوفر ${overlap.capabilityAr} مع ${unused} مقعداً غير مستخدم. ويشترط البند SUB-6.1 تأكيداً كتابياً لسبب عدم قدرة الترخيص القائم على تلبية الحاجة قبل اعتماد اشتراك جديد.`,
      figures: [
        figure("Existing licence", "الترخيص القائم", overlap.tool),
        figure("Unused seats", "مقاعد غير مستخدمة", String(unused)),
        figure("New subscription", "الاشتراك الجديد", formatAed(transaction.amountAed)),
      ],
    };
  }

  return {
    clauseId: "SUB-6.1",
    outcome: "attention",
    suggestedVerdict: "flag",
    detail: "The purchase has not been checked against the active licence register.",
    detailAr: "لم تتم مطابقة الشراء مع سجل التراخيص النشط.",
    figures: [figure("Licence register", "سجل التراخيص", "Not checked")],
  };
};

// ── PRC-7.3 — competitive quotations ────────────────────────────────────────
const QUOTATION_CATEGORIES = new Set([
  "procurement",
  "marketing_services",
  "maintenance",
  "office_supplies",
]);

const quotations: Rule = (ctx) => {
  const { transaction } = ctx;
  if (!QUOTATION_CATEGORIES.has(transaction.category)) return null;
  const limit = threshold("PRC-7.3", "quotationsRequiredAboveAed");
  if (transaction.amountAed <= limit) return null;

  const figures = [
    figure("Amount", "المبلغ", formatAed(transaction.amountAed)),
    figure("Quotation threshold", "حد عروض الأسعار", formatAed(limit)),
    figure("Quotations required", "العروض المطلوبة", String(threshold("PRC-7.3", "minimumQuotations"))),
  ];

  if (hasEvidence(ctx, "quotation")) {
    return {
      clauseId: "PRC-7.3",
      outcome: "satisfied",
      suggestedVerdict: "pass",
      detail: "Competitive quotations are retained with the purchase record.",
      detailAr: "عروض الأسعار التنافسية محفوظة مع سجل الشراء.",
      figures,
    };
  }

  return {
    clauseId: "PRC-7.3",
    outcome: "attention",
    suggestedVerdict: "flag",
    detail: `No quotation file is attached for a purchase above ${formatAed(limit)}.`,
    detailAr: `لا يوجد ملف عروض أسعار مرفق لعملية شراء تتجاوز ${formatAed(limit)}.`,
    figures,
  };
};

// ── WKD-7.4 — weekend spending ──────────────────────────────────────────────
const weekendSpending: Rule = (ctx) => {
  const { transaction } = ctx;
  if (!isWeekend(transaction.occurredAt)) return null;

  const figures = [
    figure("Day", "اليوم", formatWeekday(transaction.occurredAt, "en")),
    figure("Amount", "المبلغ", formatAed(transaction.amountAed)),
  ];

  if (hasEvidence(ctx, "operational_justification")) {
    return {
      clauseId: "WKD-7.4",
      outcome: "satisfied",
      suggestedVerdict: "pass",
      detail: "An operational justification is recorded for the weekend transaction.",
      detailAr: "يوجد تبرير تشغيلي مسجل للمعاملة في عطلة نهاية الأسبوع.",
      figures,
    };
  }

  return {
    clauseId: "WKD-7.4",
    outcome: "attention",
    suggestedVerdict: "flag",
    detail: "The transaction falls on a weekend and no operational justification is recorded.",
    detailAr: "تقع المعاملة في عطلة نهاية الأسبوع ولا يوجد تبرير تشغيلي مسجل.",
    figures,
  };
};

// ── HOL-7.6 — public holiday spending ───────────────────────────────────────
const publicHolidaySpending: Rule = ({ transaction }) => {
  if (!isPublicHoliday(transaction.occurredAt)) return null;

  const figures = [figure("Amount", "المبلغ", formatAed(transaction.amountAed))];

  if (transaction.approval) {
    return {
      clauseId: "HOL-7.6",
      outcome: "satisfied",
      suggestedVerdict: "pass",
      detail: "Prior department head approval is recorded for spending on a public holiday.",
      detailAr: "توجد موافقة مسبقة من رئيس القسم للإنفاق في عطلة رسمية.",
      figures,
    };
  }

  return {
    clauseId: "HOL-7.6",
    outcome: "attention",
    suggestedVerdict: "flag",
    detail: "The transaction falls on a declared public holiday and no prior approval is recorded.",
    detailAr: "تقع المعاملة في عطلة رسمية معلنة ولا توجد موافقة مسبقة مسجلة.",
    figures,
  };
};

// ── DOC-8.1 — supporting documents (always evaluated) ───────────────────────
const supportingDocuments: Rule = (ctx) => {
  const { transaction } = ctx;
  const limit = threshold("DOC-8.1", "receiptRequiredAboveAed");

  if (transaction.receipt) {
    const figures = [
      figure("Receipt", "الإيصال", transaction.receipt.reference),
      figure("Receipt total", "إجمالي الإيصال", formatAed(transaction.receipt.totalAed)),
    ];
    if (transaction.receipt.mismatch) {
      return {
        clauseId: "DOC-8.1",
        outcome: "attention",
        suggestedVerdict: "flag",
        detail: "The receipt total does not reconcile with the settled card amount.",
        detailAr: "إجمالي الإيصال لا يتطابق مع المبلغ المسدد على البطاقة.",
        figures,
      };
    }
    return {
      clauseId: "DOC-8.1",
      outcome: "satisfied",
      suggestedVerdict: "pass",
      detail: "A receipt is attached and reconciles with the settled amount.",
      detailAr: "الإيصال مرفق ويتطابق مع المبلغ المسدد.",
      figures,
    };
  }

  const figures = [
    figure("Amount", "المبلغ", formatAed(transaction.amountAed)),
    figure("Receipt threshold", "حد الإيصال", formatAed(limit)),
  ];

  if (transaction.amountAed > limit) {
    return {
      clauseId: "DOC-8.1",
      outcome: "attention",
      suggestedVerdict: "flag",
      detail: hasEvidence(ctx, "manager_confirmation")
        ? `No receipt is attached, but manager confirmation of the business purpose is on file.`
        : `No receipt is attached and the amount is above ${formatAed(limit)}. Clause DOC-8.1 requires written manager confirmation before settlement.`,
      detailAr: hasEvidence(ctx, "manager_confirmation")
        ? `لا يوجد إيصال مرفق، لكن تأكيد المدير للغرض التجاري محفوظ.`
        : `لا يوجد إيصال مرفق والمبلغ يتجاوز ${formatAed(limit)}. ويشترط البند DOC-8.1 تأكيداً كتابياً من المدير قبل السداد.`,
      figures,
    };
  }

  return {
    clauseId: "DOC-8.1",
    outcome: "attention",
    suggestedVerdict: "pass",
    detail: `No receipt is attached, but the amount is below the ${formatAed(limit)} documentation threshold.`,
    detailAr: `لا يوجد إيصال مرفق، لكن المبلغ أقل من حد التوثيق البالغ ${formatAed(limit)}.`,
    figures,
  };
};

// ── DUP-9.2 — similar transactions ──────────────────────────────────────────
const similarTransactions: Rule = ({ transaction }) => {
  const duplicate = transaction.related.find((r) => r.relationship === "possible_duplicate");
  if (!duplicate) return null;

  return {
    clauseId: "DUP-9.2",
    outcome: "attention",
    suggestedVerdict: "flag",
    detail: `${duplicate.reason}. Clause DUP-9.2 asks for a reconciliation check before settlement. The records may equally represent two legitimate deliveries or one shared order.`,
    detailAr: `${duplicate.reasonAr}. ويطلب البند DUP-9.2 إجراء تسوية قبل السداد. وقد تمثل السجلات عمليتي تسليم مشروعتين أو طلباً واحداً مشتركاً.`,
    figures: [
      figure("Related record", "السجل المرتبط", duplicate.transactionId),
      figure("Review window", "نافذة المراجعة", `${threshold("DUP-9.2", "windowDays")} days`),
    ],
  };
};

// ── ESC-11.2 — ageing items ─────────────────────────────────────────────────
const ageingEscalation: Rule = ({ transaction }) => {
  const limit = threshold("ESC-11.2", "escalateAfterBusinessDays");
  const age = businessDaysSince(transaction.occurredAt);
  if (age <= limit) return null;

  return {
    clauseId: "ESC-11.2",
    outcome: "attention",
    suggestedVerdict: "flag",
    detail: `The item has been open for ${age} business days, beyond the ${limit}-day threshold in clause ESC-11.2.`,
    detailAr: `ظل البند مفتوحاً لمدة ${age} يوم عمل، بما يتجاوز حد ${limit} أيام الوارد في البند ESC-11.2.`,
    figures: [
      figure("Business days open", "أيام العمل المفتوحة", String(age)),
      figure("Escalation threshold", "حد التصعيد", `${limit} days`),
    ],
  };
};

/** Evaluation order also determines the order clauses are cited in the UI. */
const rules: Rule[] = [
  hotelBand,
  licenceCheck,
  approvalAuthority,
  similarTransactions,
  teamMeals,
  fuelLocation,
  quotations,
  clientEntertainment,
  travelRequest,
  groundTransport,
  weekendSpending,
  publicHolidaySpending,
  supportingDocuments,
];

/**
 * A finding is "open" when it actually changes the verdict. Some clauses record
 * an observation without asking for anything — a missing receipt below the
 * documentation threshold, for example — and those must not make a record look
 * like it needs review.
 */
export function isOpen(finding: RuleFinding): boolean {
  return finding.outcome !== "satisfied" && finding.suggestedVerdict !== "pass";
}

export function evaluateRules(ctx: RuleContext): RuleFinding[] {
  const findings = rules.map((rule) => rule(ctx)).filter((f): f is RuleFinding => f !== null);

  // ESC-11.2 is about items that remain *unresolved*. A compliant record that
  // simply happens to be old is not an escalation, so the ageing clause is only
  // evaluated once something else is already open.
  if (findings.some(isOpen)) {
    const ageing = ageingEscalation(ctx);
    if (ageing) findings.push(ageing);
  }

  return findings;
}

const verdictRank: Record<Verdict, number> = { pass: 0, flag: 1, escalate: 2 };

export function aggregateVerdict(findings: RuleFinding[]): Verdict {
  return findings
    .filter(isOpen)
    .reduce<Verdict>(
      (worst, f) => (verdictRank[f.suggestedVerdict] > verdictRank[worst] ? f.suggestedVerdict : worst),
      "pass",
    );
}

export function riskLevel(
  verdict: Verdict,
  completeness: number,
  amountAed: number,
  attentionCount: number,
): "low" | "medium" | "high" {
  let risk: "low" | "medium" | "high";

  if (verdict === "pass") {
    risk = "low";
  } else if (verdict === "escalate") {
    // Strong supporting evidence lowers the risk of an exception being wrong,
    // even though it still requires a human decision.
    risk = completeness >= 0.75 ? "medium" : "high";
  } else if (completeness < 0.5) {
    risk = "high";
  } else if (amountAed >= 1_000 || attentionCount >= 2) {
    risk = "medium";
  } else {
    risk = "low";
  }

  // Small-value items are never presented as high risk on their own.
  if (risk === "high" && amountAed < 500) risk = "medium";
  return risk;
}
