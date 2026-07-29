import type { CaseRecord, CopilotAnswer, Locale, RuleFigure } from "../types";
import { formatAed, formatPercent } from "../format";
import { companyTotals, departmentBudgets } from "../engine/budget";
import { evidenceLabel } from "../engine/evidence";
import { licenceRegister, overlappingLicence } from "../data/policy";
import { company } from "../data/company";

/**
 * A grounded question-answering layer over the synthetic ledger.
 *
 * Every answer is computed from the same functions the dashboard uses, so the
 * copilot can never quote a number the rest of the product disagrees with. It
 * drafts; it never claims to have taken an action.
 */

export interface CopilotContext {
  cases: CaseRecord[];
  /** The case currently open, so "this expense" resolves to something. */
  focusTransactionId?: string;
}

export interface SuggestedQuestion {
  id: string;
  en: string;
  ar: string;
  /** Only offered when a case is open. */
  requiresFocus?: boolean;
}

export const suggestedQuestions: SuggestedQuestion[] = [
  { id: "attention", en: "What needs my attention today?", ar: "ما الذي يحتاج انتباهي اليوم؟" },
  {
    id: "why_escalated",
    en: "Why was this hotel expense escalated?",
    ar: "لماذا تم تصعيد مصروف الفندق هذا؟",
  },
  {
    id: "missing_receipts",
    en: "Show transactions with missing receipts.",
    ar: "اعرض المعاملات التي تفتقر إلى إيصالات.",
  },
  {
    id: "over_budget",
    en: "Which department may exceed budget?",
    ar: "أي قسم قد يتجاوز ميزانيته؟",
  },
  {
    id: "overlapping_subs",
    en: "Which subscriptions may overlap?",
    ar: "أي اشتراكات قد تتداخل؟",
  },
  {
    id: "cfo_summary",
    en: "Summarise this month for the CFO.",
    ar: "لخّص هذا الشهر للرئيس المالي.",
  },
  {
    id: "draft_request",
    en: "Draft a request for missing information.",
    ar: "أعدّ مسودة طلب للمعلومات الناقصة.",
    requiresFocus: true,
  },
  {
    id: "evidence_gap",
    en: "What evidence is missing from this case?",
    ar: "ما الأدلة الناقصة في هذه الحالة؟",
    requiresFocus: true,
  },
  {
    id: "approve_budget",
    en: "Would approving this expense exceed the department budget?",
    ar: "هل سيؤدي اعتماد هذا المصروف إلى تجاوز ميزانية القسم؟",
    requiresFocus: true,
  },
];

function figure(label: string, labelAr: string, value: string): RuleFigure {
  return { label, labelAr, value };
}

type Handler = (ctx: CopilotContext) => CopilotAnswer;

/** Resolves the case a "this…" question refers to. */
function focusCase(ctx: CopilotContext): CaseRecord | undefined {
  if (ctx.focusTransactionId) {
    const match = ctx.cases.find((c) => c.transaction.id === ctx.focusTransactionId);
    if (match) return match;
  }
  return undefined;
}

const needsAttention: Handler = ({ cases }) => {
  const open = cases.filter((c) => c.status === "pending_review");
  const escalations = open.filter((c) => c.analysis.verdict === "escalate");
  const flags = open.filter((c) => c.analysis.verdict === "flag");
  const highRisk = open.filter((c) => c.analysis.riskLevel === "high");
  const totalValue = open.reduce((sum, c) => sum + c.transaction.amountAed, 0);

  return {
    answer: `${open.length} cases are waiting on a human decision, covering ${formatAed(totalValue)} of settled spend. ${escalations.length} need an approval decision from you — ${escalations.map((c) => `${c.transaction.id} (${c.transaction.merchant})`).join(", ")} — and ${flags.length} are held for information or reconciliation. ${highRisk.length} of the open cases are rated high risk. Nothing has been actioned; these are drafts awaiting your decision.`,
    answerAr: `هناك ${open.length} حالة بانتظار قرار بشري، تغطي ${formatAed(totalValue, "ar")} من الإنفاق المسدَّد. وتحتاج ${escalations.length} منها إلى قرار اعتماد منك — ${escalations.map((c) => `${c.transaction.id} (${c.transaction.merchantAr})`).join("، ")} — بينما تُحجز ${flags.length} حالة لطلب معلومات أو لإجراء تسوية. و${highRisk.length} من الحالات المفتوحة مصنفة عالية المخاطر. ولم يُتخذ أي إجراء بعد، فهذه مسودات بانتظار قرارك.`,
    supportingTransactionIds: [...escalations, ...flags].map((c) => c.transaction.id),
    citedClauseIds: [...new Set(open.flatMap((c) => c.analysis.citedClauseIds))].slice(0, 6),
    figures: [
      figure("Open cases", "الحالات المفتوحة", String(open.length)),
      figure("Escalations", "التصعيدات", String(escalations.length)),
      figure("Flags", "حالات المراجعة", String(flags.length)),
      figure("Value under review", "القيمة قيد المراجعة", formatAed(totalValue)),
    ],
    missingInformation: [],
    missingInformationAr: [],
    recommendedNextAction: `Start with the ${escalations.length} escalations — they are the only cases that cannot progress without your approval.`,
    recommendedNextActionAr: `ابدأ بالتصعيدات البالغ عددها ${escalations.length}، فهي الحالات الوحيدة التي لا يمكن أن تتقدم دون موافقتك.`,
  };
};

