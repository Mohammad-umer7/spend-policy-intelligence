import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { requireTransaction } from "@/lib/data/transactions";
import { analyseTransaction } from "@/lib/engine/analysis";
import {
  CLAUDE_MODEL,
  CLAUDE_PROMPT_VERSION,
  buildSystemPrompt,
  buildUserPrompt,
  explanationSchema,
  serverProvider,
  type ExplainResponse,
} from "@/lib/ai/provider";
import { MOCK_MODEL_VERSION, MOCK_PROMPT_VERSION } from "@/lib/ai/mock";

/**
 * Optional Claude explanation endpoint.
 *
 * The verdict, risk level, cited clauses and figures are all computed here from
 * the deterministic engine before the model is called, and the model's output
 * replaces nothing but the prose. If the key is absent or the call fails, the
 * mock narrative is returned — the demo never depends on this route.
 */

const requestSchema = z.object({
  transactionId: z.string().min(1),
});

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "transactionId is required" }, { status: 400 });
  }

  let transaction;
  try {
    transaction = requireTransaction(parsed.data.transactionId);
  } catch {
    return Response.json({ error: "Unknown transaction" }, { status: 404 });
  }

  const analysis = analyseTransaction(transaction);

  const mockResponse: ExplainResponse = {
    transactionId: transaction.id,
    headline: analysis.headline,
    headlineAr: analysis.headlineAr,
    explanation: analysis.explanation,
    explanationAr: analysis.explanationAr,
    generatedBy: "mock",
    model: MOCK_MODEL_VERSION,
    promptVersion: MOCK_PROMPT_VERSION,
  };

  if (serverProvider() !== "claude") {
    return Response.json(mockResponse);
  }

  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      system: buildSystemPrompt(),
      output_config: { format: { type: "json_schema", schema: explanationSchema } },
      messages: [{ role: "user", content: buildUserPrompt(transaction, analysis) }],
    });

    if (message.stop_reason === "refusal") {
      return Response.json(mockResponse);
    }

    const text = message.content.find((block) => block.type === "text");
    if (!text || text.type !== "text") return Response.json(mockResponse);

    const narrative = z
      .object({
        headline: z.string(),
        headlineAr: z.string(),
        explanation: z.string(),
        explanationAr: z.string(),
      })
      .safeParse(JSON.parse(text.text));

    if (!narrative.success) return Response.json(mockResponse);

    const claudeResponse: ExplainResponse = {
      transactionId: transaction.id,
      ...narrative.data,
      generatedBy: "claude",
      model: CLAUDE_MODEL,
      promptVersion: CLAUDE_PROMPT_VERSION,
    };
    return Response.json(claudeResponse);
  } catch {
    // The deterministic result is always available, so a model failure
    // degrades the wording, never the assessment.
    return Response.json(mockResponse);
  }
}

export async function GET(): Promise<Response> {
  return Response.json({
    provider: serverProvider(),
    model: serverProvider() === "claude" ? CLAUDE_MODEL : MOCK_MODEL_VERSION,
    promptVersion:
      serverProvider() === "claude" ? CLAUDE_PROMPT_VERSION : MOCK_PROMPT_VERSION,
    claudeAvailable: Boolean(process.env.ANTHROPIC_API_KEY),
  });
}
