/**
 * Core domain model for Spend Policy Intelligence.
 *
 * Every entity in the demo is synthetic. No real company, employee, card,
 * merchant relationship or transaction is represented anywhere in this file.
 */

export type Locale = "en" | "ar";

export type Emirate =
  | "Abu Dhabi"
  | "Dubai"
  | "Sharjah"
  | "Ajman"
  | "Ras Al Khaimah"
  | "Fujairah"
  | "Umm Al Quwain";

export type DepartmentId =
  | "finance"
  | "operations"
  | "marketing"
  | "procurement"
  | "executive";

export type EmployeeLevel =
  | "Associate"
  | "Senior Associate"
  | "Manager"
  | "Senior Manager"
  | "Director"
  | "Executive";

/** Merchant category code, aligned to the policy clause families. */
export type SpendCategory =
  | "accommodation"
  | "airfare"
  | "meals"
  | "client_entertainment"
  | "fuel"
  | "ground_transport"
  | "software"
  | "procurement"
  | "utilities"
  | "telecom"
  | "groceries"
  | "maintenance"
  | "office_supplies"
  | "marketing_services";

export type PaymentSource =
  | "Corporate card"
  | "Virtual card"
  | "Employee reimbursement"
  | "Supplier invoice";

/** Deterministic engine verdict, also used as the AI-assisted verdict. */
export type Verdict = "pass" | "flag" | "escalate";

export type RiskLevel = "low" | "medium" | "high";

/** Where a conclusion came from — surfaced explicitly in the audit trail. */
export type DecisionSource = "deterministic_rule" | "ai_reasoning" | "human_reviewer";

export type ReviewStatus =
  | "cleared"
  | "pending_review"
  | "info_requested"
  | "escalated"
  | "approved"
  | "rejected";

export type ReviewAction =
  | "approve_exception"
  | "request_information"
  | "escalate"
  | "reject"
  | "add_note";

export type EvidenceKind =
  | "receipt"
  | "invoice"
  | "booking_confirmation"
  | "travel_request"
  | "attendee_list"
  | "business_purpose"
  | "manager_confirmation"
  | "quotation"
  | "licence_register_check"
  | "availability_evidence"
  | "operational_justification";

export type EvidenceState = "present" | "missing" | "self_reported";

export interface EvidenceItem {
  kind: EvidenceKind;
  state: EvidenceState;
  /** Short human-readable label, e.g. "Booking confirmation NH-88213". */
  label: string;
  labelAr: string;
  /** Populated when state is "present" — a synthetic document reference. */
  reference?: string;
  capturedAt?: string;
  /** Set when the evidence exists but was supplied by the employee unverified. */
  caveat?: string;
  caveatAr?: string;
}

export interface Receipt {
  reference: string;
  uploadedAt: string;
  /** Synthetic OCR read-back shown in the receipt preview panel. */
  lines: ReceiptLine[];
  merchantOnReceipt: string;
  totalAed: number;
  vatAed: number;
  /** True when the receipt total does not reconcile with the card amount. */
  mismatch: boolean;
}

export interface ReceiptLine {
  description: string;
  descriptionAr: string;
  amountAed: number;
}

export interface ApprovalRecord {
  approver: string;
  approverRole: string;
  approvedAt: string;
  scope: string;
  scopeAr: string;
  reference: string;
}

export interface Department {
  id: DepartmentId;
  name: string;
  nameAr: string;
  headcount: number;
  /** Monthly budget in AED. */
  monthlyBudgetAed: number;
  /** Approved but not yet settled commitments (POs, recurring renewals). */
  committedAed: number;
  costCentre: string;
}

export interface TravelBand {
  /** Nightly hotel allowance in AED. */
  hotelNightlyAed: number;
  /** Per-diem meal allowance in AED. */
  perDiemAed: number;
  cabinClass: "Economy" | "Premium economy" | "Business";
}