const whyEscalated: Handler = (ctx) => {
  const focus = focusCase(ctx);
  const record =
    focus && focus.analysis.verdict === "escalate"
      ? focus
      : ctx.cases.find((c) => c.transaction.demoCase === "hotel_above_band");

  if (!record) return unknownAnswer();

  const { analysis, transaction, employee } = record;
  return {
    answer: `${analysis.explanation}`,
    answerAr: `${analysis.explanationAr}`,
    supportingTransactionIds: [
      transaction.id,
      ...transaction.related.map((r) => r.transactionId),
    ],
    citedClauseIds: analysis.citedClauseIds,
    figures: [
      figure("Amount", "المبلغ", formatAed(transaction.amountAed)),
      ...(transaction.category === "accommodation"
        ? [
            figure(
              "Approved band",
              "النطاق المعتمد",
              formatAed(employee.travelBand.hotelNightlyAed * (transaction.nights ?? 1)),
            ),
            figure(
              "Above band",
              "فوق النطاق",
              formatAed(
                transaction.amountAed - employee.travelBand.hotelNightlyAed * (transaction.nights ?? 1),
              ),
            ),
          ]
        : []),
      figure(
        "Evidence",
        "الأدلة",
        `${analysis.evidence.presentCount} of ${analysis.evidence.requiredCount}`,
      ),
      figure("Risk", "المخاطر", analysis.riskLevel),
    ],
    missingInformation: analysis.evidence.missing.map((k) => evidenceLabel(k, "en")),
    missingInformationAr: analysis.evidence.missing.map((k) => evidenceLabel(k, "ar")),
    recommendedNextAction: analysis.recommendedAction.detail,
    recommendedNextActionAr: analysis.recommendedAction.detailAr,
  };
};

