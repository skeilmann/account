import type { CompanyId } from "./company";

export interface StockRow {
  gestiune: string;
  produs: string;
  um: string; // Unit of measure: KG, BUC, M, etc.

  // Quantities
  cantStocInitial: number;
  cantIntrari: number;
  cantIesiri: number;
  cantStocFinal: number;

  // Values (RON)
  valSoldInitial: number;
  valIntrari: number;
  valIesiri: number;
  valSoldFinal: number;
}

export interface ParsedStock {
  companyId: CompanyId;
  companyName: string;
  companyCui: string;
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
  rows: StockRow[];
  totalValSoldInitial: number;
  totalValIntrari: number;
  totalValIesiri: number;
  totalValSoldFinal: number;
}
