import type { CompanyId } from "./company";

/** A single sub-account entry from the detailed trial balance (Balanta detaliata) */
export interface DetailedAccountEntry {
  /** Full sub-account code, e.g. "401.00001" */
  cont: string;
  /** Parent account code, e.g. "401" */
  parentCont: string;
  /** Sub-account name, e.g. "PRECIOUS YARN S.R.L." */
  denumire: string;

  soldFinalD: number;
  soldFinalC: number;
  sumeTotaleD: number;
  sumeTotaleC: number;
  rulajePerioadaD: number;
  rulajePerioadaC: number;
  sumePrecedenteD: number;
  sumePrecedenteC: number;
}

/** Parsed result from a detailed trial balance PDF */
export interface ParsedBalantaDetaliata {
  companyId: CompanyId;
  companyName: string;
  periodStart: string;
  periodEnd: string;
  entries: DetailedAccountEntry[];
  /** Sub-accounts grouped by parent account code for O(1) lookup */
  byParent: Record<string, DetailedAccountEntry[]>;
}