const missingReceipts: Handler = ({ cases }) => {
  const matches = cases.filter((c) => !c.transaction.receipt);
  const total = matches.reduce((sum, c) => sum + c.transaction.amountAed, 0);
  const aboveThreshold = matches.filter((c) => c.transaction.amountAed > 250);

  if (matches.length === 0) {
    return {
      answer: "Every transaction in the current period has a receipt or supplier invoice attached.",
      answerAr: "كل معاملة في الفترة الحالية لديها إيصال أو فاتورة مورد مرفقة.",
      supportingTransactionIds: [],
      citedClauseIds: ["DOC-8.1"],
      figures: [figure("Records without a receipt", "سجلات بلا إيصال", "0")],
      missingInformation: [],
      missingInformationAr: [],
      recommendedNextAction: "No action required under clause DOC-8.1.",
      recommendedNextActionAr: "لا يلزم أي إجراء بموجب البند DOC-8.1.",
    };
  }

  return {
    answer: `${matches.length} transactions totalling ${formatAed(total)} have no receipt attached: ${matches.map((c) => `${c.transaction.id} — ${c.transaction.merchant}, ${formatAed(c.transaction.amountAed)}`).join("; ")}. ${aboveThreshold.length} of these are above the ${formatAed(250)} threshold in clause DOC-8.1 and therefore need written manager confirmation of the business purpose before settlement is cleared.`,
    answerAr: `هناك ${matches.length} معاملات بإجمالي ${formatAed(total, "ar")} دون إيصال مرفق: ${matches.map((c) => `${c.transaction.id} — ${c.transaction.merchantAr}، ${formatAed(c.transaction.amountAed, "ar")}`).join("؛ ")}. و${aboveThreshold.length} منها تتجاوز حد ${formatAed(250, "ar")} الوارد في البند DOC-8.1، ومن ثم تحتاج إلى تأكيد كتابي من المدير للغرض التجاري قبل إقفال التسوية.`,
    supportingTransactionIds: matches.map((c) => c.transaction.id),
    citedClauseIds: ["DOC-8.1", "TRN-5.7"],
    figures: [
      figure("Records without a receipt", "سجلات بلا إيصال", String(matches.length)),
      figure("Combined value", "القيمة الإجمالية", formatAed(total)),
      figure("Above threshold", "فوق الحد", String(aboveThreshold.length)),
    ],
    missingInformation: ["Receipt images", "Manager confirmation of business purpose"],
    missingInformationAr: ["صور الإيصالات", "تأكيد المدير للغرض التجاري"],
    recommendedNextAction:
      "Send a single information request covering all affected employees rather than one per case.",
    recommendedNextActionAr:
      "أرسل طلب معلومات واحداً يغطي جميع الموظفين المعنيين بدلاً من طلب لكل حالة.",
  };
};

const overBudget: Handler = () => {
  const budgets = departmentBudgets();
  const over = budgets.filter((b) => b.isForecastOverBudget);
  const closest = [...budgets]
    .filter((b) => !b.isForecastOverBudget)
    .sort((a, b) => b.forecastAed / b.department.monthlyBudgetAed - a.forecastAed / a.department.monthlyBudgetAed)[0];

  if (over.length === 0) {
    return {
      answer: "No department is currently forecast to exceed its monthly budget.",
      answerAr: "لا يُتوقع حالياً أن يتجاوز أي قسم ميزانيته الشهرية.",
      supportingTransactionIds: [],
      citedClauseIds: [],
      figures: [],
      missingInformation: [],
      missingInformationAr: [],
      recommendedNextAction: "Continue monitoring the forecast as commitments settle.",
      recommendedNextActionAr: "واصل مراقبة التوقعات مع تسوية الالتزامات.",
    };
  }

  const primary = over[0];
  return {
    answer: `${primary.department.name} is the only department forecast to exceed its July budget. Month-to-date spend is ${formatAed(primary.spentAed)} against a ${formatAed(primary.department.monthlyBudgetAed)} budget, with a further ${formatAed(primary.committedAed)} already committed. That gives a forecast of ${formatAed(primary.forecastAed)}, or ${formatAed(primary.varianceAed)} over budget. The next closest is ${closest?.department.name ?? "—"}, forecast at ${formatPercent((closest?.forecastAed ?? 0) / (closest?.department.monthlyBudgetAed ?? 1))} of budget and still within it.`,
    answerAr: `${primary.department.nameAr} هو القسم الوحيد المتوقع تجاوزه لميزانية يوليو. فالإنفاق حتى تاريخه ${formatAed(primary.spentAed, "ar")} مقابل ميزانية ${formatAed(primary.department.monthlyBudgetAed, "ar")}، إضافة إلى ${formatAed(primary.committedAed, "ar")} مرتبطة بالفعل. ويعطي ذلك توقعاً قدره ${formatAed(primary.forecastAed, "ar")}، أي ${formatAed(primary.varianceAed, "ar")} فوق الميزانية. ويليه ${closest?.department.nameAr ?? "—"} بتوقع يبلغ ${formatPercent((closest?.forecastAed ?? 0) / (closest?.department.monthlyBudgetAed ?? 1), "ar")} من الميزانية، ولا يزال ضمنها.`,
    supportingTransactionIds: [],
    citedClauseIds: ["GEN-1.2"],
    figures: [
      figure("Department", "القسم", primary.department.name),
      figure("Spent", "المنفَق", formatAed(primary.spentAed)),
      figure("Committed", "المرتبط", formatAed(primary.committedAed)),
      figure("Budget", "الميزانية", formatAed(primary.department.monthlyBudgetAed)),
      figure("Forecast variance", "فرق التوقعات", `+${formatAed(primary.varianceAed)}`),
    ],
    missingInformation: [
      "Whether any committed amount can be deferred into the next period",
    ],
    missingInformationAr: ["ما إذا كان يمكن تأجيل أي مبلغ مرتبط إلى الفترة التالية"],
    recommendedNextAction: `Review the ${primary.department.name} commitments with the department head before approving further discretionary spend.`,
    recommendedNextActionAr: `راجع التزامات ${primary.department.nameAr} مع رئيس القسم قبل اعتماد أي إنفاق تقديري إضافي.`,
  };
};

