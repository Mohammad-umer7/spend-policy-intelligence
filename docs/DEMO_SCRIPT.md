# Three-minute demo script

For a live presentation to senior fintech executives. Every click below is verified by the `tests/demo-flow.test.ts` suite, so the flow cannot break for a data reason.

**Before you start**

- Run `npm run dev` and open <http://localhost:3000> at **1920 × 1080** (or 1440 × 900).
- Go to **Settings → Reset demo data** so the queue starts at 11 open cases.
- Have the language toggle in the top bar in mind — you will use it once.

Times are cumulative.

---

## 0:00 — Open on the Executive Overview

**Do:** land on `/`.

**Say:**

> This is what a finance manager sees on a Monday morning. Not a list of transactions — a list of decisions.

Point at the daily brief, top left:

> Marketing is forecast to exceed its monthly budget by AED 18,400. Three transactions require immediate review, and two software subscriptions may overlap with existing licences.

> That sentence is generated, not written. Every figure in it is computed from the same ledger the rest of the screen reads. If I approve something, the sentence changes.

**Beat:** the whole page is legible in about ten seconds — total spend, budget used, what needs review, what is high risk, what is missing evidence.

---

## 0:25 — Show the numbers reconcile

**Do:** point across the KPI strip, then down to the department chart.

**Say:**

> AED 601,385 spent against a AED 769,000 budget. Eleven cases waiting on a human. Marketing is the only department where the forecast crosses the line — spent plus committed against budget, on one axis, so you can compare five departments at a glance.

> There are no hard-coded totals anywhere in this build. There is a test that asserts it.

---

## 0:45 — Into the queue

**Do:** click **Review 3 priority cases**.

**Say:**

> These three are the ones that cannot move without me. Everything else is either informational or waiting on a document.

Point at the columns:

> Verdict, risk, the clause that fired, and evidence completeness — four of five items attached, five of five, and so on. I can triage this table without opening anything.

---

## 1:00 — Open the hotel case

**Do:** click the **Marsa Bay Hotel & Conference Centre** row (`TXN-2041`).

**Say:**

> Three columns. The record on the left, the assessment in the middle, the policy and my decision on the right.

Point left:

> The receipt is right there, itemised — executive room, tourism fee, conference floor surcharge. The trip was pre-approved on the fourteenth. The booking confirmation is attached.

---

## 1:20 — The assessment

**Do:** point at the verdict block.

**Say:**

> Escalate. And then four things I actually need:

> Policy coverage: complete. Evidence completeness: four of five. Risk: medium. Human review: required.

**Beat — this is the line that lands:**

> Notice there is no confidence percentage. A number like "87% confident" tells a reviewer nothing they can act on. Instead we name the uncertainty: *standard room availability was self-reported by the employee — no third-party confirmation was attached.* That is something a human can go and resolve.

Read the explanation:

> The charge exceeds Rana's approved band by AED 1,350 — 4,850 against a 3,500 band for two nights at Senior Manager grade. Trip approved, folio attached, availability self-reported. Under clause TRV-2.3 the difference must be approved as a documented exception by the Finance Director — and it says explicitly, *it is not a decision the system can take.*

Scroll to the findings:

> Three clauses were evaluated. TRV-2.3 is the exception. TRV-2.1 and DOC-8.1 both passed — and it shows me that too, with the figures each rule used. I can see the working.

---

## 1:50 — Arabic

**Do:** in the explanation block, click **العربية**.

**Say:**

> Same explanation, professional business Arabic — not a machine translation, and the figures stay in Latin numerals so they still match the ledger. Half the finance teams in this region work in both.

**Optional (three seconds):** click the top-bar language toggle to flip the whole interface RTL, then flip back.

---

## 2:05 — Make the decision

**Do:** click **Approve exception**.

**Say:**

> Confirmation modal, and it will not let me proceed without a note.

**Do:** try to click Confirm — it is disabled. Then type:

> `Conference rate surge verified against the forum organiser. Approved as a documented exception under EXC-10.1.`

**Do:** click **Confirm decision**.

**Say:**

> Status moves to approved, the dashboard count drops, and an audit event is created. That note is now part of the permanent record.

---

## 2:25 — The audit trail

**Do:** from the right column, click **Audit Trail**.

**Say:**

> Three sources, visually distinct. The deterministic rule that evaluated the clauses. The model that drafted the explanation, with its prompt and model version. And me, with the before and after status and my note.

> That separation is the whole point. When a regulator asks *who decided this*, the answer is a person, and the trail proves it.

---

## 2:40 — The copilot

**Do:** go back to the case, open **Finance copilot**, click *Would approving this expense exceed the department budget?*

**Say:**

> And the answer is grounded, not generated:

> *Yes — but the budget is already forecast to be exceeded before this decision.* Marketing has spent 146,200 against a 172,000 budget with 44,200 committed — a forecast of 190,400, which is 18,400 over. The card charge already settled, so approving adds no new spend; what it does is accept 1,350 above the band as a documented exception.

Point at the panels below the answer:

> Every answer carries the numbers it used, the transactions it read, the clauses it cited, and what is still missing. And at the bottom — *draft prepared for human review*. It never claims to have done anything.

---

## 3:00 — Close

**Say:**

> AI-assisted, human-reviewed. The rules engine decides, the model explains, and a person approves. That is the only version of this a regulated finance team can actually deploy.

> All of this data is synthetic — the badge is on every screen.

---

## If you have another minute

| Show | Why it lands |
|---|---|
| **Policy Brain** → run the simulated ingestion | It stops at *awaiting policy-owner publication*. A policy is never activated automatically. |
| **Policy Brain** → suggested precedent | Repeated reviewer decisions become a *proposal*, marked *requires policy-owner approval*. One decision never becomes policy. |
| **Queue** → filter *Missing evidence* | Eight cases, one information request could clear most of them. |
| **Security** page | The processing boundary diagram, and the deliberately careful language: *designed to support…subject to architecture and compliance review*. |
| The duplicate case (`TXN-2029`) | Read the explanation aloud. It describes the pattern and then explicitly declines to accuse anyone. |

## Recovery

| If | Do |
|---|---|
| The queue looks wrong | **Settings → Reset demo data** |
| You approved something by accident | Reset, or just carry on — the flow still works |
| A page looks odd after a resize | Reload; layout is derived, not cached |
