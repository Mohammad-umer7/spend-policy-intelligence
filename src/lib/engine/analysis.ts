import type {
  AIAnalysis,
  CaseRecord,
  RecommendedAction,
  ReviewStatus,
  RuleFinding,
  Transaction,
} from "../types";
import { getDepartment, getEmployee } from "../data/company";
import { transactions } from "../data/transactions";
import { hoursSince } from "../format";
import { MOCK_MODEL_VERSION, MOCK_PROMPT_VERSION, mockNarrative } from "../ai/mock";
import { assessEvidence } from "./evidence";
import { aggregateVerdict, evaluateRules, isOpen, riskLevel } from "./rules";
import { budgetImpact } from "./budget";

/**
 * Assembles the full assessment shown on the investigation screen: the
 * deterministic findings, the evidence position, the budget position, and the
 * narrative written on top of them.
 */

/** Clause → recommended action, in the order the reviewer should act on them. */
const actionByClause: Record<string, RecommendedAction> = {
  "TRV-2.3": {
    key: "request_finance_director_approval",
    label: "Request Finance Director approval",
    labelAr: "طلب موافقة المديرة المالية",
    detail:
      "The amount above the travel band needs approving as a documented exception under clause EXC-10.1 before settlement is cleared.",
    detailAr:
      "يحتاج المبلغ الذي يتجاوز نطاق السفر إلى اعتماد كاستثناء موثَّق بموجب البند EXC-10.1 قبل إقفال التسوية.",
  },
  "SUB-6.1": {
    key: "confirm_existing_licence",
    label: "Confirm whether the existing licence can meet the requirement",
    labelAr: "تأكيد ما إذا كان الترخيص القائم يلبي الحاجة",
    detail:
      "Ask the requesting department to confirm in writing why the existing enterprise licence cannot cover the need, before the new subscription is approved.",
    detailAr:
      "اطلب من القسم الطالب تأكيداً كتابياً لسبب عدم تغطية الترخيص المؤسسي القائم للحاجة، قبل اعتماد الاشتراك الجديد.",
  },
  "GEN-1.2": {
    key: "request_finance_director_approval",
    label: "Request Finance Director approval",
    labelAr: "طلب موافقة المديرة المالية",
    detail:
      "The amount is above the approval threshold and no approval is recorded against the transaction.",
    detailAr: "يتجاوز المبلغ حد الاعتماد ولا توجد موافقة مسجلة على المعاملة.",
  },
  "DUP-9.2": {
    key: "review_possible_duplicate",
    label: "Reconcile against the related record",
    labelAr: "تسوية السجل مقابل السجل المرتبط",
    detail:
      "Confirm with either cardholder whether the two settlements cover separate deliveries or one shared order.",
    detailAr:
      "تأكد مع أي من حاملَي البطاقة ما إذا كانت التسويتان تغطيان عمليتي تسليم منفصلتين أم طلباً واحداً مشتركاً.",
  },
  "MEA-4.1": {
    key: "request_attendee_details",
    label: "Request attendee details",
    labelAr: "طلب تفاصيل الحاضرين",
    detail: "Ask the employee to add the names of the attendees to the expense record.",
    detailAr: "اطلب من الموظف إضافة أسماء الحاضرين إلى سجل المصروف.",
  },
  "FUE-5.2": {
    key: "request_travel_context",
    label: "Request travel or operational context",
    labelAr: "طلب سياق السفر أو السياق التشغيلي",
    detail:
      "Ask the employee to record the operational reason for refuelling outside the assigned emirate.",
    detailAr: "اطلب من الموظف تسجيل السبب التشغيلي للتزود بالوقود خارج الإمارة المخصصة.",
  },
  "PRC-7.3": {
    key: "request_quotations",
    label: "Request the quotation file",
    labelAr: "طلب ملف عروض الأسعار",
    detail:
      "Ask Procurement to attach the competitive quotations, or a documented single-source justification.",
    detailAr:
      "اطلب من المشتريات إرفاق عروض الأسعار التنافسية أو تبرير موثق للشراء من مصدر واحد.",
  },
  "ENT-4.6": {
    key: "request_finance_director_approval",
    label: "Request department head pre-approval",
    labelAr: "طلب موافقة مسبقة من رئيس القسم",
    detail: "Client entertainment above the threshold needs a recorded pre-approval.",
    detailAr: "تحتاج ضيافة العملاء فوق الحد إلى موافقة مسبقة مسجلة.",
  },
  "TRV-2.1": {
    key: "request_travel_context",
    label: "Request the approved travel request",
    labelAr: "طلب طلب السفر المعتمد",
    detail: "Ask the employee to link the approved travel request to the booking.",
    detailAr: "اطلب من الموظف ربط طلب السفر المعتمد بالحجز.",
  },
  "TRN-5.7": {
    key: "request_operational_justification",
    label: "Request a business justification",
    labelAr: "طلب تبرير تجاري",
    detail: "Ask the employee to record why the journey was necessary at this cost.",
    detailAr: "اطلب من الموظف تسجيل سبب ضرورة الرحلة بهذه التكلفة.",
  },
  "WKD-7.4": {
    key: "request_operational_justification",
    label: "Request an operational justification",
    labelAr: "طلب تبرير تشغيلي",
    detail: "Ask the employee to record the shift or event the weekend spend relates to.",
    detailAr: "اطلب من الموظف تسجيل الوردية أو الفعالية التي يتعلق بها إنفاق نهاية الأسبوع.",
  },
  "HOL-7.6": {
    key: "request_operational_justification",
    label: "Request department head confirmation",
    labelAr: "طلب تأكيد رئيس القسم",
    detail: "Public holiday spending needs the department head to confirm the operational need.",
    detailAr: "يحتاج الإنفاق في العطل الرسمية إلى تأكيد رئيس القسم للحاجة التشغيلية.",
  },
  "DOC-8.1": {
    key: "request_missing_receipt",
    label: "Request the missing receipt",
    labelAr: "طلب الإيصال المفقود",
    detail:
      "Ask the employee to upload the receipt, or obtain written manager confirmation of the business purpose.",
    detailAr:
      "اطلب من الموظف رفع الإيصال، أو الحصول على تأكيد كتابي من المدير للغرض التجاري.",
  },
  "ESC-11.2": {
    key: "request_operational_justification",
    label: "Escalate the ageing item",
    labelAr: "تصعيد البند المتقادم",
    detail: "The item is beyond the five business day threshold and should be escalated.",
    detailAr: "تجاوز البند حد خمسة أيام عمل وينبغي تصعيده.",
  },
};

