import type { BudgetImpact, Department, DepartmentId, Transaction } from "../types";
import { departments, getEmployee } from "../data/company";
import { transactions } from "../data/transactions";

/**
 * Budget figures are derived from the transaction ledger, never hard-coded, so
 * the dashboard, the charts, the copilot and the investigation screen can only
 * ever quote the same numbers.
 */

export function spendByDepartment(ledger: Transaction[] = transactions): Map<DepartmentId, number> {
  const totals = new Map<DepartmentId, number>();
  for (const department of departments) totals.set(department.id, 0);
  for (const transaction of ledger) {
    const { departmentId } = getEmployee(transaction.employeeId);
    totals.set(departmentId, (totals.get(departmentId) ?? 0) + transaction.amountAed);
  }
  return totals;
}

export interface DepartmentBudgetSummary {
  department: Department;
  spentAed: number;
  committedAed: number;
  forecastAed: number;
  remainingAed: number;
  varianceAed: number;
  utilisation: number;
  isForecastOverBudget: boolean;
}

export function departmentBudgets(
  ledger: Transaction[] = transactions,
): DepartmentBudgetSummary[] {
  const spend = spendByDepartment(ledger);
  return departments.map((department) => {
    const spentAed = spend.get(department.id) ?? 0;
    const forecastAed = spentAed + department.committedAed;
    return {
      department,
      spentAed,
      committedAed: department.committedAed,
      forecastAed,
      remainingAed: department.monthlyBudgetAed - spentAed,
      varianceAed: forecastAed - department.monthlyBudgetAed,
      utilisation: spentAed / department.monthlyBudgetAed,
      isForecastOverBudget: forecastAed > department.monthlyBudgetAed,
    };
  });
}

export function companyTotals(ledger: Transaction[] = transactions) {
  const summaries = departmentBudgets(ledger);
  const totalSpend = summaries.reduce((sum, s) => sum + s.spentAed, 0);
  const totalBudget = summaries.reduce((sum, s) => sum + s.department.monthlyBudgetAed, 0);
  const totalCommitted = summaries.reduce((sum, s) => sum + s.committedAed, 0);
  return {
    totalSpend,
    totalBudget,
    totalCommitted,
    totalForecast: totalSpend + totalCommitted,
    remaining: totalBudget - totalSpend,
    utilisation: totalSpend / totalBudget,
    overBudgetDepartments: summaries.filter((s) => s.isForecastOverBudget),
  };
}

export function budgetImpact(
  transaction: Transaction,
  ledger: Transaction[] = transactions,
): BudgetImpact {
  const { departmentId } = getEmployee(transaction.employeeId);
  const summary = departmentBudgets(ledger).find((s) => s.department.id === departmentId);
  if (!summary) throw new Error(`No budget summary for department ${departmentId}`);

  return {
    departmentId,
    monthlyBudgetAed: summary.department.monthlyBudgetAed,
    spentAed: summary.spentAed,
    committedAed: summary.committedAed,
    remainingAed: summary.remainingAed,
    forecastAed: summary.forecastAed,
    forecastVarianceAed: summary.varianceAed,
    utilisation: summary.utilisation,
    // The card amount has already settled, so approving the exception does not
    // add new spend — what it changes is whether the amount stays in budget.
    remainingAfterApprovalAed: summary.department.monthlyBudgetAed - summary.forecastAed,
    wouldExceedBudget: summary.isForecastOverBudget,
  };
}

/** Month-to-date spend grouped by calendar day, for the trend chart. */
export function dailySpendSeries(
  ledger: Transaction[] = transactions,
): { day: string; label: string; amountAed: number; cumulativeAed: number }[] {
  const byDay = new Map<string, number>();
  for (const transaction of ledger) {
    const key = transaction.occurredAt.slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + transaction.amountAed);
  }
  let cumulative = 0;
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, amountAed]) => {
      cumulative += amountAed;
      return {
        day,
        label: String(Number(day.slice(8, 10))),
        amountAed,
        cumulativeAed: cumulative,
      };
    });
}
