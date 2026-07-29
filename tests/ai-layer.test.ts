import { describe, expect, it } from "vitest";
import { baseCases } from "@/lib/engine/analysis";
import { formatAed } from "@/lib/format";
import { mockNarrative } from "@/lib/ai/mock";
import { answerQuestion, resolveIntent, suggestedQuestions } from "@/lib/ai/copilot";
import { buildSystemPrompt, buildUserPrompt, explanationSchema } from "@/lib/ai/provider";
import { departmentBudgets } from "@/lib/engine/budget";

const cases = baseCases();
const byId = (id: string) => cases.find((c) => c.transaction.id === id)!;

describe("mock narrative", () => {
  it("is deterministic for the same input", () => {
    const record = byId("TXN-2041");
    const input = {
      transaction: record.transaction,
      employee: record.employee,
      findings: record.analysis.findings,
      evidence: record.analysis.evidence,
      budget: record.analysis.budgetImpact,
      verdict: record.analysis.verdict,
    };
    expect(mockNarrative(input)).toEqual(mockNarrative(input));
  });

  it("writes both languages for every case", () => {
    for (const record of cases) {
      expect(record.analysis.explanation.length).toBeGreaterThan(40);
      expect(record.analysis.explanationAr.length).toBeGreaterThan(40);
      expect(record.analysis.headline.length).toBeGreaterThan(4);
      expect(record.analysis.headlineAr.length).toBeGreaterThan(4);
      // Arabic must actually contain Arabic script.
      expect(/[؀-ۿ]/.test(record.analysis.explanationAr)).toBe(true);
    }
  });

  it("quotes the exact over-band figure in the hotel explanation", () => {
    // Assert against the app's own formatter rather than a hand-written
    // string, so currency spacing can never make the test lie.
    const text = byId("TXN-2041").analysis.explanation;
    expect(text).toContain(formatAed(1_350));
    expect(text).toContain(formatAed(4_850));
    expect(text).toContain(formatAed(3_500));
  });

  it("never uses accusatory language on the duplicate or fuel cases", () => {
    const forbidden = ["fraud", "fraudulent", "theft", "stole", "dishonest", "misconduct"];
    for (const id of ["TXN-2029", "TXN-2033", "TXN-2052"]) {
      const text = byId(id).analysis.explanation.toLowerCase();
      for (const word of forbidden) expect(text, `${id} contains "${word}"`).not.toContain(word);
    }
  });

  it("states that a human decides, on every case that needs review", () => {
    for (const record of cases.filter((c) => c.analysis.humanReviewRequired)) {
      const text = record.analysis.explanation.toLowerCase();
      expect(
        text.includes("human") ||
          text.includes("reviewer") ||
          text.includes("finance director") ||
          text.includes("policy owner"),
        `${record.transaction.id} does not defer to a human`,
      ).toBe(true);
    }
  });

  it("never claims an action was taken", () => {
    const forbidden = ["employee contacted", "we have contacted", "email sent", "has been sent"];
    for (const record of cases) {
      const text = record.analysis.explanation.toLowerCase();
      for (const phrase of forbidden) expect(text).not.toContain(phrase);
    }
  });
});