const noActionRequired: RecommendedAction = {
  key: "no_action_required",
  label: "No action required",
  labelAr: "لا يلزم أي إجراء",
  detail: "Every applicable clause is satisfied and the evidence pack is complete.",
  detailAr: "جميع البنود المنطبقة مستوفاة وحزمة الأدلة كاملة.",
};

function deriveRecommendedAction(findings: RuleFinding[]): RecommendedAction {
  const open = findings.filter(isOpen);
  // Breaches outrank items merely needing attention.
  const primary = open.find((f) => f.outcome === "breach") ?? open[0];
  if (!primary) return noActionRequired;
  return actionByClause[primary.clauseId] ?? noActionRequired;
}

export function analyseTransaction(
  transaction: Transaction,
  ledger: Transaction[] = transactions,
): AIAnalysis {
  const employee = getEmployee(transaction.employeeId);
  const evidence = assessEvidence(transaction, employee);
  const findings = evaluateRules({ transaction, employee, evidence });
  const verdict = aggregateVerdict(findings);
  const budget = budgetImpact(transaction, ledger);

  const attentionCount = findings.filter(isOpen).length;
  const risk = riskLevel(verdict, evidence.completeness, transaction.amountAed, attentionCount);

  const narrative = mockNarrative({ transaction, employee, findings, evidence, budget, verdict });

  // Cited clauses put the open items first, then the clauses that were checked
  // and satisfied, so the reviewer reads the reason before the reassurance.
  const citedClauseIds = [
    ...findings.filter(isOpen).map((f) => f.clauseId),
    ...findings.filter((f) => !isOpen(f)).map((f) => f.clauseId),
  ];
  // An approved exception is always granted under EXC-10.1, so cite it too.
  if (findings.some((f) => f.outcome === "breach") && !citedClauseIds.includes("EXC-10.1")) {
    citedClauseIds.push("EXC-10.1");
  }

  const selfReported = transaction.evidence.find((e) => e.state === "self_reported");

  return {
    transactionId: transaction.id,
    verdict,
    riskLevel: risk,
    findings,
    citedClauseIds,
    headline: narrative.headline,
    headlineAr: narrative.headlineAr,
    explanation: narrative.explanation,
    explanationAr: narrative.explanationAr,
    evidence,
    budgetImpact: budget,
    recommendedAction: deriveRecommendedAction(findings),
    humanReviewRequired: verdict !== "pass",
    uncertainty: selfReported?.caveat ?? null,
    uncertaintyAr: selfReported?.caveatAr ?? null,
    policyCoverage: findings.length > 0 ? "complete" : "partial",
    generatedBy: "mock",
    promptVersion: MOCK_PROMPT_VERSION,
    modelVersion: MOCK_MODEL_VERSION,
  };
}

/** Status a case starts in, before any human has touched it. */
export function initialStatus(verdict: AIAnalysis["verdict"]): ReviewStatus {
  return verdict === "pass" ? "cleared" : "pending_review";
}

/** Builds every case once; the store layers human decisions on top. */
export function buildCases(ledger: Transaction[] = transactions): CaseRecord[] {
  return ledger.map((transaction) => {
    const employee = getEmployee(transaction.employeeId);
    const analysis = analyseTransaction(transaction, ledger);
    return {
      transaction,
      employee,
      department: getDepartment(employee.departmentId),
      analysis,
      status: initialStatus(analysis.verdict),
      decision: null,
      ageHours: hoursSince(transaction.occurredAt),
    };
  });
}

/** Memoised base case set — the synthetic ledger never changes at runtime. */
let cachedCases: CaseRecord[] | null = null;

export function baseCases(): CaseRecord[] {
  if (!cachedCases) cachedCases = buildCases();
  return cachedCases;
}

export function baseCaseById(id: string): CaseRecord | undefined {
  return baseCases().find((c) => c.transaction.id === id);
}