const overlappingSubscriptions: Handler = ({ cases }) => {
  const matches = cases.filter(
    (c) => c.transaction.category === "software" && overlappingLicence(c.transaction.softwareTool),
  );
  const exposure = matches.reduce((sum, c) => sum + c.transaction.amountAed, 0);

  return {
    answer: `${matches.length} subscriptions request capability the company already licences enterprise-wide. ${matches
      .map((c) => {
        const overlap = overlappingLicence(c.transaction.softwareTool);
        return `${c.transaction.softwareTool} (${formatAed(c.transaction.amountAed)}, ${c.department.name}) overlaps ${overlap?.tool}, which has ${(overlap?.seats ?? 0) - (overlap?.seatsUsed ?? 0)} unused seats`;
      })
      .join("; ")}. Combined annual value is ${formatAed(exposure)}. Clause SUB-6.1 requires each requesting department to confirm in writing why the existing licence cannot meet the requirement — that confirmation has not been received for either.`,
    answerAr: `هناك ${matches.length} اشتراكان يطلبان قدرة تمتلك الشركة ترخيصاً مؤسسياً لها بالفعل. ${matches
      .map((c) => {
        const overlap = overlappingLicence(c.transaction.softwareTool);
        return `${c.transaction.softwareTool} (${formatAed(c.transaction.amountAed, "ar")}، ${c.department.nameAr}) يتداخل مع ${overlap?.tool} الذي لديه ${(overlap?.seats ?? 0) - (overlap?.seatsUsed ?? 0)} مقعداً غير مستخدم`;
      })
      .join("؛ ")}. وتبلغ القيمة السنوية الإجمالية ${formatAed(exposure, "ar")}. ويشترط البند SUB-6.1 أن يؤكد كل قسم طالب كتابةً سبب عدم قدرة الترخيص القائم على تلبية الحاجة، ولم يرد هذا التأكيد في أي منهما.`,
    supportingTransactionIds: matches.map((c) => c.transaction.id),
    citedClauseIds: ["SUB-6.1", "GEN-1.2"],
    figures: [
      figure("Overlapping subscriptions", "اشتراكات متداخلة", String(matches.length)),
      figure("Combined annual value", "القيمة السنوية الإجمالية", formatAed(exposure)),
      ...licenceRegister.map((l) =>
        figure(`${l.tool} unused seats`, `مقاعد ${l.tool} غير المستخدمة`, String(l.seats - l.seatsUsed)),
      ),
    ],
    missingInformation: [
      "Written confirmation of the capability gap from each requesting department",
      "Whether either subscription is already contractually committed",
    ],
    missingInformationAr: [
      "تأكيد كتابي بفجوة القدرات من كل قسم طالب",
      "ما إذا كان أي من الاشتراكين ملتزماً به تعاقدياً بالفعل",
    ],
    recommendedNextAction:
      "Ask both departments to confirm the capability gap before either subscription is approved. If neither gap is substantiated, the combined annual value is avoidable.",
    recommendedNextActionAr:
      "اطلب من القسمين تأكيد فجوة القدرات قبل اعتماد أي من الاشتراكين. وإذا لم تثبت الفجوة في أي منهما، فإن القيمة السنوية الإجمالية قابلة للتفادي.",
  };
};

