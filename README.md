# Spend Policy Intelligence

**AI-assisted. Human-reviewed.**

A fintech proof of concept for the intelligence layer that sits on top of a spend-management platform. It reads a company's written expense policy, checks every transaction against it, and hands a finance reviewer a decision-ready case — the verdict, the exact clause, the evidence, what is missing, and what to do next.

> All data in this repository is fictional. Every company, employee, transaction, policy clause and receipt was written for this build. No real customer, cardholder or financial data is present anywhere in the codebase.

---

## The problem

Spend-management platforms already move money well. They issue cards, capture receipts, apply limits and route approvals. What they do not do is answer the question a finance manager actually has each morning:

> Of the 47 transactions that settled this month, which ones do I need to look at, why, and what should I do about them?

Today that answer is assembled by hand — someone opens the policy PDF, opens the transaction, opens the travel band spreadsheet, and forms a judgement. It does not scale, it is inconsistent between reviewers, and none of the reasoning is captured.

This product is that missing layer.

## What it does

For every transaction, the system checks the written policy clause by clause, the employee's grade and spending band, the department's budget position, the receipt and supporting documents, existing approvals, the merchant category, related transactions, and what information is missing. It produces:

| Output | Example |
|---|---|
| Verdict | Pass · Flag · Escalate |
| Exact policy clause | `TRV-2.3` — with the verbatim published wording |
| Plain explanation | English and Arabic |
| Evidence considered | 4 of 5 required items attached |
| Missing evidence | Third-party availability confirmation |
| Risk level | Medium |
| Recommended action | Request Finance Director approval |
| Human review | Required |
| Audit trail | Rule → model → human, with before/after status |

### The system never makes the financial decision

This is the architectural commitment, not a disclaimer:

- **A deterministic rules engine produces every verdict.** It is ordinary TypeScript reading the policy thresholds. It is reproducible, testable, and diffable.
- **The AI layer writes the explanation** from findings the engine has already produced. It cannot change a verdict, a risk level, a cited clause, or any figure. When the optional Claude provider is enabled it is given the findings and a system prompt that forbids introducing a number or a clause that is not in its input.
- **A human approves, rejects, escalates or requests information** on every case that is not a clean pass. Notes are mandatory on the decisions that change an outcome.

That split is why the audit trail can honestly label each row *deterministic rule*, *AI reasoning* or *human reviewer*.

---

## Running it

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. No API key, no account, no configuration.

