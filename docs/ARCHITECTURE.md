# Architecture

## The one decision everything follows from

**The rules engine decides. The model explains. A human approves.**

Every other choice in this codebase is downstream of that. It is what makes the audit trail honest, the verdicts reproducible, and the tests meaningful.

```
Transaction ──┐
Employee ─────┤
Department ───┼──▶ Rules engine ──▶ findings ──┬──▶ Narrative layer ──▶ explanation (EN/AR)
Policy ───────┤    (deterministic)             │    (mock or Claude)
Evidence ─────┘                                │
                                               └──▶ verdict · risk · clauses · figures
                                                              │
                                                              ▼
                                                     Human reviewer
                                                              │
                                                              ▼
                                                       Audit event
```

The narrative layer is downstream of the findings and cannot feed back into them. That is enforced by the type signature: `mockNarrative()` and the Claude route both *receive* an `AIAnalysis` and return four strings.

---

## Frontend

**Next.js 16, App Router.** Three things drove the choice:

1. **A server boundary.** `ANTHROPIC_API_KEY` is read only inside `src/app/api/explain/route.ts`. It cannot reach the browser bundle.
2. **Static prerendering.** `generateStaticParams` prerenders all 47 case pages, so navigating between cases in a live demo is instant.
3. **Route-level error boundaries.** `app/error.tsx` catches a render failure without taking down the shell.

Most of the app is client-rendered because the reviewer state is client state. The pages that read `useSearchParams` (`/queue`, `/policy`, `/audit`) wrap their client component in `<Suspense>` so prerendering succeeds.

### Layout

`AppShell` owns the chrome: collapsible sidebar (a drawer under `lg`), top bar with global search, company selector, demo badge, language toggle, notifications and profile. Routes render inside it, so navigation never re-mounts the copilot or loses a toast.

### Styling

Tailwind v4, with the design tokens declared in `@theme` in `globals.css`. Two deliberate rules:

- **Glass is for chrome and summaries only.** Tables, policy text, receipts and explanations sit on solid panels (`.panel`) so they stay legible on a projector. The `Panel` primitive takes a `variant` precisely so this stays a decision rather than a habit.
- **Logical properties everywhere** (`ps-`, `pe-`, `start-`, `end-`, `border-s`). RTL is then a `dir` attribute, not a second stylesheet.

The receipt preview inverts to a light surface on purpose — it should read as paper.

---

## State management

A single Zustand store (`src/lib/store/app-store.ts`) holding: locale, reviewer decisions, human audit events, precedent approvals, sidebar state, copilot messages and toasts.

**The synthetic ledger is never mutated.** `baseCases()` builds the case set once and memoises it; `applyDecisions()` layers human decisions on top to produce the view the UI renders. A reviewer decision is an *overlay*, which is why "reset demo data" is a single state clear and why `baseCases()` is safe to call from anywhere.

### Hydration

`persist` is configured with `skipHydration: true`, and `useHydrateStore()` calls `rehydrate()` in an effect after mount. The first client render is therefore byte-identical to the server render, and the persisted state arrives immediately afterwards. Without this, a persisted `locale: "ar"` would produce a hydration mismatch on every page.

`partialize` keeps transient state (`toasts`, `copilotOpen`, `copilotMessages`) out of storage.

### Deriving from the URL

Deep links (`/queue?filter=escalate`, `/policy?clause=TRV-2.3`, `/audit?transaction=TXN-2041`) apply during render via `useAppliedOnce`, not in an effect. Setting state during render re-runs the component before paint; an effect would commit the unfiltered view first and then replace it. This is also what the React Compiler lint rules want.

---

## The rules engine

`src/lib/engine/rules.ts`. Each clause is a function `(ctx) => RuleFinding | null` — `null` when the clause does not apply.

```ts
interface RuleFinding {
  clauseId: string;
  outcome: "satisfied" | "attention" | "breach";
  suggestedVerdict: Verdict;
  detail: string;      // and detailAr
  figures: RuleFigure[]; // the numbers the rule actually used
}
```

Carrying `figures` on every finding is what lets the UI show its working, and what lets the narrative layer quote a number without inventing one.

**Aggregation** takes the worst *open* finding. A finding is open when `outcome !== "satisfied" && suggestedVerdict !== "pass"` — the second half matters, because some clauses record an observation that asks for nothing (a missing receipt below the AED 250 threshold). Treating those as open would have made a third of the ledger look like it needed review.

**Two-pass evaluation.** `ESC-11.2` (items unresolved beyond five business days) is only evaluated once something else is already open. An old but compliant record is not an escalation — before this gate existed, 36 of 47 clean transactions were being flagged purely for age.

**Thresholds live in the policy**, not in the rules:

```ts
if (transaction.amountAed > threshold("GEN-1.2", "approvalThresholdAed")) { … }
```

Change the number in the policy object and the engine, the explanation and the tests all move together. This is the seam along which per-tenant configuration would be introduced.

### Evidence

`requiredEvidence()` derives what a record needs from its shape — category, payment source, amount, weekday, whether it exceeds a band. Nothing is stored per transaction, so a threshold change immediately changes what the system asks for.

Completeness counts `present` only. **Self-reported evidence deliberately does not count** — that is exactly the hotel case, where four of five items are attached and the fifth is the employee's own statement. Reporting 5/5 there would hide the thing the reviewer most needs to see.

### Risk

Risk is a function of verdict, evidence completeness, amount and finding count — not of amount alone. A well-evidenced escalation is *medium*; a thinly-evidenced one is *high*. Small-value items are capped at medium, because a AED 310 taxi should never present as high risk next to a AED 17,900 supplier payment.

