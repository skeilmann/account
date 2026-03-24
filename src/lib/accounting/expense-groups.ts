import type { NormalizedBalantaRow } from "@/types/balanta";
import type { CompanyId } from "@/types/company";
import {
  EXPENSE_GROUP_DEFINITIONS,
  type ExpenseGroupValue,
} from "@/types/expense-group";

/**
 * Calculate expense group values from Balanta rows.
 * Uses SumeTotale (debit side) for class 6 expense accounts.
 */
export function calcExpenseGroups(
  rows: NormalizedBalantaRow[],
  totalExpenses: number,
  totalRevenue: number
): ExpenseGroupValue[] {
  return EXPENSE_GROUP_DEFINITIONS.map((def) => {
    const matchingRows = rows.filter(
      (r) =>
        !r.isClassTotal &&
        !r.isGrandTotal &&
        def.accounts.some((prefix) => r.cont.startsWith(prefix))
    );

    const totalAmount = matchingRows.reduce(
      (sum, r) => sum + r.sumeTotaleD,
      0
    );

    return {
      definition: def,
      totalAmount,
      perCompany: { ifp: 0, filato: 0 }, // Will be set by combined calc
      percentOfExpenses:
        totalExpenses > 0 ? (totalAmount / totalExpenses) * 100 : 0,
      percentOfRevenue:
        totalRevenue > 0 ? (totalAmount / totalRevenue) * 100 : 0,
    };
  }).filter((g) => g.totalAmount > 0); // Only show groups with actual expenses
}

/**
 * Calculate combined expense groups for both companies.
 */
export function calcCombinedExpenseGroups(
  ifpRows: NormalizedBalantaRow[],
  filatoRows: NormalizedBalantaRow[],
  totalExpenses: number,
  totalRevenue: number
): ExpenseGroupValue[] {
  return EXPENSE_GROUP_DEFINITIONS.map((def) => {
    const ifpAmount = getGroupAmount(ifpRows, def.accounts);
    const filatoAmount = getGroupAmount(filatoRows, def.accounts);
    const totalAmount = ifpAmount + filatoAmount;

    return {
      definition: def,
      totalAmount,
      perCompany: {
        ifp: ifpAmount,
        filato: filatoAmount,
      } as Record<CompanyId, number>,
      percentOfExpenses:
        totalExpenses > 0 ? (totalAmount / totalExpenses) * 100 : 0,
      percentOfRevenue:
        totalRevenue > 0 ? (totalAmount / totalRevenue) * 100 : 0,
    };
  }).filter((g) => g.totalAmount > 0);
}

function getGroupAmount(
  rows: NormalizedBalantaRow[],
  accountPrefixes: string[]
): number {
  return rows
    .filter(
      (r) =>
        !r.isClassTotal &&
        !r.isGrandTotal &&
        accountPrefixes.some((prefix) => r.cont.startsWith(prefix))
    )
    .reduce((sum, r) => sum + r.sumeTotaleD, 0);
}