const cfoSummary: Handler = ({ cases }) => {
  const totals = companyTotals();
  const open = cases.filter((c) => c.status === "pending_review");
  const escalations = open.filter((c) => c.analysis.verdict === "escalate");
  const budgets = departmentBudgets();
  const over = budgets.filter((b) => b.isForecastOverBudget);
  const savings = cases
    .filter((c) => c.transaction.category === "software" && overlappingLicence(c.transaction.softwareTool))
    .reduce((sum, c) => sum + c.transaction.amountAed, 0);

  return {
    answer: `${company.name}, July 2026 month to date. Card and invoice spend is ${formatAed(totals.totalSpend)} against a ${formatAed(totals.totalBudget)} budget, or ${formatPercent(totals.utilisation)} utilisation, with ${formatAed(totals.totalCommitted)} further committed. ${over.length === 1 ? `${over[0].department.name} is the single department forecast to exceed budget, by ${formatAed(over[0].varianceAed)}` : `${over.length} departments are forecast to exceed budget`}. Of ${cases.length} transactions, ${open.length} are held for human review and ${escalations.length} need an approval decision. ${formatAed(savings)} of annual subscription value may be avoidable where new tools overlap existing enterprise licences. No financial action has been taken by the system — every item listed is awaiting a human decision.`,
    answerAr: `${company.nameAr}، يوليو ٢٠٢٦ حتى تاريخه. يبلغ الإنفاق عبر البطاقات والفواتير ${formatAed(totals.totalSpend, "ar")} مقابل ميزانية ${formatAed(totals.totalBudget, "ar")}، أي نسبة استخدام ${formatPercent(totals.utilisation, "ar")}، مع ${formatAed(totals.totalCommitted, "ar")} مرتبطة إضافية. ${over.length === 1 ? `و${over[0].department.nameAr} هو القسم الوحيد المتوقع تجاوزه للميزانية بمقدار ${formatAed(over[0].varianceAed, "ar")}` : `ويُتوقع أن يتجاوز ${over.length} أقسام ميزانياتها`}. ومن أصل ${cases.length} معاملة، هناك ${open.length} محجوزة للمراجعة البشرية و${escalations.length} تحتاج قرار اعتماد. وقد يكون بالإمكان تفادي ${formatAed(savings, "ar")} من القيمة السنوية للاشتراكات حيث تتداخل أدوات جديدة مع تراخيص مؤسسية قائمة. ولم يتخذ النظام أي إجراء مالي، فكل بند مذكور بانتظار قرار بشري.`,
    supportingTransactionIds: escalations.map((c) => c.transaction.id),
    citedClauseIds: ["GEN-1.2", "TRV-2.3", "SUB-6.1"],
    figures: [
      figure("Total spend", "إجمالي الإنفاق", formatAed(totals.totalSpend)),
      figure("Total budget", "إجمالي الميزانية", formatAed(totals.totalBudget)),
      figure("Utilisation", "نسبة الاستخدام", formatPercent(totals.utilisation)),
      figure("Committed", "المرتبط", formatAed(totals.totalCommitted)),
      figure("Open cases", "الحالات المفتوحة", String(open.length)),
      figure("Potential savings", "الوفورات المحتملة", formatAed(savings)),
    ],
    missingInformation: [
      "Payroll, rent and lease costs are outside this ledger",
      "Commitments assume no deferral into August",
    ],
    missingInformationAr: [
      "تكاليف الرواتب والإيجار خارج هذا الدفتر",
      "تفترض الالتزامات عدم التأجيل إلى أغسطس",
    ],
    recommendedNextAction:
      "Draft prepared for human review. Confirm the figures against the general ledger before circulating.",
    recommendedNextActionAr:
      "مسودة مُعدة للمراجعة البشرية. تحقق من الأرقام مقابل دفتر الأستاذ العام قبل التعميم.",
  };
};

