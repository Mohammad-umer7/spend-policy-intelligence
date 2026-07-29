import type { ClauseCategory, Policy, PolicyClause } from "../types";

/**
 * SYNTHETIC POLICY — a fictional expense policy written for this demonstration.
 * Clause wording is illustrative and is not legal or tax advice.
 */

const clauses: PolicyClause[] = [
  {
    id: "GEN-1.2",
    category: "general_approvals",
    title: "Approval authority thresholds",
    titleAr: "حدود صلاحية الاعتماد",
    text: "Every expense must carry a valid business purpose and be settled against the correct cost centre. Purchases above AED 5,000 require Finance Director approval before settlement. Approval must be recorded in the spend platform and cannot be granted retrospectively by the requester.",
    textAr:
      "يجب أن يكون لكل مصروف غرض تجاري صحيح وأن يُقيَّد على مركز التكلفة الصحيح. تتطلب المشتريات التي تتجاوز ٥٬٠٠٠ درهم موافقة المدير المالي قبل السداد. ويجب تسجيل الموافقة في منصة الإنفاق، ولا يجوز لمقدم الطلب منحها بأثر رجعي.",
    effectiveFrom: "2026-01-01T00:00:00+04:00",
    thresholds: { approvalThresholdAed: 5000 },
    interpretations: [
      {
        id: "INT-GEN-1",
        summary:
          "Approvals captured in the platform within one business day of the transaction are treated as timely.",
        summaryAr:
          "تُعد الموافقات المسجَّلة في المنصة خلال يوم عمل واحد من تاريخ المعاملة موافقات في وقتها.",
        recordedAt: "2026-04-18T11:20:00+04:00",
        recordedBy: "Mariam Al Falasi",
        status: "active",
      },
    ],
  },
  {
    id: "TRV-2.1",
    category: "travel",
    title: "Approved travel request required",
    titleAr: "اشتراط طلب سفر معتمد",
    text: "Business travel must be supported by a travel request approved before the booking date. The request must state the purpose, destination, dates and expected cost. Bookings made without an approved request are held for review.",
    textAr:
      "يجب أن يستند السفر لأغراض العمل إلى طلب سفر معتمد قبل تاريخ الحجز. ويجب أن يوضح الطلب الغرض والوجهة والتواريخ والتكلفة المتوقعة. وتُحجز الحجوزات التي تتم دون طلب معتمد للمراجعة.",
    effectiveFrom: "2026-01-01T00:00:00+04:00",
    interpretations: [],
  },
  {
    id: "TRV-2.3",
    category: "accommodation",
    title: "Hotel accommodation within the approved travel band",
    titleAr: "الإقامة الفندقية ضمن نطاق السفر المعتمد",
    text: "Hotel accommodation must remain within the employee's approved travel band for the trip. Where the band is exceeded, the employee must record the reason and attach supporting evidence, and the Finance Director must approve the difference as a documented exception under clause EXC-10.1.",
    textAr:
      "يجب أن تظل الإقامة الفندقية ضمن نطاق السفر المعتمد للموظف عن الرحلة. وفي حال تجاوز النطاق، يجب على الموظف تسجيل السبب وإرفاق الأدلة المؤيدة، وعلى المدير المالي اعتماد الفرق كاستثناء موثَّق بموجب البند EXC-10.1.",
    effectiveFrom: "2026-01-01T00:00:00+04:00",
    interpretations: [
      {
        id: "INT-TRV-1",
        summary:
          "Conference-period rate surges are an accepted reason for an exception when third-party availability evidence is attached.",
        summaryAr:
          "يُقبل ارتفاع الأسعار خلال فترات المؤتمرات كسبب للاستثناء عند إرفاق دليل توافر من طرف ثالث.",
        recordedAt: "2026-05-02T09:40:00+04:00",
        recordedBy: "Mariam Al Falasi",
        status: "active",
      },
    ],
  },
  {
    id: "MEA-4.1",
    category: "meals",
    title: "Team meals — attendees and business purpose",
    titleAr: "وجبات الفريق — الحضور والغرض التجاري",
    text: "Team meals require the names of all attendees and a documented business purpose. Attendee names are mandatory for any meal above AED 300. Per-head spend should remain reasonable relative to the employee's per-diem band.",
    textAr:
      "تتطلب وجبات الفريق أسماء جميع الحاضرين وغرضاً تجارياً موثقاً. وتُعد أسماء الحاضرين إلزامية لأي وجبة تتجاوز ٣٠٠ درهم. وينبغي أن يظل الإنفاق للفرد معقولاً بالنسبة إلى بدل الإعاشة اليومي للموظف.",
    effectiveFrom: "2026-01-01T00:00:00+04:00",
    thresholds: { attendeeNamesRequiredAboveAed: 300 },
    interpretations: [],
  },
  {
    id: "ENT-4.6",
    category: "client_entertainment",
    title: "Client entertainment pre-approval",
    titleAr: "الموافقة المسبقة على ضيافة العملاء",
    text: "Client entertainment above AED 1,000 requires department head pre-approval, and the client organisation must be recorded against the transaction. Entertainment of government officials is not permitted under any circumstances.",
    textAr:
      "تتطلب ضيافة العملاء التي تتجاوز ١٬٠٠٠ درهم موافقة مسبقة من رئيس القسم، ويجب تسجيل جهة العميل على المعاملة. ولا يُسمح بضيافة الموظفين الحكوميين تحت أي ظرف.",
    effectiveFrom: "2026-01-01T00:00:00+04:00",
    thresholds: { preApprovalAboveAed: 1000 },
    interpretations: [],
  },
  {
    id: "FUE-5.2",
    category: "fuel",
    title: "Fuel purchases and assigned location",
    titleAr: "مشتريات الوقود والموقع المخصص",
    text: "Fuel purchases must align with the employee's assigned location or an approved travel request. Purchases recorded outside the assigned emirate without linked travel or an operational reason are held for review. This clause supports reconciliation and is not a finding of misuse.",
    textAr:
      "يجب أن تتوافق مشتريات الوقود مع الموقع المخصص للموظف أو مع طلب سفر معتمد. وتُحجز المشتريات المسجلة خارج الإمارة المخصصة دون سفر مرتبط أو سبب تشغيلي للمراجعة. ويهدف هذا البند إلى دعم التسوية ولا يُعد إثباتاً لسوء الاستخدام.",
    effectiveFrom: "2026-01-01T00:00:00+04:00",
    interpretations: [
      {
        id: "INT-FUE-1",
        summary:
          "Cross-emirate refuelling on a documented supplier visit is accepted without a formal travel request.",
        summaryAr:
          "يُقبل التزود بالوقود بين الإمارات أثناء زيارة مورد موثقة دون طلب سفر رسمي.",
        recordedAt: "2026-06-09T14:05:00+04:00",
        recordedBy: "Mariam Al Falasi",
        status: "active",
      },
    ],
  },
  {
    id: "TRN-5.7",
    category: "transport",
    title: "Ground transport justification",
    titleAr: "تبرير النقل البري",
    text: "Ground transport above AED 400 for a single journey requires a business justification recorded against the transaction. Shared or scheduled transport should be used where it is operationally practical.",
    textAr:
      "يتطلب النقل البري الذي يتجاوز ٤٠٠ درهم للرحلة الواحدة تبريراً تجارياً مسجلاً على المعاملة. وينبغي استخدام وسائل النقل المشتركة أو المجدولة حيثما كان ذلك عملياً من الناحية التشغيلية.",
    effectiveFrom: "2026-01-01T00:00:00+04:00",
    thresholds: { justificationAboveAed: 400 },
    interpretations: [],
  },
  {
    id: "SUB-6.1",
    category: "software_subscriptions",
    title: "Software checked against the licence register",
    titleAr: "مطابقة البرمجيات مع سجل التراخيص",
    text: "Software purchases must be checked against the active company licence register before approval. Where an enterprise licence already covers the requested capability, the requesting department must confirm in writing why the existing licence cannot meet the requirement.",
    textAr:
      "يجب مطابقة مشتريات البرمجيات مع سجل تراخيص الشركة النشط قبل الاعتماد. وإذا كان هناك ترخيص مؤسسي يغطي القدرة المطلوبة، يجب على القسم الطالب أن يؤكد كتابةً سبب عدم قدرة الترخيص القائم على تلبية الحاجة.",
    effectiveFrom: "2026-01-01T00:00:00+04:00",
    interpretations: [],
  },
  {
    id: "PRC-7.3",
    category: "procurement",
    title: "Competitive quotations",
    titleAr: "عروض الأسعار التنافسية",
    text: "Procurement above AED 10,000 requires three written quotations retained with the purchase record. Single-source purchases require a documented justification approved by the Head of Vendor Management.",
    textAr:
      "تتطلب المشتريات التي تتجاوز ١٠٬٠٠٠ درهم ثلاثة عروض أسعار كتابية تُحفظ مع سجل الشراء. وتتطلب المشتريات من مصدر واحد تبريراً موثقاً معتمداً من رئيس إدارة الموردين.",
    effectiveFrom: "2026-01-01T00:00:00+04:00",
    thresholds: { quotationsRequiredAboveAed: 10000, minimumQuotations: 3 },
    interpretations: [],
  },
  {
    id: "WKD-7.4",
    category: "weekend_spending",
    title: "Weekend spending justification",
    titleAr: "تبرير الإنفاق في عطلة نهاية الأسبوع",
    text: "Expenses incurred on Saturday or Sunday require an operational justification recorded against the transaction. Restaurant locations operating on weekends are expected to record the shift or event the spend relates to.",
    textAr:
      "تتطلب المصروفات المتكبدة يومي السبت والأحد تبريراً تشغيلياً مسجلاً على المعاملة. ويُتوقع من مواقع المطاعم العاملة في عطلة نهاية الأسبوع تسجيل الوردية أو الفعالية التي يتعلق بها الإنفاق.",
    effectiveFrom: "2026-01-01T00:00:00+04:00",
    interpretations: [],
  },
  {
    id: "HOL-7.6",
    category: "public_holiday_spending",
    title: "Public holiday spending",
    titleAr: "الإنفاق في العطل الرسمية",
    text: "Spending on a declared UAE public holiday requires prior approval from the department head. Where approval was not obtained in advance, the department head must confirm the operational need within two business days.",
    textAr:
      "يتطلب الإنفاق في عطلة رسمية معلنة في الدولة موافقة مسبقة من رئيس القسم. وإذا لم يتم الحصول على الموافقة مسبقاً، يجب على رئيس القسم تأكيد الحاجة التشغيلية خلال يومي عمل.",
    effectiveFrom: "2026-01-01T00:00:00+04:00",
    interpretations: [],
  },
  {
    id: "DOC-8.1",
    category: "supporting_documents",
    title: "Receipts and supporting documents",
    titleAr: "الإيصالات والمستندات المؤيدة",
    text: "A receipt or tax invoice is required for every transaction and must be uploaded within seven days. Missing receipts above AED 250 require written manager confirmation of the business purpose before settlement.",
    textAr:
      "يُشترط إيصال أو فاتورة ضريبية لكل معاملة، ويجب رفعه خلال سبعة أيام. وتتطلب الإيصالات المفقودة التي تتجاوز ٢٥٠ درهماً تأكيداً كتابياً من المدير للغرض التجاري قبل السداد.",
    effectiveFrom: "2026-01-01T00:00:00+04:00",
    thresholds: { receiptRequiredAboveAed: 250, uploadWindowDays: 7 },
    interpretations: [],
  },
  {
    id: "DUP-9.2",
    category: "duplicate_transactions",
    title: "Similar transactions review window",
    titleAr: "نافذة مراجعة المعاملات المتشابهة",
    text: "Similar transactions from the same merchant within seven days require review before settlement. A review under this clause is a reconciliation step and does not imply that any duplicate claim has been made.",
    textAr:
      "تتطلب المعاملات المتشابهة من المورد نفسه خلال سبعة أيام مراجعة قبل السداد. والمراجعة بموجب هذا البند هي إجراء تسوية ولا تعني ضمناً وجود أي مطالبة مكررة.",
    effectiveFrom: "2026-01-01T00:00:00+04:00",
    thresholds: { windowDays: 7, amountSimilarityPercent: 10 },
    interpretations: [
      {
        id: "INT-DUP-1",
        summary:
          "Two cardholders settling separate halves of one supplier order is a recognised pattern and clears on confirmation from either cardholder.",
        summaryAr:
          "قيام حاملَي بطاقة بسداد نصفين منفصلين من طلب مورد واحد نمط معروف، ويُغلق عند تأكيد أي منهما.",
        recordedAt: "2026-06-24T16:30:00+04:00",
        recordedBy: "Mariam Al Falasi",
        status: "active",
      },
    ],
  },
  {
    id: "EXC-10.1",
    category: "exceptions",
    title: "Documented exceptions",
    titleAr: "الاستثناءات الموثقة",
    text: "Any exception to this policy requires a documented justification and Finance Director approval. Exceptions are recorded against the employee and the clause, and are reviewed quarterly by the Finance Committee. An approved exception does not change the underlying policy.",
    textAr:
      "يتطلب أي استثناء من هذه السياسة تبريراً موثقاً وموافقة المدير المالي. وتُسجَّل الاستثناءات على الموظف والبند، وتراجعها اللجنة المالية ربع سنوياً. ولا يؤدي الاستثناء المعتمد إلى تغيير السياسة الأساسية.",
    effectiveFrom: "2026-01-01T00:00:00+04:00",
    interpretations: [],
  },
  {
    id: "ESC-11.2",
    category: "escalation",
    title: "Escalation of unresolved items",
    titleAr: "تصعيد البنود غير المحسومة",
    text: "Items that remain unresolved for more than five business days are escalated to the Chief Financial Officer with the full evidence pack and audit history attached.",
    textAr:
      "تُصعَّد البنود التي تبقى دون حسم لأكثر من خمسة أيام عمل إلى الرئيس المالي مع إرفاق حزمة الأدلة الكاملة وسجل التدقيق.",
    effectiveFrom: "2026-01-01T00:00:00+04:00",
    thresholds: { escalateAfterBusinessDays: 5 },
    interpretations: [],
  },
];

