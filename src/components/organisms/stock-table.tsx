"use client";

import { useState } from "react";
import { Money } from "@/components/atoms/money";
import { useDataStore } from "@/stores/data-store";
import { useCompanyStore } from "@/stores/company-store";
import { COMPANY_VIEW_COLORS } from "@/types/company";
import type { StockRow } from "@/types/stock";
import { useTranslation } from "react-i18next";

type SortKey =
  | "produs"
  | "cantStocInitial"
  | "cantIntrari"
  | "cantStocFinal"
  | "valSoldFinal"
  | "pretUnitar";

export function StockTable() {
  const stock = useDataStore((s) => s.stock);
  const { activeView } = useCompanyStore();
  const { t } = useTranslation("common");
  const [sortKey, setSortKey] = useState<SortKey>("valSoldFinal");
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  // Merge rows from both companies or filter by view
  const allRows: (StockRow & { companyId: "ifp" | "filato" })[] = [];

  if (activeView === "combined" || activeView === "ifp") {
    for (const row of stock.ifp?.rows ?? []) {
      allRows.push({ ...row, companyId: "ifp" });
    }
  }
  if (activeView === "combined" || activeView === "filato") {
    for (const row of stock.filato?.rows ?? []) {
      allRows.push({ ...row, companyId: "filato" });
    }
  }

  // Filter
  const filtered = allRows.filter(
    (r) =>
      r.produs.toLowerCase().includes(search.toLowerCase()) ||
      r.gestiune.toLowerCase().includes(search.toLowerCase())
  );

  function unitPrice(r: StockRow) {
    return r.cantStocFinal !== 0 ? r.valSoldFinal / r.cantStocFinal : 0;
  }

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "produs") cmp = a.produs.localeCompare(b.produs);
    else if (sortKey === "pretUnitar") cmp = unitPrice(a) - unitPrice(b);
    else cmp = (a[sortKey] ?? 0) - (b[sortKey] ?? 0);
    return sortAsc ? cmp : -cmp;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(key === "produs");
    }
  }

  const totalValue = filtered.reduce((s, r) => s + r.valSoldFinal, 0);
  const totalKg = filtered
    .filter((r) => r.um.toUpperCase() === "KG")
    .reduce((s, r) => s + r.cantStocFinal, 0);

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">{t("nav.stock")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("stock_table.products_count", { count: filtered.length })} &middot;{" "}
            {totalKg > 0 && (
              <>
                <span className="font-medium text-foreground">
                  {totalKg.toLocaleString("ro-RO", { maximumFractionDigits: 2 })} kg
                </span>
                {" "}&middot;{" "}
              </>
            )}
            Total: <Money amount={totalValue} className="text-xs" />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className={`px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
              showDetails
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-secondary border-border text-muted-foreground hover:text-foreground"
            }`}
            title={t("stock_table.details_tooltip")}
          >
            {t("stock_table.details")}
          </button>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("stock_table.search")}
            className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs w-48 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-border">
              {activeView === "combined" && (
                <th className="px-4 py-2.5 text-left text-muted-foreground font-medium">
                  Co.
                </th>
              )}
              <th
                className="px-4 py-2.5 text-left text-muted-foreground font-medium cursor-pointer hover:text-foreground"
                onClick={() => toggleSort("produs")}
              >
                {t("stock_table.col_product")} {sortKey === "produs" && (sortAsc ? "\u2191" : "\u2193")}
              </th>
              {showDetails && (
                <th
                  className="px-4 py-2.5 text-right text-muted-foreground font-medium cursor-pointer hover:text-foreground"
                  onClick={() => toggleSort("cantStocInitial")}
                >
                  {t("stock_table.col_initial_stock")}{" "}
                  {sortKey === "cantStocInitial" && (sortAsc ? "↑" : "↓")}
                </th>
              )}
              {showDetails && (
                <th
                  className="px-4 py-2.5 text-right text-muted-foreground font-medium cursor-pointer hover:text-foreground"
                  onClick={() => toggleSort("cantIntrari")}
                >
                  {t("stock_table.col_entries")}{" "}
                  {sortKey === "cantIntrari" && (sortAsc ? "↑" : "↓")}
                </th>
              )}
              <th
                className="px-4 py-2.5 text-right text-muted-foreground font-medium cursor-pointer hover:text-foreground"
                onClick={() => toggleSort("cantStocFinal")}
              >
                {t("stock_table.col_final_stock")}{" "}
                {sortKey === "cantStocFinal" && (sortAsc ? "\u2191" : "\u2193")}
              </th>
              <th
                className="px-4 py-2.5 text-right text-muted-foreground font-medium cursor-pointer hover:text-foreground"
                onClick={() => toggleSort("pretUnitar")}
              >
                {t("stock_table.col_price_kg")}{" "}
                {sortKey === "pretUnitar" && (sortAsc ? "\u2191" : "\u2193")}
              </th>
              <th
                className="px-4 py-2.5 text-right text-muted-foreground font-medium cursor-pointer hover:text-foreground"
                onClick={() => toggleSort("valSoldFinal")}
              >
                {t("stock_table.col_value")}{" "}
                {sortKey === "valSoldFinal" && (sortAsc ? "\u2191" : "\u2193")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={`${row.companyId}-${row.produs}-${i}`}
                className="border-b border-border/30 hover:bg-secondary/30 transition-colors"
              >
                {activeView === "combined" && (
                  <td className="px-4 py-2">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: COMPANY_VIEW_COLORS[row.companyId],
                      }}
                      title={row.companyId.toUpperCase()}
                    />
                  </td>
                )}
                <td className="px-4 py-2">{row.produs}</td>
                {showDetails && (
                  <td className="px-4 py-2 text-right font-mono font-tabular text-muted-foreground">
                    {row.cantStocInitial.toLocaleString("ro-RO", {
                      maximumFractionDigits: 2,
                    })}
                  </td>
                )}
                {showDetails && (
                  <td className="px-4 py-2 text-right font-mono font-tabular text-muted-foreground">
                    {row.cantIntrari.toLocaleString("ro-RO", {
                      maximumFractionDigits: 2,
                    })}
                  </td>
                )}
                <td className="px-4 py-2 text-right font-mono font-tabular">
                  {row.cantStocFinal.toLocaleString("ro-RO", {
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="px-4 py-2 text-right">
                  {row.cantStocFinal !== 0 ? (
                    <Money amount={unitPrice(row)} className="text-xs" />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <Money amount={row.valSoldFinal} className="text-xs" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