export interface Employee {
  id: string;
  name: string;
  nameAr: string;
  level: EmployeeLevel;
  departmentId: DepartmentId;
  jobTitle: string;
  jobTitleAr: string;
  /** Home emirate the employee is rostered to. */
  assignedLocation: Emirate;
  /** Single-transaction card limit in AED. */
  cardLimitAed: number;
  travelBand: TravelBand;
  joinedAt: string;
}

export interface Company {
  id: string;
  name: string;
  nameAr: string;
  legalForm: string;
  country: string;
  industry: string;
  industryAr: string;
  locations: number;
  headcount: number;
  currency: "AED";
  fiscalPeriodLabel: string;
  fiscalPeriodLabelAr: string;
}

export type ClauseCategory =
  | "general_approvals"
  | "travel"
  | "accommodation"
  | "meals"
  | "client_entertainment"
  | "fuel"
  | "transport"
  | "software_subscriptions"
  | "procurement"
  | "weekend_spending"
  | "public_holiday_spending"
  | "supporting_documents"
  | "duplicate_transactions"
  | "exceptions"
  | "escalation";

export interface PolicyClause {
  id: string;
  category: ClauseCategory;
  title: string;
  titleAr: string;
  /** Verbatim clause wording as published in the policy document. */
  text: string;
  textAr: string;
  effectiveFrom: string;
  /** Machine-readable thresholds the rules engine reads. */
  thresholds?: Record<string, number>;
  /** Prior reviewer interpretations recorded against this clause. */
  interpretations: ClauseInterpretation[];
}

export interface ClauseInterpretation {
  id: string;
  summary: string;
  summaryAr: string;
  recordedAt: string;
  recordedBy: string;
  status: "active" | "proposed";
}

export interface Policy {
  id: string;
  documentName: string;
  version: string;
  status: "published" | "draft" | "in_review";
  effectiveFrom: string;
  lastUpdatedAt: string;
  owner: string;
  ownerRole: string;
  approvedBy: string;
  clauses: PolicyClause[];
}

export interface RelatedTransactionLink {
  transactionId: string;
  /** Why the engine considers these records related. */
  reason: string;
  reasonAr: string;
  relationship: "possible_duplicate" | "same_trip" | "same_vendor" | "overlapping_tool";
}

export interface Transaction {
  id: string;
  employeeId: string;
  merchant: string;
  merchantAr: string;
  category: SpendCategory;
  amountAed: number;
  /** ISO-8601 with the +04:00 Gulf Standard Time offset. */
  occurredAt: string;
  paymentSource: PaymentSource;
  cardLast4: string;
  location: Emirate;
  description: string;
  descriptionAr: string;
  receipt: Receipt | null;
  evidence: EvidenceItem[];
  approval: ApprovalRecord | null;
  /** Populated for meals and entertainment. */
  attendeeCount?: number;
  attendeeNames?: string[];
  businessPurpose?: string;
  businessPurposeAr?: string;
  /** Reference to an approved travel request, when one exists. */
  travelRequestId?: string;
  /** Number of nights, for accommodation. */
  nights?: number;
  /** Vendor tool name, for software subscriptions. */
  softwareTool?: string;
  related: RelatedTransactionLink[];
  /** Set only on the five scripted demo cases so the narrative is richer. */
  demoCase?: DemoCaseId;
}

export type DemoCaseId =
  | "hotel_above_band"
  | "possible_duplicate"
  | "weekend_team_meal"
  | "fuel_location_mismatch"
  | "overlapping_subscription";

/** A single deterministic rule outcome. */
export interface RuleFinding {
  clauseId: string;
  outcome: "satisfied" | "attention" | "breach";
  suggestedVerdict: Verdict;
  /** Plain-language statement of what the rule observed. */
  detail: string;
  detailAr: string;
  /** Concrete figures the rule used, rendered as an evidence chip row. */
  figures: RuleFigure[];
}

export interface RuleFigure {
  label: string;
  labelAr: string;
  value: string;
}

