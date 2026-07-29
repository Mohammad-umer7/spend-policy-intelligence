import type { AIAnalysis, Transaction } from "../types";

/**
 * AI provider selection.
 *
 * The product runs entirely on the mock provider — the deterministic engine
 * decides every verdict, and the mock narrative layer writes the explanation.
 * When an API key is present, the Claude provider rewrites *only* the
 * explanation text, from the findings the engine already produced. It cannot
 * change the verdict, the risk level, the cited clauses, or any figure.
 */

export type ProviderName = "mock" | "claude";

export const CLAUDE_MODEL = "claude-opus-5";

/** Read on the server only — the key is never exposed to the browser. */
export function serverProvider(): ProviderName {
  const configured = process.env.AI_PROVIDER;
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
  if (configured === "claude" && hasKey) return "claude";
  return "mock";
}

/**
 * Public-safe description of the configured provider, surfaced on the Security
 * page. Deliberately carries no key material.
 */
export interface ProviderStatus {
  provider: ProviderName;
  model: string;
  promptVersion: string;
  /** True when the deployment could switch to Claude but has not been asked to. */
  claudeAvailable: boolean;
}

export interface ExplainRequest {
  transactionId: string;
  locale: "en" | "ar";
}

export interface ExplainResponse {
  transactionId: string;
  headline: string;
  headlineAr: string;
  explanation: string;
  explanationAr: string;
  generatedBy: ProviderName;
  model: string;
  promptVersion: string;
}

/** Shape the model is constrained to return. */
export const explanationSchema = {
  type: "object",
  properties: {
    headline: {
      type: "string",
      description: "One sentence, under 90 characters, stating the finding in English.",
    },
    headlineAr: {
      type: "string",
      description: "The same headline in professional business Arabic.",
    },
    explanation: {
      type: "string",
      description:
        "Two to four sentences in English explaining the finding to a finance reviewer.",
    },
    explanationAr: {
      type: "string",
      description: "The same explanation in professional business Arabic.",
    },
  },
  required: ["headline", "headlineAr", "explanation", "explanationAr"],
  additionalProperties: false,
} as const;

export const CLAUDE_PROMPT_VERSION = "spi-explain-claude-v1";

/**
 * The system prompt is deliberately narrow: the model is a writer, not a
 * decision-maker. Every constraint here exists so the output stays auditable.
 */
export function buildSystemPrompt(): string {
  return [
    "You write explanations for a corporate expense review tool.",
    "",
    "A deterministic policy engine has already evaluated the transaction and produced the verdict, the risk level, the cited policy clauses and every figure. Your job is only to explain that result to a finance reviewer.",
    "",
    "Rules:",
    "- Never state or imply a different verdict from the one given.",
    "- Never introduce a number, date, name or policy clause that is not in the input.",
    "- Never accuse anyone of fraud, dishonesty or misconduct. Describe what the records show and what is missing.",
    "- Where evidence is self-reported, say so.",
    "- State plainly that a human reviewer makes the final decision.",
    "- Write the Arabic as professional business Arabic for a finance audience, not a literal translation.",
    "- No preamble, no headings, no bullet points.",
  ].join("\n");
}

export function buildUserPrompt(transaction: Transaction, analysis: AIAnalysis): string {
  const findings = analysis.findings
    .map(
      (f) =>
        `- ${f.clauseId} [${f.outcome}] ${f.detail} (${f.figures.map((x) => `${x.label}: ${x.value}`).join("; ")})`,
    )
    .join("\n");

  return [
    `Transaction: ${transaction.id}`,
    `Merchant: ${transaction.merchant}`,
    `Amount: AED ${transaction.amountAed}`,
    `Category: ${transaction.category}`,
    `Date: ${transaction.occurredAt}`,
    "",
    `Engine verdict: ${analysis.verdict}`,
    `Risk level: ${analysis.riskLevel}`,
    `Evidence: ${analysis.evidence.presentCount} of ${analysis.evidence.requiredCount} required items attached`,
    `Missing evidence: ${analysis.evidence.missing.join(", ") || "none"}`,
    `Self-reported: ${analysis.uncertainty ?? "none"}`,
    `Recommended action: ${analysis.recommendedAction.label}`,
    "",
    "Findings from the deterministic engine:",
    findings,
    "",
    "Write the headline and explanation for this result.",
  ].join("\n");
}