describe("copilot", () => {
  const ctx = { cases };

  it("answers every suggested question", () => {
    for (const question of suggestedQuestions) {
      const context = question.requiresFocus
        ? { cases, focusTransactionId: "TXN-2041" }
        : ctx;
      const answer = answerQuestion(question.en, context);
      expect(answer, `no answer for "${question.en}"`).not.toBeNull();
      expect(answer!.answer.length).toBeGreaterThan(20);
      expect(answer!.answerAr.length).toBeGreaterThan(20);
      expect(answer!.recommendedNextAction.length).toBeGreaterThan(10);
    }
  });

  it("answers the Arabic phrasing of every suggested question", () => {
    for (const question of suggestedQuestions) {
      const context = question.requiresFocus
        ? { cases, focusTransactionId: "TXN-2041" }
        : ctx;
      expect(answerQuestion(question.ar, context), `no Arabic answer for "${question.ar}"`).not.toBeNull();
    }
  });

  it("returns null rather than guessing when it cannot ground an answer", () => {
    expect(answerQuestion("what is the weather in paris", ctx)).toBeNull();
    expect(resolveIntent("完全に無関係")).toBeNull();
  });

  it("answers the budget question from the demo script with real figures", () => {
    const answer = answerQuestion(
      "Would approving this cause the department to exceed its travel budget?",
      { cases, focusTransactionId: "TXN-2041" },
    );
    expect(answer).not.toBeNull();
    const marketing = departmentBudgets().find((b) => b.department.id === "marketing")!;
    expect(answer!.answer).toContain("Marketing");
    // Must quote the same numbers the dashboard shows.
    expect(answer!.answer).toContain(marketing.spentAed.toLocaleString("en-AE"));
    expect(answer!.answer).toContain("18,400");
    expect(answer!.answer).toContain("1,350");
    expect(answer!.citedClauseIds).toContain("TRV-2.3");
    expect(answer!.supportingTransactionIds).toContain("TXN-2041");
    expect(answer!.figures.length).toBeGreaterThan(3);
  });

  it("grounds the overlapping-subscription answer in the licence register", () => {
    const answer = answerQuestion("Which subscriptions may overlap?", ctx);
    expect(answer).not.toBeNull();
    expect(answer!.supportingTransactionIds).toEqual(
      expect.arrayContaining(["TXN-2044", "TXN-2032"]),
    );
    expect(answer!.citedClauseIds).toContain("SUB-6.1");
    expect(answer!.answer).toContain("Atlas Workspace");
    expect(answer!.answer).toContain("Meridian Analytics");
  });

  it("lists only transactions that actually have no receipt", () => {
    const answer = answerQuestion("Show transactions with missing receipts.", ctx);
    expect(answer).not.toBeNull();
    for (const id of answer!.supportingTransactionIds) {
      expect(byId(id).transaction.receipt).toBeNull();
    }
    expect(answer!.citedClauseIds).toContain("DOC-8.1");
  });

  it("labels a drafted message as a draft and never as sent", () => {
    const answer = answerQuestion("Draft a request for missing information.", {
      cases,
      focusTransactionId: "TXN-2034",
    });
    expect(answer).not.toBeNull();
    expect(answer!.answer).toContain("not sent");
    expect(answer!.answer.toLowerCase()).not.toContain("employee contacted");
  });

  it("only cites transactions that exist", () => {
    const ids = new Set(cases.map((c) => c.transaction.id));
    for (const question of suggestedQuestions) {
      const answer = answerQuestion(question.en, { cases, focusTransactionId: "TXN-2041" });
      for (const id of answer?.supportingTransactionIds ?? []) {
        expect(ids.has(id), `${question.id} cites unknown ${id}`).toBe(true);
      }
    }
  });
});

describe("claude provider contract", () => {
  it("constrains the model to prose only, with a strict schema", () => {
    expect(explanationSchema.additionalProperties).toBe(false);
    expect(explanationSchema.required).toEqual([
      "headline",
      "headlineAr",
      "explanation",
      "explanationAr",
    ]);
    // The model cannot return a verdict, a risk level or a clause.
    expect(Object.keys(explanationSchema.properties)).not.toContain("verdict");
    expect(Object.keys(explanationSchema.properties)).not.toContain("riskLevel");
  });

  it("tells the model the verdict is not its to make", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Never state or imply a different verdict");
    expect(prompt).toContain("Never introduce a number");
    expect(prompt).toContain("Never accuse anyone");
  });

  it("passes the engine's findings and figures into the prompt", () => {
    const record = byId("TXN-2041");
    const prompt = buildUserPrompt(record.transaction, record.analysis);
    expect(prompt).toContain("Engine verdict: escalate");
    expect(prompt).toContain("TRV-2.3");
    expect(prompt).toContain("4 of 5 required items attached");
  });
});