export interface EvidenceAssessment {
  required: EvidenceKind[];
  present: EvidenceKind[];
  missing: EvidenceKind[];
  selfReported: EvidenceKind[];
  completeness: number;
  requiredCount: number;
  presentCount: number;
}

export interface BudgetImpact {
  departmentId: DepartmentId;
  monthlyBudgetAed: number;
  spentAed: number;
  committedAed: number;
  remainingAed: number;
  forecastAed: number;
  /** Positive when the forecast exceeds the budget. */
  forecastVarianceAed: number;
  utilisation: number;
  /** Remaining budget if the transaction under review is approved. */
  remainingAfterApprovalAed: number;
  wouldExceedBudget: boolean;
}

export interface RecommendedAction {
  key:
    | "request_finance_director_approval"
    | "request_attendee_details"
    | "request_travel_context"
    | "confirm_existing_licence"
    | "review_possible_duplicate"
    | "request_missing_receipt"
    | "request_operational_justification"
    | "request_quotations"
    | "no_action_required";
  label: string;
  labelAr: string;
  detail: string;
  detailAr: string;
}

/** The complete AI-assisted assessment shown on the investigation screen. */
export interface AIAnalysis {
  transactionId: string;
  verdict: Verdict;
  riskLevel: RiskLevel;
  /** Deterministic findings, always computed by the rules engine. */
  findings: RuleFinding[];
  /** Clause IDs cited, ordered by relevance. */
  citedClauseIds: string[];
  headline: string;
  headlineAr: string;
  explanation: string;
  explanationAr: string;
  evidence: EvidenceAssessment;
  budgetImpact: BudgetImpact;
  recommendedAction: RecommendedAction;
  humanReviewRequired: boolean;
  /** Named uncertainty — deliberately not a model confidence percentage. */
  uncertainty: string | null;
  uncertaintyAr: string | null;
  policyCoverage: "complete" | "partial";
  /** Which layer produced the narrative. */
  generatedBy: "mock" | "claude";
  promptVersion: string;
  modelVersion: string;
}

export interface ReviewDecision {
  transactionId: string;
  action: ReviewAction;
  status: ReviewStatus;
  reviewer: string;
  reviewerRole: string;
  note: string;
  decidedAt: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  transactionId: string | null;
  actor: string;
  actorRole: string;
  source: DecisionSource;
  action: string;
  actionAr: string;
  /** Deterministic rule reference, when the event came from the engine. */
  ruleReference: string | null;
  /** Short AI rationale, when the event came from the AI layer. */
  aiExplanation: string | null;
  policyVersion: string;
  evidenceUsed: string[];
  previousStatus: ReviewStatus | null;
  newStatus: ReviewStatus | null;
  reviewerNote: string | null;
}

export interface SuggestedPrecedent {
  id: string;
  clauseId: string;
  summary: string;
  summaryAr: string;
  /** Reviewer decisions that produced this pattern. */
  supportingTransactionIds: string[];
  observedCount: number;
  status: "requires_policy_owner_approval" | "approved" | "declined";
  proposedInterpretation: string;
  proposedInterpretationAr: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  titleAr: string;
  body: string;
  bodyAr: string;
  createdAt: string;
  severity: "info" | "warning" | "critical";
  transactionId?: string;
  href?: string;
}

/** A grounded copilot answer. Every field is required so answers stay auditable. */
export interface CopilotAnswer {
  answer: string;
  answerAr: string;
  supportingTransactionIds: string[];
  citedClauseIds: string[];
  figures: RuleFigure[];
  missingInformation: string[];
  missingInformationAr: string[];
  recommendedNextAction: string;
  recommendedNextActionAr: string;
}

export interface CopilotMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  answer?: CopilotAnswer;
  createdAt: string;
}

/** Fully-resolved case object consumed by the UI layers. */
export interface CaseRecord {
  transaction: Transaction;
  employee: Employee;
  department: Department;
  analysis: AIAnalysis;
  status: ReviewStatus;
  decision: ReviewDecision | null;
  /** Hours since the transaction was captured, at the fixed demo timestamp. */
  ageHours: number;
}
