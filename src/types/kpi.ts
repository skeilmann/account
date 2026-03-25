import type { CompanyId } from "./company";

export interface KPIValue {
  /** Value in RON */
  amount: number;
  /** Per-company breakdown */
  perCompany: Record<CompanyId, number>;
  /** Change vs previous period (null if no comparison data) */
  changePercent: number | null;
  /** Per-company change vs previous period */
  perCompanyChange: Record<CompanyId, number | null>;
}

export interface KPISet {
  revenue: KPIValue;
  expenses: KPIValue;
  profit: KPIValue;
  margin: KPIValue; // amount is percentage, not RON
  stockValue: KPIValue;
  cashPosition: KPIValue;
}

export type KPIKey = keyof KPISet;

export type RAGStatus = "green" | "amber" | "red";

export interface KPICardData {
  key: KPIKey;
  value: KPIValue;
  ragStatus: RAGStatus;
  isPercentage: boolean;
}