const draftRequest: Handler = (ctx) => {
  const record = focusCase(ctx) ?? ctx.cases.find((c) => c.analysis.evidence.missing.length > 0);
  if (!record) return unknownAnswer();

  const { transaction, employee, analysis } = record;
  const missing = analysis.evidence.missing.map((k) => evidenceLabel(k, "en"));
  const missingAr = analysis.evidence.missing.map((k) => evidenceLabel(k, "ar"));

  const body = `Subject: Information needed — ${transaction.id}\n\nHello ${employee.name.split(" ")[0]},\n\nYour ${formatAed(transaction.amountAed)} expense at ${transaction.merchant} on ${transaction.occurredAt.slice(0, 10)} is on hold pending a policy check under clause ${analysis.citedClauseIds[0]}.\n\nTo release it we need: ${missing.join(", ")}.\n\nYou can add this directly to the expense record. If anything above is already attached, reply here and we will reconcile it.\n\nThank you,\nFinance`;
  const bodyAr = `الموضوع: معلومات مطلوبة — ${transaction.id}\n\nمرحباً ${employee.nameAr.split(" ")[0]}،\n\nمصروفك البالغ ${formatAed(transaction.amountAed, "ar")} لدى ${transaction.merchantAr} بتاريخ ${transaction.occurredAt.slice(0, 10)} معلَّق بانتظار فحص السياسة بموجب البند ${analysis.citedClauseIds[0]}.\n\nولإطلاقه نحتاج إلى: ${missingAr.join("، ")}.\n\nيمكنك إضافة ذلك مباشرة إلى سجل المصروف. وإذا كان أي مما سبق مرفقاً بالفعل، فيرجى الرد هنا وسنقوم بالتسوية.\n\nشكراً لك،\nالمالية`;

  return {
    answer: `Draft prepared for human review — not sent.\n\n${body}`,
    answerAr: `مسودة مُعدة للمراجعة البشرية — لم تُرسل.\n\n${bodyAr}`,
    supportingTransactionIds: [transaction.id],
    citedClauseIds: analysis.citedClauseIds.slice(0, 3),
    figures: [
      figure("Transaction", "المعاملة", transaction.id),
      figure("Employee", "الموظف", employee.name),
      figure("Amount", "المبلغ", formatAed(transaction.amountAed)),
    ],
    missingInformation: missing,
    missingInformationAr: missingAr,
    recommendedNextAction:
      "Review the wording, then use “Request information” on the case to record the request in the audit trail.",
    recommendedNextActionAr:
      "راجع الصياغة، ثم استخدم «طلب معلومات» على الحالة لتسجيل الطلب في سجل التدقيق.",
  };
};

const evidenceGap: Handler = (ctx) => {
  const record = focusCase(ctx);
  if (!record) return unknownAnswer();

  const { analysis, transaction } = record;
  const missing = analysis.evidence.missing.map((k) => evidenceLabel(k, "en"));
  const missingAr = analysis.evidence.missing.map((k) => evidenceLabel(k, "ar"));
  const selfReported = transaction.evidence.filter((e) => e.state === "self_reported");

  return {
    answer:
      missing.length === 0
        ? `All ${analysis.evidence.requiredCount} required evidence items are attached to ${transaction.id}.${selfReported.length ? ` One item is self-reported rather than independently evidenced: ${selfReported[0].label}.` : ""}`
        : `${transaction.id} has ${analysis.evidence.presentCount} of ${analysis.evidence.requiredCount} required evidence items. Missing: ${missing.join(", ")}.${selfReported.length ? ` In addition, ${selfReported[0].label.toLowerCase()} — this is self-reported and not independently evidenced.` : ""}`,
    answerAr:
      missing.length === 0
        ? `جميع عناصر الأدلة المطلوبة البالغة ${analysis.evidence.requiredCount} مرفقة بالمعاملة ${transaction.id}.${selfReported.length ? ` وأحد العناصر تصريح ذاتي وليس مدعوماً بدليل مستقل: ${selfReported[0].labelAr}.` : ""}`
        : `تحتوي المعاملة ${transaction.id} على ${analysis.evidence.presentCount} من ${analysis.evidence.requiredCount} من عناصر الأدلة المطلوبة. والناقص: ${missingAr.join("، ")}.${selfReported.length ? ` إضافة إلى ذلك، ${selfReported[0].labelAr} — وهو تصريح ذاتي غير مدعوم بدليل مستقل.` : ""}`,
    supportingTransactionIds: [transaction.id],
    citedClauseIds: analysis.citedClauseIds,
    figures: [
      figure(
        "Evidence completeness",
        "اكتمال الأدلة",
        `${analysis.evidence.presentCount} of ${analysis.evidence.requiredCount}`,
      ),
      figure("Self-reported items", "عناصر بتصريح ذاتي", String(selfReported.length)),
    ],
    missingInformation: missing,
    missingInformationAr: missingAr,
    recommendedNextAction: analysis.recommendedAction.detail,
    recommendedNextActionAr: analysis.recommendedAction.detailAr,
  };
};