### Budget

Every figure is derived from the ledger by `spendByDepartment()` / `departmentBudgets()`. Forecast is settled spend plus committed spend, which avoids any dependence on "today" — a date-extrapolated forecast would drift and break the demo's determinism.

---

## Policy retrieval

The policy is a typed object (`src/lib/data/policy.ts`): 15 clauses with `id`, category, verbatim `text` (EN/AR), `effectiveFrom`, machine-readable `thresholds`, and recorded `interpretations`.

There is no vector search, and deliberately so. Clause selection here is *deterministic* — a rule fires and names its clause. Retrieval is exact by construction, so a citation can never be to a clause that did not actually apply. In production, retrieval would be needed to *map a new policy document onto rules*, which is the ingestion problem, not the evaluation problem.

Citations are ordered open-findings-first, then satisfied, so a reviewer reads the reason before the reassurance. `EXC-10.1` is appended whenever a breach exists, because an exception is always granted under it.

---

## AI provider abstraction

Two providers behind one contract.

**Mock (default).** `src/lib/ai/mock.ts`. Hand-authored narratives for the five demonstration cases, templates for the rest. Pure, synchronous, deterministic — the same input always yields the same string, which is why it can be asserted in tests.

**Claude (optional).** `src/app/api/explain/route.ts`. The route:

1. recomputes the analysis server-side (it does not trust the client),
2. builds a prompt containing only the findings and figures,
3. calls `claude-opus-5` with `output_config.format` set to a JSON schema whose *only* properties are the four prose fields — the model has no field in which to return a verdict,
4. validates the response with Zod,
5. returns the deterministic narrative on refusal, schema mismatch, network failure, or any exception.

The system prompt forbids stating a different verdict, introducing a figure not in the input, or using accusatory language. The schema is the hard constraint; the prompt is the soft one.

The client renders the deterministic narrative first and swaps in the Claude text if it arrives. A slow or failed model call degrades the wording, never the assessment.

### The copilot

`src/lib/ai/copilot.ts` is intent matching over handlers that compute from the same functions the dashboard uses (`departmentBudgets()`, `companyTotals()`, `overlappingLicence()`). It cannot quote a number the rest of the product disagrees with, because it does not have its own source of numbers.

Unmatched questions return `null` and the UI says it cannot answer from the ledger and policy. Refusing is better than guessing.

---

## Audit logging

Two kinds of event, one shape:

- **Seeded** — generated deterministically from the analysis: one `deterministic_rule` event and one `ai_reasoning` event per transaction, timestamped from the transaction itself.
- **Human** — appended on every reviewer decision, carrying actor, role, previous status, new status, note, policy version and the evidence considered.

The `source` discriminator (`deterministic_rule` | `ai_reasoning` | `human_reviewer`) is what lets the trail answer "who decided this". The rule event carries a `ruleReference` and no model prose; the AI event carries prose and no rule reference. A test asserts that.

In production the human events would be an append-only server-side log. Here they are in `localStorage` under a versioned key, so a schema change cannot corrupt an existing demo.

---

## Security boundary

```
┌─ Client boundary ────────────────┐   ┌─ Processing ────────────┐   ┌─ Human ────────┐
│  Tokenisation & PII redaction    │──▶│  Deterministic rules    │──▶│  Human review  │
│  Raw PAN never leaves            │   │  Policy retrieval       │   │  Approved      │
│                                  │   │  Private / in-region    │   │  action        │
│                                  │   │  model                  │   │                │
└──────────────────────────────────┘   └─────────────────────────┘   └────────────────┘
```

- The API key exists only in the server process. There is no client-side model call anywhere in the codebase.
- The model receives findings and figures — not the card number, not the full employee record.
- The rules engine runs *before* the model, so a model failure cannot produce a wrong verdict, only a plainer sentence.
- Every decision records the policy version, prompt version and model version that informed it.

Where residency requires it, the narrative layer is the only component that needs to move — it is one function behind one interface, and it can be an open-weight model inside the client VPC.

> Designed to support client security and residency requirements, subject to architecture and compliance review. This is not a certification claim.

---

## Testing

93 tests, structured around the risk rather than around the file tree.

| Suite | Guards against |
|---|---|
| `policy-engine` | A verdict silently changing. Asserts each of the five cases, the exact verdict mix, determinism, and that no clause outside the published policy is ever cited. |
| `data-consistency` | Numbers drifting apart. Asserts dashboard totals equal ledger totals, receipt lines reconcile, related links are symmetric, and Marketing is over by exactly 18,400. |
| `queue-filters` | Filters and deep links diverging from what the tiles claim. |
| `review-flow` | Status transitions, note requirements, audit-event shape, and that the base ledger is never mutated. |
| `ai-layer` | The narrative layer overstepping. Asserts no accusatory vocabulary on the sensitive cases, that every reviewable case defers to a human, that no answer claims an action was taken, and that the Claude schema has no verdict field. |
| `persistence` | Refresh losing a decision, or corrupt storage throwing. |
| `demo-flow` | The presentation. Walks all fifteen steps of the script. |

---

## Deployment options

**Vercel** — zero config. Set `AI_PROVIDER` and `ANTHROPIC_API_KEY` as environment variables if Claude mode is wanted.

**Container** — `output: "standalone"` in `next.config.ts` produces a self-contained server for any Node runtime. Suitable for a client VPC.

**Static** — with the API route removed, the whole app exports statically; the mock provider needs no server at all. This is the lowest-friction way to hand a prospect a running demo.

For a real deployment the additions are: a database for decisions and audit events, an identity provider, per-tenant policy storage, and a model-call log with retention controls.
