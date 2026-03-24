import type { NormalizedBalantaRow } from "@/types/balanta";
import type { CompanyId } from "@/types/company";
import type { KPISet, KPIValue } from "@/types/kpi";

/**
 * Calculate total revenue from Balanta rows.
 * Revenue = sum of class 7 accounts sume_totale_c (credit side).
 */
export function calcRevenue(rows: NormalizedBalantaRow[]): number {
  return rows
    .filter((r) => r.accountClass === 7 && !r.isClassTotal && !r.isGrandTotal)
    .reduce((sum, r) => sum + r.sumeTotaleC, 0);
}

/**
 * Calculate total expenses from Balanta rows.
 * Expenses = sum of class 6 accounts sume_totale_d (debit side).
 */
export function calcExpenses(rows: NormalizedBalantaRow[]): number {
  return rows
    .filter((r) => r.accountClass === 6 && !r.isClassTotal && !r.isGrandTotal)
    .reduce((sum, r) => sum + r.sumeTotaleD, 0);
}

/**
 * Calculate net profit from account 121 (Profit si pierdere).
 * Profit = sold_final_c - sold_final_d of account 121.
 */
export function calcProfit(rows: NormalizedBalantaRow[]): number {
  const account121 = rows.find(
    (r) => r.cont === "121" && !r.isClassTotal && !r.isGrandTotal
  );
  if (!account121) return 0;
  return account121.soldFinalC - account121.soldFinalD;
}

/**
 * Calculate profit margin as percentage.
 */
export function calcMargin(revenue: number, profit: number): number {
  if (revenue === 0) return 0;
  return (profit / revenue) * 100;
}

/**
 * Calculate stock value from account 371 (Marfuri) sold_final_d.
 */
export function calcStockValue(rows: NormalizedBalantaRow[]): number {
  const account371 = rows.find(
    (r) => r.cont === "371" && !r.isClassTotal && !r.isGrandTotal
  );
  return account371?.soldFinalD ?? 0;
}

/**
 * Calculate cash position from class 5 bank + cash accounts.
 * Cash = sum of (5121 + 5124 + 5311) sold_final_d.
 */
export function calcCashPosition(rows: NormalizedBalantaRow[]): number {
  const cashAccounts = ["5121", "5124", "5311"];
  return rows
    .filter(
      (r) =>
        cashAccounts.includes(r.cont) && !r.isClassTotal && !r.isGrandTotal
    )
    .reduce((sum, r) => sum + r.soldFinalD, 0);
}

/**
 * Calculate all 6 KPIs for a single company.
 */
export function calcCompanyKPIs(rows: NormalizedBalantaRow[]): {
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  stockValue: number;
  cashPosition: number;
} {
  const revenue = calcRevenue(rows);
  const expenses = calcExpenses(rows);
  const profit = calcProfit(rows);
  const margin = calcMargin(revenue, profit);
  const stockValue = calcStockValue(rows);
  const cashPosition = calcCashPosition(rows);

  return { revenue, expenses, profit, margin, stockValue, cashPosition };
}

/**
 * Calculate full KPISet for combined view from both companies' data.
 */
export function calcKPISet(
  ifpRows: NormalizedBalantaRow[],
  filatoRows: NormalizedBalantaRow[]
): KPISet {
  const ifp = calcCompanyKPIs(ifpRows);
  const filato = calcCompanyKPIs(filatoRows);

  function makeKPIValue(
    ifpVal: number,
    filatoVal: number,
    isPercentage = false
  ): KPIValue {
    const amount = isPercentage
      ? calcMargin(ifp.revenue + filato.revenue, ifp.profit + filato.profit)
      : ifpVal + filatoVal;

    return {
      amount,
      perCompany: { ifp: ifpVal, filato: filatoVal },
      changePercent: null, // No comparison data available yet
    };
  }

  return {
    revenue: makeKPIValue(ifp.revenue, filato.revenue),
    expenses: makeKPIValue(ifp.expenses, filato.expenses),
    profit: makeKPIValue(ifp.profit, filato.profit),
    margin: makeKPIValue(ifp.margin, filato.margin, true),
    stockValue: makeKPIValue(ifp.stockValue, filato.stockValue),
    cashPosition: makeKPIValue(ifp.cashPosition, filato.cashPosition),
  };
}

/**
 * Get KPI value for a specific company view.
 */
export function getKPIForView(
  kpiSet: KPISet,
  key: keyof KPISet,
  view: CompanyId | "combined"
): number {
  const kpi = kpiSet[key];
  if (view === "combined") return kpi.amount;
  return kpi.perCompany[view];
}
