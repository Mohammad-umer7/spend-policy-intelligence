import type {
  BudgetImpact,
  Employee,
  EvidenceAssessment,
  RuleFinding,
  Transaction,
  Verdict,
} from "../types";
import { formatAed } from "../format";
import { evidenceLabel } from "../engine/evidence";
import { isOpen } from "../engine/rules";

/**
 * Deterministic narrative layer.
 *
 * The mock provider writes the human-readable explanation from findings the
 * deterministic engine has already produced. It never chooses a verdict, and it
 * never introduces a figure that is not present in the findings — which is
 * exactly the constraint the Claude provider is held to as well.
 */

export interface NarrativeInput {
  transaction: Transaction;
  employee: Employee;
  findings: RuleFinding[];
  evidence: EvidenceAssessment;
  budget: BudgetImpact;
  verdict: Verdict;
}

export interface Narrative {
  headline: string;
  headlineAr: string;
  explanation: string;
  explanationAr: string;
}

/**
 * Hand-authored narratives for the five scripted demo cases. Every claim below
 * is traceable to a rule finding or an evidence item on the record.
 */
function scriptedNarrative(input: NarrativeInput): Narrative | null {
  const { transaction, employee } = input;

  switch (transaction.demoCase) {
    case "hotel_above_band": {
      const band = employee.travelBand.hotelNightlyAed * (transaction.nights ?? 1);
      const excess = transaction.amountAed - band;
      return {
        headline: `Hotel charge is ${formatAed(excess)} above the approved travel band`,
        headlineAr: `تكلفة الفندق تتجاوز نطاق السفر المعتمد بمقدار ${formatAed(excess)}`,
        explanation: `This hotel expense exceeds ${employee.name}'s approved travel band by ${formatAed(excess)} (${formatAed(transaction.amountAed)} charged against a ${formatAed(band)} band for ${transaction.nights} nights at ${employee.level} grade). The trip itself was approved in advance under travel request ${transaction.travelRequestId}, the folio and booking confirmation are both attached, and the department has an approved forum attendance. The expense note states that standard rooms were unavailable during the forum, but that statement has not been corroborated by third-party availability evidence. Under clause TRV-2.3 the difference must be approved as a documented exception by the Finance Director; it is not a decision the system can take.`,
        explanationAr: `يتجاوز هذا المصروف الفندقي نطاق السفر المعتمد لـ${employee.nameAr} بمقدار ${formatAed(excess, "ar")} (تم احتساب ${formatAed(transaction.amountAed, "ar")} مقابل نطاق ${formatAed(band, "ar")} لعدد ${transaction.nights} ليلتين عند درجة ${employee.level}). وقد تمت الموافقة على الرحلة مسبقاً بموجب طلب السفر ${transaction.travelRequestId}، وكشف الحساب وتأكيد الحجز مرفقان، وحضور المنتدى معتمد للقسم. وتذكر ملاحظة المصروف أن الغرف العادية لم تكن متاحة خلال المنتدى، إلا أن هذا التصريح غير مدعوم بدليل توافر من طرف ثالث. وبموجب البند TRV-2.3 يجب اعتماد الفرق كاستثناء موثَّق من المديرة المالية، وهو قرار لا يمكن للنظام اتخاذه.`,
      };
    }

    case "possible_duplicate": {
      const link = transaction.related.find((r) => r.relationship === "possible_duplicate");
      return {
        headline: "Two similar settlements to the same supplier need reconciliation",
        headlineAr: "تسويتان متشابهتان للمورد نفسه تحتاجان إلى تسوية",
        explanation: `This record and ${link?.transactionId ?? "a related record"} were both settled to ${transaction.merchant} within the seven-day window in clause DUP-9.2, for amounts within 2.5% of each other, by two different cardholders, with adjacent delivery-note references. That pattern is consistent with a duplicate settlement, and it is equally consistent with two legitimate weekly deliveries to different location clusters — the northern emirates order is routinely raised separately from the Dubai order. The system cannot distinguish between those readings from the data available, so both records are held for a human reviewer to reconcile. No conclusion about any individual is implied.`,
        explanationAr: `سُوِّي هذا السجل والسجل ${link?.transactionId ?? "المرتبط"} لصالح ${transaction.merchantAr} خلال نافذة السبعة أيام الواردة في البند DUP-9.2، بمبلغين لا يتجاوز الفارق بينهما ٢٫٥٪، من قِبل حاملَي بطاقة مختلفين، وبأرقام إشعارات تسليم متتالية. وهذا النمط يتوافق مع احتمال ازدواج التسوية، كما يتوافق تماماً مع عمليتي تسليم أسبوعيتين مشروعتين لمجموعتي مواقع مختلفتين، إذ يُرفع طلب الإمارات الشمالية عادةً بشكل منفصل عن طلب دبي. ولا يستطيع النظام التمييز بين القراءتين من البيانات المتاحة، لذا يُحجز السجلان ليقوم مراجع بشري بالتسوية. ولا يُستنتج أي حكم بشأن أي فرد.`,
      };
    }

    case "weekend_team_meal": {
      return {
        headline: "Weekend team meal is missing the attendee names",
        headlineAr: "وجبة الفريق في عطلة نهاية الأسبوع تفتقر إلى أسماء الحاضرين",
        explanation: `A ${formatAed(transaction.amountAed)} team meal was settled on a Saturday for ${transaction.attendeeCount} claimed attendees. The business purpose is recorded — a summer menu service handover between two shift teams — and the Saturday shift appears on the roster, which satisfies the operational justification required by clause WKD-7.4. What is missing is the attendee names, which clause MEA-4.1 requires for any meal above ${formatAed(300)}. At ${formatAed(Math.round(transaction.amountAed / (transaction.attendeeCount ?? 1)))} per head the amount is within a reasonable range for the grade, so the only open item is the documentation. A human reviewer decides whether to request the names or clear the record.`,
        explanationAr: `سُوِّيت وجبة فريق بقيمة ${formatAed(transaction.amountAed, "ar")} يوم السبت لعدد ${transaction.attendeeCount} حاضرين مُعلنين. والغرض التجاري مسجل — تسليم خدمة قائمة الصيف بين فريقي ورديتين — ووردية السبت مدرجة في جدول الورديات، وهو ما يستوفي التبرير التشغيلي الذي يشترطه البند WKD-7.4. والناقص هو أسماء الحاضرين التي يشترطها البند MEA-4.1 لأي وجبة تتجاوز ${formatAed(300, "ar")}. وبمعدل ${formatAed(Math.round(transaction.amountAed / (transaction.attendeeCount ?? 1)), "ar")} للفرد يقع المبلغ ضمن نطاق معقول للدرجة الوظيفية، وبذلك يبقى التوثيق هو البند الوحيد المفتوح. ويقرر المراجع البشري ما إذا كان سيطلب الأسماء أم يُقفل السجل.`,
      };
    }

    case "fuel_location_mismatch": {
      return {
        headline: "Fuel purchase recorded outside the assigned emirate",
        headlineAr: "شراء وقود مسجل خارج الإمارة المخصصة",
        explanation: `A ${formatAed(transaction.amountAed)} fuel purchase was recorded in ${transaction.location} while ${employee.name} is rostered to ${employee.assignedLocation}, and no travel request is linked to the date. Clause FUE-5.2 asks for the operational context in this situation. There are ordinary explanations — a supplier visit, covering another location, or a route through the emirate — and a previous interpretation recorded against this clause accepts cross-emirate refuelling on a documented supplier visit without a formal travel request. The record simply needs that context added; nothing here indicates misuse, and a human reviewer decides how to resolve it.`,
        explanationAr: `سُجل شراء وقود بقيمة ${formatAed(transaction.amountAed, "ar")} في ${transaction.location} بينما ${employee.nameAr} مخصص لـ${employee.assignedLocation}، ولا يوجد طلب سفر مرتبط بالتاريخ. ويطلب البند FUE-5.2 السياق التشغيلي في هذه الحالة. وهناك تفسيرات اعتيادية — زيارة مورد، أو تغطية موقع آخر، أو مرور عبر الإمارة — كما أن تفسيراً سابقاً مسجلاً على هذا البند يقبل التزود بالوقود بين الإمارات أثناء زيارة مورد موثقة دون طلب سفر رسمي. ويحتاج السجل ببساطة إلى إضافة ذلك السياق، ولا يوجد فيه ما يشير إلى سوء استخدام.`,
      };
    }

    case "overlapping_subscription": {
      const overlap = transaction.related.find((r) => r.relationship === "overlapping_tool");
      return {
        headline: `New subscription overlaps an existing enterprise licence`,
        headlineAr: `اشتراك جديد يتداخل مع ترخيص مؤسسي قائم`,
        explanation: `${transaction.softwareTool ?? transaction.merchant} was purchased for ${formatAed(transaction.amountAed)} to cover a capability the company already licences enterprise-wide, and the licence register shows unused seats on the existing agreement. ${overlap ? `The overlap is with ${overlap.reason.replace(/^[A-Z]/, (c) => c.toLowerCase())}. ` : ""}Clause SUB-6.1 requires the requesting department to confirm in writing why the existing licence cannot meet the requirement before a new subscription is approved. That confirmation has not been provided, and the licence register check has not been run against this purchase. The decision on whether the existing tool is genuinely unsuitable belongs to the policy owner, not to this system.`,
        explanationAr: `تم شراء ${transaction.softwareTool ?? transaction.merchant} بمبلغ ${formatAed(transaction.amountAed, "ar")} لتغطية قدرة تمتلك الشركة ترخيصاً مؤسسياً لها بالفعل، ويُظهر سجل التراخيص وجود مقاعد غير مستخدمة في الاتفاقية القائمة. ${overlap ? `ويتمثل التداخل في أن ${overlap.reasonAr}. ` : ""}ويشترط البند SUB-6.1 أن يؤكد القسم الطالب كتابةً سبب عدم قدرة الترخيص القائم على تلبية الحاجة قبل اعتماد اشتراك جديد. ولم يُقدَّم هذا التأكيد، ولم تُجرَ مطابقة سجل التراخيص على هذا الشراء. ويعود قرار ما إذا كانت الأداة القائمة غير مناسبة فعلاً إلى مالك السياسة، لا إلى هذا النظام.`,
      };
    }

    default:
      return null;
  }
}

