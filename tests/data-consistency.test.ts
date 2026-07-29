import { describe, expect, it } from "vitest";
import { departments, employees, getEmployee } from "@/lib/data/company";
import { transactions } from "@/lib/data/transactions";
import { policy } from "@/lib/data/policy";
import { baseCases } from "@/lib/engine/analysis";
import {
  budgetImpact,
  companyTotals,
  dailySpendSeries,
  departmentBudgets,
  spendByDepartment,
} from "@/lib/engine/budget";
import { buildDailyBrief } from "@/lib/ai/brief";

const cases = baseCases();

describe("referential integrity", () => {
  it("has unique transaction ids", () => {
    const ids = transactions.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resolves every employee reference", () => {
    for (const transaction of transactions) {
      expect(() => getEmployee(transaction.employeeId)).not.toThrow();
    }
  });

  it("has no dangling related-transaction links", () => {
    const ids = new Set(transactions.map((t) => t.id));
    for (const transaction of transactions) {
      for (const link of transaction.related) {
        expect(ids.has(link.transactionId), `${transaction.id} -> ${link.transactionId}`).toBe(true);
      }
    }
  });

  it("links possible duplicates symmetrically", () => {
    for (const transaction of transactions) {
      for (const link of transaction.related.filter((r) => r.relationship === "possible_duplicate")) {
        const other = transactions.find((t) => t.id === link.transactionId);
        expect(other?.related.some((r) => r.transactionId === transaction.id)).toBe(true);
      }
    }
  });

  it("assigns every employee to a real department", () => {
    const ids = new Set(departments.map((d) => d.id));
    for (const employee of employees) expect(ids.has(employee.departmentId)).toBe(true);
  });

  it("publishes a policy with a clause for every category it claims to cover", () => {
    const categories = new Set(policy.clauses.map((c) => c.category));
    expect(categories.size).toBe(policy.clauses.length);
    expect(policy.clauses.length).toBeGreaterThanOrEqual(12);
  });

  it("keeps receipt line items reconciled with the receipt total", () => {
    for (const transaction of transactions) {
      if (!transaction.receipt) continue;
      const sum = transaction.receipt.lines.reduce((total, line) => total + line.amountAed, 0);
      expect(sum, `${transaction.id} receipt lines`).toBe(transaction.receipt.totalAed);
      if (!transaction.receipt.mismatch) {
        expect(transaction.receipt.totalAed).toBe(transaction.amountAed);
      }
    }
  });
});

describe("budget calculations", () => {
  it("derives department spend from the ledger, not from stored figures", () => {
    const spend = spendByDepartment();
    for (const department of departments) {
      const expected = transactions
        .filter((t) => getEmployee(t.employeeId).departmentId === department.id)
        .reduce((sum, t) => sum + t.amountAed, 0);
      expect(spend.get(department.id)).toBe(expected);
    }
  });

  it("totals the company figures from the same ledger", () => {
    const totals = companyTotals();
    const ledgerTotal = transactions.reduce((sum, t) => sum + t.amountAed, 0);
    expect(totals.totalSpend).toBe(ledgerTotal);
    expect(totals.totalBudget).toBe(
      departments.reduce((sum, d) => sum + d.monthlyBudgetAed, 0),
    );
    expect(totals.totalForecast).toBe(totals.totalSpend + totals.totalCommitted);
    expect(totals.remaining).toBe(totals.totalBudget - totals.totalSpend);
  });

  it("forecasts Marketing exactly AED 18,400 over budget", () => {
    const marketing = departmentBudgets().find((b) => b.department.id === "marketing");
    expect(marketing).toBeDefined();
    expect(marketing!.varianceAed).toBe(18_400);
    expect(marketing!.isForecastOverBudget).toBe(true);
  });

  it("has exactly one department forecast over budget", () => {
    expect(departmentBudgets().filter((b) => b.isForecastOverBudget)).toHaveLength(1);
  });

  it("reports the same budget position on the case as on the department", () => {
    const record = cases.find((c) => c.transaction.id === "TXN-2041")!;
    const impact = budgetImpact(record.transaction);
    const marketing = departmentBudgets().find((b) => b.department.id === "marketing")!;
    expect(impact.spentAed).toBe(marketing.spentAed);
    expect(impact.forecastAed).toBe(marketing.forecastAed);
    expect(impact.forecastVarianceAed).toBe(marketing.varianceAed);
    expect(impact.wouldExceedBudget).toBe(true);
    expect(impact.remainingAfterApprovalAed).toBe(-18_400);
  });

  it("builds a cumulative daily series that ends at the ledger total", () => {
    const series = dailySpendSeries();
    expect(series.length).toBeGreaterThan(0);
    const last = series[series.length - 1];
    expect(last.cumulativeAed).toBe(transactions.reduce((sum, t) => sum + t.amountAed, 0));
    // Cumulative must be monotonic.
    for (let i = 1; i < series.length; i += 1) {
      expect(series[i].cumulativeAed).toBeGreaterThanOrEqual(series[i - 1].cumulativeAed);
    }
  });
});

describe("daily brief", () => {
  it("quotes figures that match the engine", () => {
    const brief = buildDailyBrief(cases);
    expect(brief.headline).toContain("Marketing");
    expect(brief.headline).toContain("18,400");
    expect(brief.headline).toContain("3 transactions require immediate review");
    expect(brief.headline).toContain("2 software subscriptions");
  });

  it("prices potential savings from the overlapping subscriptions plus duplicate exposure", () => {
    const brief = buildDailyBrief(cases);
    // Trailhead PM 6,300 + Northlight BI 3,400 + smaller duplicate 8,720
    expect(brief.potentialSavingsAed).toBe(6_300 + 3_400 + 8_720);
  });

  it("points every insight at a route that exists", () => {
    const brief = buildDailyBrief(cases);
    const all = [
      ...brief.attention,
      ...brief.budgetRisks,
      ...brief.policyExceptions,
      ...brief.missingDocuments,
      ...brief.vendorObservations,
      ...brief.savings,
      ...brief.recommendedActions,
    ];
    expect(all.length).toBeGreaterThan(0);
    for (const insight of all) {
      expect(insight.href.startsWith("/")).toBe(true);
      for (const id of insight.transactionIds) {
        expect(transactions.some((t) => t.id === id)).toBe(true);
      }
    }
  });

  it("nominates the most urgent case from the open escalations", () => {
    const brief = buildDailyBrief(cases);
    expect(brief.mostUrgent?.analysis.verdict).toBe("escalate");
  });
});