export const policy: Policy = {
  id: "POL-NHG-2026",
  documentName: "Northstar Hospitality Group — Employee Expense Policy",
  version: "v4.2",
  status: "published",
  effectiveFrom: "2026-01-01T00:00:00+04:00",
  lastUpdatedAt: "2026-06-28T10:15:00+04:00",
  owner: "Mariam Al Falasi",
  ownerRole: "Finance Director",
  approvedBy: "Finance Committee",
  clauses,
};

export const clauseCategoryLabels: Record<ClauseCategory, { en: string; ar: string }> = {
  general_approvals: { en: "General approvals", ar: "الموافقات العامة" },
  travel: { en: "Travel", ar: "السفر" },
  accommodation: { en: "Accommodation", ar: "الإقامة" },
  meals: { en: "Meals", ar: "الوجبات" },
  client_entertainment: { en: "Client entertainment", ar: "ضيافة العملاء" },
  fuel: { en: "Fuel", ar: "الوقود" },
  transport: { en: "Transport", ar: "النقل" },
  software_subscriptions: { en: "Software subscriptions", ar: "اشتراكات البرمجيات" },
  procurement: { en: "Procurement", ar: "المشتريات" },
  weekend_spending: { en: "Weekend spending", ar: "إنفاق نهاية الأسبوع" },
  public_holiday_spending: { en: "Public holiday spending", ar: "إنفاق العطل الرسمية" },
  supporting_documents: { en: "Supporting documents", ar: "المستندات المؤيدة" },
  duplicate_transactions: { en: "Duplicate transactions", ar: "المعاملات المكررة" },
  exceptions: { en: "Exceptions", ar: "الاستثناءات" },
  escalation: { en: "Escalation", ar: "التصعيد" },
};