/** Template narrative used for every non-scripted transaction. */
function templateNarrative(input: NarrativeInput): Narrative {
  const { transaction, employee, findings, evidence, verdict } = input;
  const open = findings.filter(isOpen);
  const satisfied = findings.filter((f) => !isOpen(f));

  if (verdict === "pass") {
    const checked = satisfied.map((f) => f.clauseId).join(", ");
    return {
      headline: "No policy exception identified",
      headlineAr: "لم يتم تحديد أي استثناء من السياسة",
      explanation: `${formatAed(transaction.amountAed)} at ${transaction.merchant}, settled by ${employee.name} (${employee.jobTitle}). The record was checked against ${satisfied.length} applicable clause${satisfied.length === 1 ? "" : "s"} — ${checked} — and each was satisfied. All ${evidence.requiredCount} required evidence item${evidence.requiredCount === 1 ? "" : "s"} ${evidence.requiredCount === 1 ? "is" : "are"} attached. No human action is required, and the record remains available for audit.`,
      explanationAr: `${formatAed(transaction.amountAed, "ar")} لدى ${transaction.merchantAr}، سُددت بواسطة ${employee.nameAr} (${employee.jobTitleAr}). وتمت مطابقة السجل مع ${satisfied.length} بند${satisfied.length === 1 ? "" : "اً"} منطبق${satisfied.length === 1 ? "" : "ة"} — ${checked} — واستُوفيت جميعها. وجميع عناصر الأدلة المطلوبة البالغة ${evidence.requiredCount} مرفقة. ولا يلزم أي إجراء بشري، ويبقى السجل متاحاً للتدقيق.`,
    };
  }

  const primary = open[0];
  const others = open.slice(1);
  const missingLabels = evidence.missing.map((k) => evidenceLabel(k, "en")).join(", ");
  const missingLabelsAr = evidence.missing.map((k) => evidenceLabel(k, "ar")).join("، ");

  const extra =
    others.length > 0
      ? ` A further ${others.length} clause${others.length === 1 ? "" : "s"} require${others.length === 1 ? "s" : ""} attention: ${others.map((f) => f.clauseId).join(", ")}.`
      : "";
  const extraAr =
    others.length > 0
      ? ` كما يتطلب ${others.length} بند${others.length === 1 ? "" : "اً"} إضافي${others.length === 1 ? "" : "ة"} الانتباه: ${others.map((f) => f.clauseId).join("، ")}.`
      : "";

  const evidenceSentence = evidence.missing.length
    ? ` Missing from the record: ${missingLabels}.`
    : " All required evidence is attached.";
  const evidenceSentenceAr = evidence.missing.length
    ? ` الناقص من السجل: ${missingLabelsAr}.`
    : " جميع الأدلة المطلوبة مرفقة.";

  return {
    headline: primary
      ? `${primary.clauseId} — ${verdict === "escalate" ? "exception requires approval" : "review required"}`
      : "Review required",
    headlineAr: primary
      ? `${primary.clauseId} — ${verdict === "escalate" ? "استثناء يتطلب اعتماداً" : "مطلوب مراجعة"}`
      : "مطلوب مراجعة",
    explanation: `${formatAed(transaction.amountAed)} at ${transaction.merchant}, settled by ${employee.name} (${employee.jobTitle}). ${primary?.detail ?? ""}${extra}${evidenceSentence} A human reviewer decides the outcome.`,
    explanationAr: `${formatAed(transaction.amountAed, "ar")} لدى ${transaction.merchantAr}، سُددت بواسطة ${employee.nameAr} (${employee.jobTitleAr}). ${primary?.detailAr ?? ""}${extraAr}${evidenceSentenceAr} ويتخذ المراجع البشري القرار النهائي.`,
  };
}

export const MOCK_PROMPT_VERSION = "spi-explain-v3";
export const MOCK_MODEL_VERSION = "deterministic-mock-1.0";

export function mockNarrative(input: NarrativeInput): Narrative {
  return scriptedNarrative(input) ?? templateNarrative(input);
}