```bash
npm run verify   # lint + typecheck + tests + production build
```

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build (prerenders all 47 case pages) |
| `npm run lint` | ESLint, including the React Compiler rules |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm test` | Vitest suite |
| `npm run verify` | All of the above, in order |

### Deterministic by design

- A **fixed clock** (`REFERENCE_NOW = 24 July 2026, 09:15 +04:00`) drives every case age, date filter and forecast. Nothing drifts between runs or between machines.
- All timestamps render in `Asia/Dubai` so the server and client always agree.
- Reviewer decisions persist to `localStorage` under a versioned key and survive a refresh.
- **Reset data**, at the foot of the sidebar, clears every decision and audit event and restores the pristine dataset.

### Optional Claude mode

```bash
cp .env.example .env.local
# set AI_PROVIDER=claude and ANTHROPIC_API_KEY=sk-ant-...
```

The key is read on the server only, inside `src/app/api/explain/route.ts`, and is never sent to the browser. In this mode the route:

1. recomputes the deterministic analysis server-side,
2. sends only the findings and figures to `claude-opus-5`,
3. constrains the response with a strict JSON schema containing *only* the four prose fields,
4. falls back to the deterministic narrative on refusal, schema mismatch, or any error.

Nothing depends on this path. With no key, everything above still works.

---

## The dataset

**Northstar Hospitality Group LLC** — a fictional UAE food and beverage group: 12 restaurant locations, ~320 employees, five departments, all amounts in AED.

- **47 transactions** across July 2026
- **15 policy clauses** with machine-readable thresholds the engine reads directly
- **3 escalations, 8 flags, 36 passes** — produced by the engine, not hand-assigned
- **Marketing** is the one department forecast over budget, by exactly **AED 18,400**

Every number on screen is derived from that ledger. There are no hard-coded totals anywhere; the data-consistency suite asserts this.

### The five scripted cases

| # | Case | Verdict | Why |
|---|---|---|---|
| 1 | Hotel above travel band (`TXN-2041`) | **Escalate** | AED 4,850 against a AED 3,500 band. Trip pre-approved, folio and booking attached, but room availability is self-reported. `TRV-2.3` |
| 2 | Possible duplicate (`TXN-2029` / `TXN-2033`) | **Flag** | Same supplier, amounts within 2.5%, three days apart, two cardholders. Presented as reconciliation, never as an allegation. `DUP-9.2` |
| 3 | Weekend team meal (`TXN-2036`) | **Flag** | Saturday, AED 1,200, four attendees, business purpose recorded — attendee names missing. `MEA-4.1` |
| 4 | Fuel location mismatch (`TXN-2052`) | **Flag** | Employee rostered to Abu Dhabi, fuel bought in Dubai, no linked travel request. `FUE-5.2` |
| 5 | Overlapping subscription (`TXN-2044`, `TXN-2032`) | **Escalate** | New tools duplicating enterprise licences that have unused seats. `SUB-6.1` |

Cases 2 and 4 are written with particular care: the language describes what the records show and what is missing, and explicitly declines to draw a conclusion about any individual. A test asserts that no accusatory vocabulary appears in those explanations.

---

## The four screens

**Executive Overview** — four figures, one chart, one list. Spend against budget, budget remaining, what needs review, what is missing evidence; spend against budget by department; and the priority cases. Every figure links into the records behind it.

**Review Queue** — filterable table with sticky headers. Filter by verdict, risk, missing evidence and department; search across IDs, merchants, employees and clause IDs, in both languages.

**Transaction Investigation** — three columns. The record and receipt on the left, the assessment in the centre, the policy and the human decision on the right. A per-explanation English/Arabic switch works independently of the interface language.

**Policy Brain** — the published policy, searchable and filterable by category. Each clause shows its verbatim text, effective date, the machine-readable thresholds the engine reads, prior interpretations, and every transaction assessed against it.

**Audit Trail** — every rule evaluation, model call and human decision, with a detail drawer and a visual distinction between the three sources.

**Finance Copilot** — a drawer, available on every screen, answering grounded questions. Every answer carries the supporting transactions, the cited clauses, the numbers used, what is missing, and a recommended next action. It drafts; it never claims to have acted.

### Design

Light, neutral and dense: white surfaces separated by hairlines rather than cards or shadows, tabular numerals so columns align down the page, and one ink accent for interaction. Colour carries meaning only — the three status hues are reserved for verdicts and never appear without an accompanying text label, so the information survives greyscale printing and any form of colour blindness.

### Arabic

Full RTL with logical CSS properties throughout, professional business Arabic (written for a finance audience rather than machine-translated), Arabic transaction explanations, and Latin numerals retained so figures always match the ledger. Charts stay left-to-right by design — a mirrored axis reads as a data error, not a translation.

---

## Technology

| Choice | Why |
|---|---|
| **Next.js 16 (App Router)** | Server boundary for the API key; static prerendering of all 47 case pages |
| **TypeScript, strict** | The domain model is the specification. No unnecessary `any`. |
| **Tailwind CSS v4** | Design tokens in `@theme`; logical properties give RTL for free |
| **Zustand + persist** | Small store, `skipHydration` + manual rehydrate to avoid hydration mismatch |
| **Recharts** | Charts built to a validated palette |
| **Zod** | Runtime validation at the API boundary |
| **Vitest** | 88 tests over the engine, data, filters, store and presenter flow |

**Chart colour.** The department chart uses two steps of a single hue rather than two categorical hues. "Spent" and "committed" are parts of one magnitude, so a sequential encoding is the correct choice — and separation is then carried by lightness, which is colourblind-safe by construction. No chart uses a dual axis.

---

## Security approach

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

- No raw cardholder data is sent to a public model
- An open-weight model can run inside the client VPC where residency requires it
- Encryption at rest and in transit; private networking between services
- Role-based access for reviewers and policy owners
- Complete model-call logging, including prompt and model version
- Human approval before any financial action
- Configurable retention; policy and prompt versioning recorded against every decision

> Designed to support client security and residency requirements, subject to architecture and compliance review. Nothing in this repository asserts a certification or guarantees compliance.

## Known limitations

This is a proof of concept. Being specific about what it is not:

- **The dataset is fixed.** 47 transactions, one company, one month, one policy version.
- **Policy ingestion is not implemented.** Clause extraction from an arbitrary PDF is a substantial problem in itself; the policy here is a typed object, authored by hand.
- **Persistence is `localStorage`.** No server database, no multi-user concurrency, no real authentication. The signed-in reviewer is a fixed persona.
- **Duplicate detection is declared, not inferred.** The related-transaction links are authored in the dataset. Production would need real similarity matching over merchant, amount, date and receipt references.
- **No real integrations.** No card issuing, banking, payments or ERP.
- **Arabic is hand-written for this dataset**, not produced by a translation pipeline. New transactions would need Arabic explanations generated.
- **Claude mode rewrites prose only** — by design, but it means the model's contribution is deliberately narrow.
- **Accessibility has not been formally audited.** Focus states, semantic tables and hit targets are in place; a full WCAG audit has not been done.

## Production considerations

1. **Persistence** — move decisions and audit events to an append-only store. The audit trail should be write-once.
2. **Authentication and RBAC** — real identity, with reviewer and policy-owner roles genuinely separated; approval limits enforced server-side, not in the UI.
3. **Policy ingestion** — clause extraction with a human confirmation step per clause, clause-level versioning, and a diff view between policy versions.
4. **Rules engine as data** — clause thresholds already live in the policy object. The next step is making the *predicates* configurable per tenant rather than compiled in.
5. **Duplicate detection** — real fuzzy matching, with the match score surfaced as evidence.
6. **Model-call logging** — persist every prompt, response, prompt version and model version alongside the decision it informed.
7. **Evaluation harness** — see [`docs/EVALUATION.md`](docs/EVALUATION.md); the metrics there need a labelled ground-truth set to run against.
8. **PII redaction** — implement tokenisation before any model call, and test it adversarially.

## Documentation

| Document | Contents |
|---|---|
| [`docs/WALKTHROUGH.md`](docs/WALKTHROUGH.md) | Three-minute presenter script, with the exact clicks and the lines to say |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Frontend architecture, state, rules engine, AI abstraction, audit, security boundary, deployment |
| [`docs/EVALUATION.md`](docs/EVALUATION.md) | How this system should be measured, and what is measurable today |

## Project layout

```
src/
├── app/                    routes: overview, queue, transactions/[id],
│                           policy, audit, api/explain
├── components/
│   ├── layout/             shell, sidebar, top bar
│   ├── ui/                 primitives, modal, drawer, toasts
│   ├── charts/             Recharts wrapper and the shared chart language
│   ├── queue/              review table
│   ├── investigation/      the three columns of the case screen
│   ├── policy/             clause browser
│   ├── audit/              audit table and detail drawer
│   └── copilot/            finance copilot drawer
└── lib/
    ├── types.ts            the domain model
    ├── data/               company, policy, 47 transactions
    ├── engine/             rules, evidence, budget, analysis, filters
    ├── ai/                 mock narrative, copilot, Claude provider
    ├── i18n/               English and Arabic dictionaries
    └── store/              Zustand store and hooks
tests/                      88 tests
```

---

*Built as a demonstration of an AI intelligence layer for spend management. All data is fictional.*
