import type { CaseRecord, Locale } from "../types";
import { formatAed } from "../format";
import { companyTotals, departmentBudgets } from "../engine/budget";
import { overlappingLicence } from "../data/policy";
import { company, currentReviewer } from "../data/company";

/**
 * The daily brief.
 *
 * Every sentence is generated from the live case set — there is no stored copy
 * anywhere. If a reviewer approves a case, the brief changes with it.
 */

export interface BriefInsight {
  id: string;
  title: string;
  titleAr: string;
  body: string;
  bodyAr: string;
  severity: "info" | "warning" | "critical";
  /** Where clicking the insight takes the reviewer. */
  href: string;
  transactionIds: string[];
  clauseIds: string[];
}

export interface DailyBrief {
  headline: string;
  headlineAr: string;
  attention: BriefInsight[];
  budgetRisks: BriefInsight[];
  policyExceptions: BriefInsight[];
  missingDocuments: BriefInsight[];
  vendorObservations: BriefInsight[];
  savings: BriefInsight[];
  recommendedActions: BriefInsight[];
  potentialSavingsAed: number;
  mostUrgent: CaseRecord | null;
}

export function buildDailyBrief(cases: CaseRecord[]): DailyBrief {
  const open = cases.filter((c) => c.status === "pending_review");
  const escalations = open.filter((c) => c.analysis.verdict === "escalate");
  const flags = open.filter((c) => c.analysis.verdict === "flag");
  const highRisk = open.filter((c) => c.analysis.riskLevel === "high");
  const missingEvidence = open.filter((c) => c.analysis.evidence.missing.length > 0);
  const noReceipt = open.filter((c) => !c.transaction.receipt);

  const overlapping = cases.filter(
    (c) => c.transaction.category === "software" && overlappingLicence(c.transaction.softwareTool),
  );
  const duplicates = open.filter((c) =>
    c.transaction.related.some((r) => r.relationship === "possible_duplicate"),
  );

  const budgets = departmentBudgets();
  const overBudget = budgets.filter((b) => b.isForecastOverBudget);
  const primaryOverBudget = overBudget[0];

  const subscriptionSavings = overlapping.reduce((sum, c) => sum + c.transaction.amountAed, 0);
  const duplicateExposure = duplicates.length
    ? Math.min(...duplicates.map((c) => c.transaction.amountAed))
    : 0;
  const potentialSavingsAed = subscriptionSavings + duplicateExposure;

  const mostUrgent =
    escalations.sort((a, b) => b.transaction.amountAed - a.transaction.amountAed)[0] ??
    flags[0] ??
    null;

  // The headline is the one line a CFO reads standing up.
  const headline = [
    primaryOverBudget
      ? `${primaryOverBudget.department.name} is forecast to exceed its monthly budget by ${formatAed(primaryOverBudget.varianceAed)}.`
      : "No department is forecast to exceed its monthly budget.",
    escalations.length
      ? `${escalations.length} transaction${escalations.length === 1 ? "" : "s"} require immediate review`
      : "No transactions require immediate review",
    overlapping.length
      ? `, and ${overlapping.length} software subscription${overlapping.length === 1 ? "" : "s"} may overlap with existing licences.`
      : ".",
  ].join(" ").replace(" ,", ",");

  const headlineAr = [
    primaryOverBudget
      ? `يُتوقع أن يتجاوز قسم ${primaryOverBudget.department.nameAr} ميزانيته الشهرية بمقدار ${formatAed(primaryOverBudget.varianceAed, "ar")}.`
      : "لا يُتوقع أن يتجاوز أي قسم ميزانيته الشهرية.",
    escalations.length
      ? `وتتطلب ${escalations.length} معاملات مراجعة فورية`
      : "ولا توجد معاملات تتطلب مراجعة فورية",
    overlapping.length
      ? `، وقد يتداخل ${overlapping.length} اشتراكان في البرمجيات مع تراخيص قائمة.`
      : ".",
  ].join(" ").replace(" ،", "،");

  const attention: BriefInsight[] = [];
  if (escalations.length) {
    attention.push({
      id: "escalations",
      title: `${escalations.length} transactions need an approval decision`,
      titleAr: `${escalations.length} معاملات تحتاج قرار اعتماد`,
      body: `${escalations.map((c) => c.transaction.id).join(", ")} — combined value ${formatAed(escalations.reduce((s, c) => s + c.transaction.amountAed, 0))}. Each has been checked against the policy and is waiting on you.`,
      bodyAr: `${escalations.map((c) => c.transaction.id).join("، ")} — بقيمة إجمالية ${formatAed(escalations.reduce((s, c) => s + c.transaction.amountAed, 0), "ar")}. وقد تمت مطابقة كل منها مع السياسة وهي بانتظار قرارك.`,
      severity: "critical",
      href: "/queue?filter=escalate",
      transactionIds: escalations.map((c) => c.transaction.id),
      clauseIds: [...new Set(escalations.flatMap((c) => c.analysis.citedClauseIds.slice(0, 2)))],
    });
  }
  if (highRisk.length) {
    attention.push({
      id: "high-risk",
      title: `${highRisk.length} open cases are rated high risk`,
      titleAr: `${highRisk.length} حالات مفتوحة مصنفة عالية المخاطر`,
      body: `Risk is raised where the evidence pack is thin relative to the amount, not where the amount alone is large.`,
      bodyAr: `تُرفع درجة المخاطر عندما تكون حزمة الأدلة ضعيفة مقارنة بالمبلغ، وليس عندما يكون المبلغ كبيراً وحده.`,
      severity: "warning",
      href: "/queue?filter=highRisk",
      transactionIds: highRisk.map((c) => c.transaction.id),
      clauseIds: [],
    });
  }

  const budgetRisks: BriefInsight[] = overBudget.map((b) => ({
    id: `budget-${b.department.id}`,
    title: `${b.department.name} forecast ${formatAed(b.varianceAed)} over budget`,
    titleAr: `توقعات ${b.department.nameAr} تتجاوز الميزانية بمقدار ${formatAed(b.varianceAed, "ar")}`,
    body: `${formatAed(b.spentAed)} settled plus ${formatAed(b.committedAed)} committed against a ${formatAed(b.department.monthlyBudgetAed)} budget.`,
    bodyAr: `${formatAed(b.spentAed, "ar")} مسددة إضافة إلى ${formatAed(b.committedAed, "ar")} مرتبطة مقابل ميزانية ${formatAed(b.department.monthlyBudgetAed, "ar")}.`,
    severity: "warning",
    href: `/queue?department=${b.department.id}`,
    transactionIds: [],
    clauseIds: ["GEN-1.2"],
  }));

  const policyExceptions: BriefInsight[] = escalations.map((c) => ({
    id: `exception-${c.transaction.id}`,
    title: c.analysis.headline,
    titleAr: c.analysis.headlineAr,
    body: `${c.transaction.id} · ${c.transaction.merchant} · ${formatAed(c.transaction.amountAed)} · ${c.department.name}`,
    bodyAr: `${c.transaction.id} · ${c.transaction.merchantAr} · ${formatAed(c.transaction.amountAed, "ar")} · ${c.department.nameAr}`,
    severity: "critical",
    href: `/transactions/${c.transaction.id}`,
    transactionIds: [c.transaction.id],
    clauseIds: c.analysis.citedClauseIds.slice(0, 3),
  }));

  const missingDocuments: BriefInsight[] = missingEvidence.length
    ? [
        {
          id: "missing-evidence",
          title: `${missingEvidence.length} open cases are missing required evidence`,
          titleAr: `${missingEvidence.length} حالات مفتوحة تفتقر إلى أدلة مطلوبة`,
          body: `${noReceipt.length} have no receipt attached. A single information request can cover all affected employees.`,
          bodyAr: `${noReceipt.length} منها بلا إيصال مرفق. ويمكن لطلب معلومات واحد أن يغطي جميع الموظفين المعنيين.`,
          severity: "warning",
          href: "/queue?filter=missingEvidence",
          transactionIds: missingEvidence.map((c) => c.transaction.id),
          clauseIds: ["DOC-8.1", "MEA-4.1"],
        },
      ]
    : [];

  const vendorObservations: BriefInsight[] = duplicates.length
    ? [
        {
          id: "duplicates",
          title: `${duplicates.length} settlements to one supplier need reconciliation`,
          titleAr: `${duplicates.length} تسويات لمورد واحد تحتاج إلى تسوية`,
          body: `Same merchant, amounts within 2.5%, three days apart, two cardholders. Clause DUP-9.2 asks for a check before settlement — this is reconciliation, not an allegation.`,
          bodyAr: `المورد نفسه، والمبالغ ضمن ٢٫٥٪، بفارق ثلاثة أيام، وحاملا بطاقة اثنان. ويطلب البند DUP-9.2 إجراء فحص قبل السداد — وهذا إجراء تسوية وليس اتهاماً.`,
          severity: "warning",
          href: `/transactions/${duplicates[0].transaction.id}`,
          transactionIds: duplicates.map((c) => c.transaction.id),
          clauseIds: ["DUP-9.2"],
        },
      ]
    : [];

  const savings: BriefInsight[] = [];
  if (overlapping.length) {
    savings.push({
      id: "overlapping-subscriptions",
      title: `${formatAed(subscriptionSavings)} of subscriptions may duplicate existing licences`,
      titleAr: `${formatAed(subscriptionSavings, "ar")} من الاشتراكات قد تكرر تراخيص قائمة`,
      body: overlapping
        .map((c) => {
          const overlap = overlappingLicence(c.transaction.softwareTool);
          return `${c.transaction.softwareTool} overlaps ${overlap?.tool} (${(overlap?.seats ?? 0) - (overlap?.seatsUsed ?? 0)} unused seats)`;
        })
        .join("; "),
      bodyAr: overlapping
        .map((c) => {
          const overlap = overlappingLicence(c.transaction.softwareTool);
          return `${c.transaction.softwareTool} يتداخل مع ${overlap?.tool} (${(overlap?.seats ?? 0) - (overlap?.seatsUsed ?? 0)} مقعداً غير مستخدم)`;
        })
        .join("؛ "),
      severity: "info",
      href: "/queue?filter=escalate",
      transactionIds: overlapping.map((c) => c.transaction.id),
      clauseIds: ["SUB-6.1"],
    });
  }

  const recommendedActions: BriefInsight[] = open
    .slice()
    .sort((a, b) => {
      const rank = { escalate: 0, flag: 1, pass: 2 } as const;
      return (
        rank[a.analysis.verdict] - rank[b.analysis.verdict] ||
        b.transaction.amountAed - a.transaction.amountAed
      );
    })
    .slice(0, 5)
    .map((c) => ({
      id: `action-${c.transaction.id}`,
      title: c.analysis.recommendedAction.label,
      titleAr: c.analysis.recommendedAction.labelAr,
      body: `${c.transaction.id} · ${c.transaction.merchant} · ${formatAed(c.transaction.amountAed)}`,
      bodyAr: `${c.transaction.id} · ${c.transaction.merchantAr} · ${formatAed(c.transaction.amountAed, "ar")}`,
      severity: c.analysis.verdict === "escalate" ? "critical" : "warning",
      href: `/transactions/${c.transaction.id}`,
      transactionIds: [c.transaction.id],
      clauseIds: c.analysis.citedClauseIds.slice(0, 2),
    }));

  return {
    headline,
    headlineAr,
    attention,
    budgetRisks,
    policyExceptions,
    missingDocuments,
    vendorObservations,
    savings,
    recommendedActions,
    potentialSavingsAed,
    mostUrgent,
  };
}

