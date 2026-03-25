import { create } from "zustand";
import type { NormalizedBalantaRow, ParsedBalanta } from "@/types/balanta";
import type { ParsedStock } from "@/types/stock";
import type { CompanyId } from "@/types/company";
import type { KPISet } from "@/types/kpi";
import { calcKPISet } from "@/lib/accounting/kpi-calculator";
import { calcCombinedExpenseGroups, calcCombinedRevenueGroups } from "@/lib/accounting/expense-groups";
import type { ExpenseGroupValue, RevenueGroupValue } from "@/types/expense-group";
import type {
  DetailedAccountEntry,
  ParsedBalantaDetaliata,
} from "@/types/balanta-detaliata";
import preloadedData from "@/data/preloaded.json";
import preloadedDetaliata from "@/data/preloaded-detaliata.json";
import preloaded2024 from "@/data/preloaded-2024.json";

interface DataState {
  balanta: Record<CompanyId, ParsedBalanta | null>;
  priorBalanta: Record<CompanyId, ParsedBalanta | null>;
  balantaDetaliata: Record<CompanyId, ParsedBalantaDetaliata | null>;
  stock: Record<CompanyId, ParsedStock | null>;
  kpiSet: KPISet | null;
  expenseGroups: ExpenseGroupValue[];
  revenueGroups: RevenueGroupValue[];
  setBalanta: (companyId: CompanyId, data: ParsedBalanta) => void;
  setBalantaDetaliata: (
    companyId: CompanyId,
    data: ParsedBalantaDetaliata
  ) => void;
  setStock: (companyId: CompanyId, data: ParsedStock) => void;
  /** Get sub-accounts for a parent account, combining both companies */
  getSubAccounts: (
    parentCont: string,
    companyFilter?: CompanyId | "combined"
  ) => DetailedAccountEntry[];
}

function recompute(state: {
  balanta: Record<CompanyId, ParsedBalanta | null>;
  priorBalanta: Record<CompanyId, ParsedBalanta | null>;
}): { kpiSet: KPISet | null; expenseGroups: ExpenseGroupValue[]; revenueGroups: RevenueGroupValue[] } {
  const ifpRows = (state.balanta.ifp?.rows ?? []) as NormalizedBalantaRow[];
  const filatoRows = (state.balanta.filato?.rows ??
    []) as NormalizedBalantaRow[];

  if (ifpRows.length === 0 && filatoRows.length === 0) {
    return { kpiSet: null, expenseGroups: [], revenueGroups: [] };
  }

  const priorIfpRows = (state.priorBalanta.ifp?.rows ??
    []) as NormalizedBalantaRow[];
  const priorFilatoRows = (state.priorBalanta.filato?.rows ??
    []) as NormalizedBalantaRow[];

  const kpiSet = calcKPISet(
    ifpRows,
    filatoRows,
    priorIfpRows.length > 0 ? priorIfpRows : undefined,
    priorFilatoRows.length > 0 ? priorFilatoRows : undefined
  );
  const expenseGroups = calcCombinedExpenseGroups(
    ifpRows,
    filatoRows,
    kpiSet.expenses.amount,
    kpiSet.revenue.amount
  );
  const revenueGroups = calcCombinedRevenueGroups(
    ifpRows,
    filatoRows,
    kpiSet.revenue.amount
  );

  return { kpiSet, expenseGroups, revenueGroups };
}

// Pre-compute from embedded data
const initialBalanta = {
  ifp: preloadedData.balanta.ifp as unknown as ParsedBalanta,
  filato: preloadedData.balanta.filato as unknown as ParsedBalanta,
};
const initialPriorBalanta = {
  ifp: preloaded2024.balanta.ifp as unknown as ParsedBalanta,
  filato: preloaded2024.balanta.filato as unknown as ParsedBalanta,
};
const initialStock = {
  ifp: preloadedData.stock.ifp as unknown as ParsedStock,
  filato: preloadedData.stock.filato as unknown as ParsedStock,
};
const initialComputed = recompute({
  balanta: initialBalanta,
  priorBalanta: initialPriorBalanta,
});
const initialDetaliata = {
  ifp: preloadedDetaliata.ifp as unknown as ParsedBalantaDetaliata,
  filato: preloadedDetaliata.filato as unknown as ParsedBalantaDetaliata | null,
};

export const useDataStore = create<DataState>((set, get) => ({
  balanta: initialBalanta,
  priorBalanta: initialPriorBalanta,
  balantaDetaliata: initialDetaliata,
  stock: initialStock,
  kpiSet: initialComputed.kpiSet,
  expenseGroups: initialComputed.expenseGroups,
  revenueGroups: initialComputed.revenueGroups,

  setBalanta: (companyId, data) => {
    const newBalanta = { ...get().balanta, [companyId]: data };
    const computed = recompute({
      balanta: newBalanta,
      priorBalanta: get().priorBalanta,
    });
    set({ balanta: newBalanta, ...computed });
  },

  setBalantaDetaliata: (companyId, data) => {
    set({
      balantaDetaliata: { ...get().balantaDetaliata, [companyId]: data },
    });
  },

  setStock: (companyId, data) => {
    set({ stock: { ...get().stock, [companyId]: data } });
  },

  getSubAccounts: (parentCont, companyFilter = "combined") => {
    const { balantaDetaliata: det } = get();
    const results: DetailedAccountEntry[] = [];

    if (
      (companyFilter === "combined" || companyFilter === "ifp") &&
      det.ifp?.byParent[parentCont]
    ) {
      results.push(...det.ifp.byParent[parentCont]);
    }
    if (
      (companyFilter === "combined" || companyFilter === "filato") &&
      det.filato?.byParent[parentCont]
    ) {
      results.push(...det.filato.byParent[parentCont]);
    }

    return results;
  },
}));

export function getRowsForView(
  balanta: Record<CompanyId, ParsedBalanta | null>,
  view: CompanyId | "combined"
): NormalizedBalantaRow[] {
  if (view === "combined") {
    return [
      ...((balanta.ifp?.rows ?? []) as NormalizedBalantaRow[]),
      ...((balanta.filato?.rows ?? []) as NormalizedBalantaRow[]),
    ];
  }
  return (balanta[view]?.rows ?? []) as NormalizedBalantaRow[];
}
