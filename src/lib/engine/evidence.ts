import type {
  Employee,
  EvidenceAssessment,
  EvidenceItem,
  EvidenceKind,
  Locale,
  SpendCategory,
  Transaction,
} from "../types";
import { isWeekend } from "../format";
import { threshold } from "../data/policy";

/**
 * Evidence requirements are derived from the transaction shape rather than
 * stored on each record, so a change to a policy threshold immediately changes
 * what the engine asks for.
 */

const evidenceLabels: Record<EvidenceKind, { en: string; ar: string }> = {
  receipt: { en: "Receipt", ar: "الإيصال" },
  invoice: { en: "Supplier invoice", ar: "فاتورة المورد" },
  booking_confirmation: { en: "Booking confirmation", ar: "تأكيد الحجز" },
  travel_request: { en: "Approved travel request", ar: "طلب سفر معتمد" },
  attendee_list: { en: "Attendee names", ar: "أسماء الحاضرين" },
  business_purpose: { en: "Business purpose", ar: "الغرض التجاري" },
  manager_confirmation: { en: "Manager confirmation", ar: "تأكيد المدير" },
  quotation: { en: "Competitive quotations", ar: "عروض الأسعار التنافسية" },
  licence_register_check: { en: "Licence register check", ar: "مطابقة سجل التراخيص" },
  availability_evidence: { en: "Availability evidence", ar: "دليل التوافر" },
  operational_justification: { en: "Operational justification", ar: "التبرير التشغيلي" },
};

export function evidenceLabel(kind: EvidenceKind, locale: Locale): string {
  return evidenceLabels[kind][locale];
}

/** Categories where a purchase above the procurement threshold needs quotations. */
const QUOTATION_CATEGORIES: SpendCategory[] = [
  "procurement",
  "marketing_services",
  "maintenance",
  "office_supplies",
];

/** True when the accommodation charge exceeds the employee's band for the trip. */
export function hotelBandForTrip(transaction: Transaction, employee: Employee): number {
  return employee.travelBand.hotelNightlyAed * (transaction.nights ?? 1);
}

export function exceedsHotelBand(transaction: Transaction, employee: Employee): boolean {
  if (transaction.category !== "accommodation") return false;
  return transaction.amountAed > hotelBandForTrip(transaction, employee);
}

/** True when fuel was bought outside the assigned emirate with no linked travel. */
export function isFuelLocationMismatch(transaction: Transaction, employee: Employee): boolean {
  if (transaction.category !== "fuel") return false;
  if (transaction.travelRequestId) return false;
  return transaction.location !== employee.assignedLocation;
}

export function requiredEvidence(transaction: Transaction, employee: Employee): EvidenceKind[] {
  const required: EvidenceKind[] = [];
  const { category, amountAed, paymentSource, receipt, approval } = transaction;

  // Primary supporting document.
  required.push(paymentSource === "Supplier invoice" || category === "software" ? "invoice" : "receipt");

  // Fuel is settled on a pump receipt and does not carry a separate purpose note.
  if (category !== "fuel") required.push("business_purpose");

  switch (category) {
    case "accommodation":
      required.push("booking_confirmation", "travel_request");
      if (exceedsHotelBand(transaction, employee)) required.push("availability_evidence");
      break;
    case "airfare":
      required.push("travel_request");
      break;
    case "meals":
      if (amountAed > threshold("MEA-4.1", "attendeeNamesRequiredAboveAed")) {
        required.push("attendee_list");
      }
      break;
    case "client_entertainment":
      required.push("attendee_list");
      if (amountAed > threshold("ENT-4.6", "preApprovalAboveAed")) {
        required.push("manager_confirmation");
      }
      break;
    case "fuel":
      if (isFuelLocationMismatch(transaction, employee)) required.push("operational_justification");
      break;
    case "software":
      required.push("licence_register_check");
      break;
    default:
      break;
  }

  if (
    QUOTATION_CATEGORIES.includes(category) &&
    amountAed > threshold("PRC-7.3", "quotationsRequiredAboveAed")
  ) {
    required.push("quotation");
  }

  if (isWeekend(transaction.occurredAt)) required.push("operational_justification");

  // A missing receipt above the documentation threshold needs manager sign-off.
  if (!receipt && amountAed > threshold("DOC-8.1", "receiptRequiredAboveAed")) {
    required.push("manager_confirmation");
  }

  // Spend above the approval threshold needs a recorded approval; where none
  // exists the reviewer is asked for a written confirmation instead.
  if (amountAed > threshold("GEN-1.2", "approvalThresholdAed") && !approval) {
    required.push("manager_confirmation");
  }

  return [...new Set(required)];
}

export function assessEvidence(
  transaction: Transaction,
  employee: Employee,
): EvidenceAssessment {
  const required = requiredEvidence(transaction, employee);
  const stateByKind = new Map(transaction.evidence.map((e) => [e.kind, e.state]));

  const present = required.filter((kind) => stateByKind.get(kind) === "present");
  const selfReported = required.filter((kind) => stateByKind.get(kind) === "self_reported");
  const missing = required.filter((kind) => {
    const state = stateByKind.get(kind);
    return state === undefined || state === "missing";
  });

  return {
    required,
    present,
    missing,
    selfReported,
    // Self-reported evidence deliberately does not count towards completeness.
    completeness: required.length === 0 ? 1 : present.length / required.length,
    requiredCount: required.length,
    presentCount: present.length,
  };
}

/**
 * Resolves a required evidence kind to a displayable item, falling back to a
 * generic label when the transaction did not spell the gap out itself.
 */
export function resolveEvidenceItem(
  transaction: Transaction,
  kind: EvidenceKind,
  locale: Locale,
): EvidenceItem {
  const existing = transaction.evidence.find((e) => e.kind === kind);
  if (existing) return existing;
  return {
    kind,
    state: "missing",
    label: `${evidenceLabels[kind].en} not provided`,
    labelAr: `${evidenceLabels[kind].ar} غير مقدَّم`,
    ...(locale === "ar" ? {} : {}),
  };
}

/** Evidence attached to the record that the policy did not explicitly require. */
export function supplementaryEvidence(
  transaction: Transaction,
  required: EvidenceKind[],
): EvidenceItem[] {
  return transaction.evidence.filter((e) => e.state !== "missing" && !required.includes(e.kind));
}