const clauseIndex = new Map(clauses.map((c) => [c.id, c]));

export function getClause(id: string): PolicyClause | undefined {
  return clauseIndex.get(id);
}

export function requireClause(id: string): PolicyClause {
  const clause = clauseIndex.get(id);
  if (!clause) throw new Error(`Unknown policy clause: ${id}`);
  return clause;
}

/** Threshold lookup used by the rules engine so numbers live in one place. */
export function threshold(clauseId: string, key: string): number {
  const value = requireClause(clauseId).thresholds?.[key];
  if (value === undefined) {
    throw new Error(`Clause ${clauseId} has no threshold "${key}"`);
  }
  return value;
}

/** The company licence register, used by clause SUB-6.1. */
export interface LicenceRegisterEntry {
  tool: string;
  capability: string;
  capabilityAr: string;
  seats: number;
  seatsUsed: number;
  renewsAt: string;
  annualCostAed: number;
}

export const licenceRegister: LicenceRegisterEntry[] = [
  {
    tool: "Atlas Workspace",
    capability: "Project & task management",
    capabilityAr: "إدارة المشاريع والمهام",
    seats: 400,
    seatsUsed: 213,
    renewsAt: "2027-02-01T00:00:00+04:00",
    annualCostAed: 186_000,
  },
  {
    tool: "Meridian Analytics",
    capability: "Business intelligence dashboards",
    capabilityAr: "لوحات معلومات ذكاء الأعمال",
    seats: 60,
    seatsUsed: 47,
    renewsAt: "2026-11-15T00:00:00+04:00",
    annualCostAed: 94_000,
  },
  {
    tool: "Cedar Design Cloud",
    capability: "Creative asset production",
    capabilityAr: "إنتاج الأصول الإبداعية",
    seats: 25,
    seatsUsed: 25,
    renewsAt: "2026-09-30T00:00:00+04:00",
    annualCostAed: 61_500,
  },
];
