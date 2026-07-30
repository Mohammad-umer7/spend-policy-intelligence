# Presenter walkthrough

A three-minute run for a senior finance or executive audience. Every click below is covered by `tests/presenter-flow.test.ts`, so the flow cannot break for a data reason.

**Before you start**

- `npm run dev`, open <http://localhost:3000> at **1600 × 1000** or larger.
- Click **Reset data** at the foot of the sidebar so the queue starts at 11 open cases.

Times are cumulative.

---

## 0:00 — Executive Overview

**Say:**

> This is what a finance manager sees on a Monday morning. Not a list of transactions — a list of decisions.

Point across the four figures:

> AED 601,385 spent, 78% of budget. AED 167,615 remaining. Eleven transactions need a human. Eight are missing a document.

> There are no hard-coded totals anywhere in this build. Every number is computed from the ledger, and there is a test that asserts it.

Point at the chart:

> Five departments against one axis — spent, committed, and the budget line. Marketing is the only one whose forecast crosses it, by AED 18,400.

---

## 0:35 — Into the queue

**Do:** click **Review 3 priority cases**.

**Say:**

> Three cases cannot move without a decision from me. Verdict, risk, the clause that fired, and evidence completeness — four of five, five of five. I can triage this table without opening anything.

---

## 0:50 — Open the hotel case

**Do:** click the **Marsa Bay Hotel & Conference Centre** row (`TXN-2041`).

**Say:**

> Three columns. The record on the left, the assessment in the middle, the policy and my decision on the right.

Point left:

> Itemised receipt — executive room, tourism fee, conference floor surcharge. Trip pre-approved on the fourteenth. Booking confirmation attached.

---

## 1:10 — The assessment

**Say:**

> Escalate. And then four things I actually need: policy coverage complete, evidence four of five, risk medium, human review required.

**Beat — the line that lands:**

> Notice there is no confidence percentage. "87% confident" tells a reviewer nothing they can act on. Instead we name the uncertainty: *standard room availability was self-reported — no third-party confirmation attached.* That is something a human can go and resolve.

Read the explanation, then point at the findings:

> Three clauses evaluated. TRV-2.3 is the exception. TRV-2.1 and DOC-8.1 both passed — and it shows me those too, with the figures each rule used. I can see the working.

---

## 1:40 — Arabic

**Do:** in the explanation block, click **العربية**.

**Say:**

> Same explanation, professional business Arabic — not machine-translated. Figures stay in Latin numerals so they still match the ledger.

**Optional:** the top-bar toggle flips the whole interface RTL.

---

## 1:55 — Make the decision

**Do:** click **Approve exception**.

**Say:**

> It will not let me proceed without a note.

**Do:** try Confirm — disabled. Type:

> `Conference rate surge verified against the forum organiser. Approved as a documented exception under EXC-10.1.`

**Do:** click **Confirm decision**.

**Say:**

> Status moves to approved, the queue count drops, and an audit event is created. That note is now part of the permanent record.

---

## 2:15 — The audit trail

**Do:** from the right column, click **Audit Trail →**.

**Say:**

> Three sources. The deterministic rule that evaluated the clauses. The model that drafted the explanation, with its prompt and model version. And me, with the before and after status and my note.

> That separation is the point. When a regulator asks *who decided this*, the answer is a person, and the trail proves it.

---

## 2:35 — The copilot

**Do:** back to the case, open **Finance copilot**, click *Would approving this expense exceed the department budget?*

**Say:**

> *Yes — but the budget is already forecast to be exceeded before this decision.* Marketing has spent 146,200 against a 172,000 budget with 44,200 committed — forecast 190,400, which is 18,400 over. The charge already settled, so approving adds no new spend; what it does is accept 1,350 above the band as a documented exception.

Point below the answer:

> Every answer carries the numbers it used, the transactions it read, the clauses it cited, and what is still missing. And at the bottom — *draft prepared for human review*. It never claims to have done anything.

---

## 3:00 — Close

> AI-assisted, human-reviewed. The rules engine decides, the model explains, a person approves. That is the only version of this a regulated finance team can actually deploy.

---

## If you have another minute

| Show | Why it lands |
|---|---|
| **Policy Brain** → click a clause | The verbatim published text, its effective date, the machine-readable thresholds the engine reads, and every transaction assessed against it. |
| **Queue** → filter *Missing evidence* | Eight cases; one information request could clear most of them. |
| The duplicate case (`TXN-2029`) | Read the explanation aloud. It describes the pattern and then explicitly declines to accuse anyone. |

## Recovery

| If | Do |
|---|---|
| The queue looks wrong | **Reset data** in the sidebar |
| You approved something by accident | Reset, or carry on — the flow still works |