const approvalBudgetImpact: Handler = (ctx) => {
  const record = focusCase(ctx) ?? ctx.cases.find((c) => c.transaction.demoCase === "hotel_above_band");
  if (!record) return unknownAnswer();

  const { transaction, department, employee, analysis } = record;
  const b = analysis.budgetImpact;
  const overBand =
    transaction.category === "accommodation"
      ? transaction.amountAed - employee.travelBand.hotelNightlyAed * (transaction.nights ?? 1)
      : 0;

  const verdictSentence = b.wouldExceedBudget
    ? `Yes — but the budget is already forecast to be exceeded before this decision. ${department.name} has spent ${formatAed(b.spentAed)} against a ${formatAed(b.monthlyBudgetAed)} budget, with ${formatAed(b.committedAed)} committed, giving a forecast of ${formatAed(b.forecastAed)} — ${formatAed(b.forecastVarianceAed)} over. The ${formatAed(transaction.amountAed)} card charge has already settled and is inside that ${formatAed(b.spentAed)} figure, so approving the exception adds no new spend. What the approval does is accept ${formatAed(overBand)} above the travel band as a documented exception under clause EXC-10.1, in a department that is already over its forecast.`
    : `No. ${department.name} has spent ${formatAed(b.spentAed)} against a ${formatAed(b.monthlyBudgetAed)} budget with ${formatAed(b.committedAed)} committed, giving a forecast of ${formatAed(b.forecastAed)} and ${formatAed(b.remainingAfterApprovalAed)} of headroom. The ${formatAed(transaction.amountAed)} charge has already settled and is inside that figure, so approving the exception does not change the budget position.`;

  const verdictSentenceAr = b.wouldExceedBudget
    ? `نعم — لكن من المتوقع تجاوز الميزانية بالفعل قبل هذا القرار. فقد أنفق ${department.nameAr} ${formatAed(b.spentAed, "ar")} مقابل ميزانية ${formatAed(b.monthlyBudgetAed, "ar")}، مع ${formatAed(b.committedAed, "ar")} مرتبطة، ما يعطي توقعاً قدره ${formatAed(b.forecastAed, "ar")} — أي ${formatAed(b.forecastVarianceAed, "ar")} فوق الميزانية. وقد سُددت رسوم البطاقة البالغة ${formatAed(transaction.amountAed, "ar")} بالفعل وهي مدرجة ضمن رقم ${formatAed(b.spentAed, "ar")}، لذا فإن اعتماد الاستثناء لا يضيف إنفاقاً جديداً. وما يفعله الاعتماد هو قبول ${formatAed(overBand, "ar")} فوق نطاق السفر كاستثناء موثَّق بموجب البند EXC-10.1، في قسم تجاوز توقعاته أصلاً.`
    : `لا. فقد أنفق ${department.nameAr} ${formatAed(b.spentAed, "ar")} مقابل ميزانية ${formatAed(b.monthlyBudgetAed, "ar")} مع ${formatAed(b.committedAed, "ar")} مرتبطة، ما يعطي توقعاً قدره ${formatAed(b.forecastAed, "ar")} ومتسعاً قدره ${formatAed(b.remainingAfterApprovalAed, "ar")}. وقد سُددت الرسوم البالغة ${formatAed(transaction.amountAed, "ar")} بالفعل وهي مدرجة ضمن ذلك الرقم، لذا فإن اعتماد الاستثناء لا يغير وضع الميزانية.`;

  return {
    answer: verdictSentence,
    answerAr: verdictSentenceAr,
    supportingTransactionIds: [transaction.id, ...transaction.related.map((r) => r.transactionId)],
    citedClauseIds: ["TRV-2.3", "EXC-10.1", "GEN-1.2"],
    figures: [
      figure("Department", "القسم", department.name),
      figure("Spent to date", "المنفَق حتى تاريخه", formatAed(b.spentAed)),
      figure("Committed", "المرتبط", formatAed(b.committedAed)),
      figure("Monthly budget", "الميزانية الشهرية", formatAed(b.monthlyBudgetAed)),
      figure("Forecast", "المتوقع", formatAed(b.forecastAed)),
      figure(
        "Forecast variance",
        "فرق التوقعات",
        `${b.forecastVarianceAed >= 0 ? "+" : ""}${formatAed(b.forecastVarianceAed)}`,
      ),
      ...(overBand > 0 ? [figure("Above travel band", "فوق نطاق السفر", formatAed(overBand))] : []),
    ],
    missingInformation: [
      "Whether any committed amount can be deferred into August",
      "Whether the forum rate surge is recoverable from the event organiser",
    ],
    missingInformationAr: [
      "ما إذا كان يمكن تأجيل أي مبلغ مرتبط إلى أغسطس",
      "ما إذا كان ارتفاع سعر المنتدى قابلاً للاسترداد من منظم الفعالية",
    ],
    recommendedNextAction:
      "If you approve, record the budget position in the reviewer note so the exception and the forecast overrun are linked in the audit trail.",
    recommendedNextActionAr:
      "إذا اعتمدت، فسجّل وضع الميزانية في ملاحظة المراجع ليرتبط الاستثناء وتجاوز التوقعات معاً في سجل التدقيق.",
  };
};

