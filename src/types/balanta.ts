import type { CompanyId } from "./company";

/** The two known export formats from SAGA C software */
export type BalantaFormat = "ifp_10col" | "filato_8col";

/**
 * Raw row as extracted from PDF before normalization.
 * `values` length depends on format: 10 for IFP, 8 for FILATO.
 */
export interface RawBalantaRow {
  cont: string;
  denumire: string;
  values: number[];
}

/**
 * Normalized row — all formats map to this 5-pair structure.
 * For FILATO format, soldInitialD/C will be 0.
 */
export interface NormalizedBalantaRow {
  cont: string;
  denumire: string;

  // Pair 1: Opening balances for the period (IFP only, 0 for FILATO)
  soldInitialD: number;
  soldInitialC: number;

  // Pair 2: Cumulative prior periods (Jan-Nov for December file)
  sumePrecedenteD: number;
  sumePrecedenteC: number;

  // Pair 3: Current period movements (December for December file)
  rulajePerioadaD: number;
  rulajePerioadaC: number;

  // Pair 4: Total cumulative (Sume precedente + Rulaje perioada)
  sumeTotaleD: number;
  sumeTotaleC: number;

  // Pair 5: Final balances
  soldFinalD: number;
  soldFinalC: number;

  // Metadata
  isClassTotal: boolean;
  isGrandTotal: boolean;
  accountClass: number | null;
}

/** Parsed result from a single Balanta PDF */
export interface ParsedBalanta {
  companyId: CompanyId;
  companyName: string;
  companyCui: string;
  format: BalantaFormat;
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
  rows: NormalizedBalantaRow[];
  totalRow: NormalizedBalantaRow | null;
}