export type SummaryAudience = "ceo" | "finance" | "manager";

/** Plain-text drafts for the "generate summary" buttons on the brief page. */
export function buildSummary(
  audience: SummaryAudience,
  cases: CaseRecord[],
  locale: Locale,
): string {
  const brief = buildDailyBrief(cases);
  const totals = companyTotals();
  const open = cases.filter((c) => c.status === "pending_review");
  const escalations = open.filter((c) => c.analysis.verdict === "escalate");
  const ar = locale === "ar";
  const money = (n: number) => formatAed(n, locale);

  const disclaimer = ar
    ? "مسودة من إنشاء الذكاء الاصطناعي · راجعها قبل المشاركة. البيانات اصطناعية."
    : "AI-generated draft · Review before sharing. Data is synthetic.";

  if (audience === "ceo") {
    return ar
      ? [
          `إلى: الرئيس التنفيذي`,
          `الموضوع: ملخص الإنفاق — ${company.fiscalPeriodLabelAr}`,
          "",
          `${brief.headlineAr}`,
          "",
          `بلغ إجمالي الإنفاق ${money(totals.totalSpend)} مقابل ميزانية ${money(totals.totalBudget)}. وهناك ${open.length} حالة محجوزة للمراجعة البشرية، منها ${escalations.length} تتطلب قرار اعتماد.`,
          `وقد تصل الوفورات المحتملة إلى ${money(brief.potentialSavingsAed)} إذا تأكد التداخل في التراخيص والتسويات المتشابهة.`,
          "",
          `لم يتخذ النظام أي إجراء مالي. وكل بند مذكور بانتظار قرار من ${currentReviewer.nameAr}.`,
          "",
          disclaimer,
        ].join("\n")
      : [
          `To: Chief Executive Officer`,
          `Subject: Spend summary — ${company.fiscalPeriodLabel}`,
          "",
          brief.headline,
          "",
          `Total spend is ${money(totals.totalSpend)} against a ${money(totals.totalBudget)} budget. ${open.length} records are held for human review, of which ${escalations.length} need an approval decision.`,
          `Potential savings of ${money(brief.potentialSavingsAed)} are available if the licence overlap and the similar settlements are confirmed.`,
          "",
          `No financial action has been taken by the system. Every item listed is awaiting a decision from ${currentReviewer.name}.`,
          "",
          disclaimer,
        ].join("\n");
  }

  if (audience === "finance") {
    const lines = open
      .slice(0, 8)
      .map(
        (c) =>
          `- ${c.transaction.id} · ${ar ? c.transaction.merchantAr : c.transaction.merchant} · ${money(c.transaction.amountAed)} · ${c.analysis.citedClauseIds[0]} · ${ar ? c.analysis.recommendedAction.labelAr : c.analysis.recommendedAction.label}`,
      );
    return ar
      ? [
          `إلى: الفريق المالي`,
          `الموضوع: قائمة المراجعة — ${company.fiscalPeriodLabelAr}`,
          "",
          `${open.length} حالة مفتوحة. الترتيب حسب الأولوية:`,
          ...lines,
          "",
          `الأدلة الناقصة: ${open.filter((c) => c.analysis.evidence.missing.length > 0).length} حالة.`,
          disclaimer,
        ].join("\n")
      : [
          `To: Finance team`,
          `Subject: Review queue — ${company.fiscalPeriodLabel}`,
          "",
          `${open.length} open cases, in priority order:`,
          ...lines,
          "",
          `Missing evidence: ${open.filter((c) => c.analysis.evidence.missing.length > 0).length} cases.`,
          disclaimer,
        ].join("\n");
  }

  const byDepartment = departmentBudgets()
    .map(
      (b) =>
        `- ${ar ? b.department.nameAr : b.department.name}: ${money(b.spentAed)} ${ar ? "من" : "of"} ${money(b.department.monthlyBudgetAed)}${b.isForecastOverBudget ? ar ? " (متوقع تجاوزها)" : " (forecast over)" : ""}`,
    )
    .join("\n");

  return ar
    ? [
        `إلى: مديري الأقسام`,
        `الموضوع: وضع الميزانية — ${company.fiscalPeriodLabelAr}`,
        "",
        byDepartment,
        "",
        `يرجى من الأقسام التي لديها حالات مفتوحة تقديم الأدلة الناقصة قبل إقفال الشهر.`,
        disclaimer,
      ].join("\n")
    : [
        `To: Department managers`,
        `Subject: Budget position — ${company.fiscalPeriodLabel}`,
        "",
        byDepartment,
        "",
        `Departments with open cases are asked to supply the missing evidence before month-end close.`,
        disclaimer,
      ].join("\n");
}