function unknownAnswer(): CopilotAnswer {
  return {
    answer: "__UNKNOWN__",
    answerAr: "__UNKNOWN__",
    supportingTransactionIds: [],
    citedClauseIds: [],
    figures: [],
    missingInformation: [],
    missingInformationAr: [],
    recommendedNextAction: "",
    recommendedNextActionAr: "",
  };
}

interface Intent {
  id: string;
  handler: Handler;
  /** Any one group must match; within a group all terms are alternatives. */
  keywords: string[][];
}

const intents: Intent[] = [
  {
    id: "approve_budget",
    handler: approvalBudgetImpact,
    keywords: [
      ["approv", "اعتماد", "الموافقة"],
      ["budget", "ميزاني"],
    ],
  },
  {
    id: "evidence_gap",
    handler: evidenceGap,
    keywords: [
      ["evidence", "missing", "دليل", "أدلة", "ناقص"],
      ["case", "this", "هذه", "الحالة"],
    ],
  },
  {
    id: "draft_request",
    handler: draftRequest,
    keywords: [["draft", "write", "مسودة", "أعدّ", "اكتب"]],
  },
  {
    id: "missing_receipts",
    handler: missingReceipts,
    keywords: [["receipt", "إيصال", "إيصالات"]],
  },
  {
    id: "overlapping_subs",
    handler: overlappingSubscriptions,
    keywords: [["subscription", "licence", "license", "software", "اشتراك", "ترخيص", "برمجيات"]],
  },
  {
    id: "over_budget",
    handler: overBudget,
    keywords: [["budget", "overspend", "exceed", "ميزاني", "تجاوز"]],
  },
  {
    id: "cfo_summary",
    handler: cfoSummary,
    keywords: [["summar", "cfo", "month", "لخّص", "ملخص", "الرئيس المالي", "الشهر"]],
  },
  {
    id: "why_escalated",
    handler: whyEscalated,
    keywords: [["why", "escalat", "hotel", "لماذا", "تصعيد", "فندق"]],
  },
  {
    id: "attention",
    handler: needsAttention,
    keywords: [["attention", "today", "priorit", "review", "انتباه", "اليوم", "أولوي", "مراجعة"]],
  },
];

/** Scores each intent by how many keyword groups the question satisfies. */
export function resolveIntent(question: string): Intent | null {
  const q = question.toLowerCase();
  let best: { intent: Intent; score: number } | null = null;

  for (const intent of intents) {
    const matched = intent.keywords.filter((group) => group.some((term) => q.includes(term)));
    if (matched.length !== intent.keywords.length) continue;
    // Multi-group intents are more specific, so they win ties.
    const score = intent.keywords.length * 10 + matched.length;
    if (!best || score > best.score) best = { intent, score };
  }

  return best?.intent ?? null;
}

export function answerQuestion(question: string, ctx: CopilotContext): CopilotAnswer | null {
  const intent = resolveIntent(question);
  if (!intent) return null;
  const answer = intent.handler(ctx);
  return answer.answer === "__UNKNOWN__" ? null : answer;
}

export function localiseAnswer(answer: CopilotAnswer, locale: Locale) {
  return {
    text: locale === "ar" ? answer.answerAr : answer.answer,
    missing: locale === "ar" ? answer.missingInformationAr : answer.missingInformation,
    nextAction: locale === "ar" ? answer.recommendedNextActionAr : answer.recommendedNextAction,
  };
}
