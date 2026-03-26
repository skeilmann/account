"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Money } from "@/components/atoms/money";
import { useDataStore } from "@/stores/data-store";
import { useCompanyStore } from "@/stores/company-store";
import { useCurrencyStore } from "@/stores/currency-store";
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

type ExtendedRow = StockRow & { companyId: "ifp" | "filato" };

interface PriceBand {
  id: string;
  min: number;
  max: number | null; // null = unbounded upper
}

const PRICE_BANDS: PriceBand[] = [
  { id: "0-3", min: 0, max: 3 },
  { id: "3-6", min: 3, max: 6 },
  { id: "6-10", min: 6, max: 10 },
  { id: "10-15", min: 10, max: 15 },
  { id: "15+", min: 15, max: null },
];

interface PriceGroup {
  band: PriceBand;
  isOther: boolean;
  rows: ExtendedRow[];
  totalKg: number;
  totalValue: number;
}

export function StockTable() {
  const stock = useDataStore((s) => s.stock);
  const { activeView } = useCompanyStore();
  const { eurRate, customRate } = useCurrencyStore();
  const { t } = useTranslation("common");
  const [sortKey, setSortKey] = useState<SortKey>("valSoldFinal");
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [groupByPrice, setGroupByPrice] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const rate = customRate || eurRate;

  // Merge rows from both companies or filter by view
  const allRows: ExtendedRow[] = [];

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

  function eurPerKg(r: StockRow): number | null {
    if (r.um.toUpperCase() !== "KG" || r.cantStocFinal <= 0) return null;
    return r.valSoldFinal / r.cantStocFinal / rate;
  }

  const priceGroups = useMemo((): PriceGroup[] => {
    if (!groupByPrice) return [];

    const bandGroups = new Map<string, ExtendedRow[]>();
    for (const band of PRICE_BANDS) bandGroups.set(band.id, []);
    const otherRows: ExtendedRow[] = [];

    for (const row of sorted) {
      const price = eurPerKg(row);
      if (price === null) {
        otherRows.push(row);
        continue;
      }
      const band = PRICE_BANDS.find(
        (b) => price >= b.min && (b.max === null || price < b.max)
      );
      if (band) bandGroups.get(band.id)!.push(row);
      else otherRows.push(row);
    }

    const groups: PriceGroup[] = [];
    for (const band of PRICE_BANDS) {
      const rows = bandGroups.get(band.id)!;
      if (rows.length === 0) continue;
      groups.push({
        band,
        isOther: false,
        rows,
        totalKg: rows
          .filter((r) => r.um.toUpperCase() === "KG")
          .reduce((s, r) => s + r.cantStocFinal, 0),
        totalValue: rows.reduce((s, r) => s + r.valSoldFinal, 0),
      });
    }
    if (otherRows.length > 0) {
      groups.push({
        band: { id: "other", min: 0, max: null },
        isOther: true,
        rows: otherRows,
        totalKg: 0,
        totalValue: otherRows.reduce((s, r) => s + r.valSoldFinal, 0),
      });
    }
    return groups;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupByPrice, sorted, rate]);

  function toggleGroup(id: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function groupLabel(group: PriceGroup): string {
    if (group.isOther) return t("stock_table.group_other");
    if (group.band.max === null)
      return t("stock_table.group_label_above", { min: group.band.min });
    return t("stock_table.group_label", {
      min: group.band.min,
      max: group.band.max,
    });
  }

  const colCount = 3 + (showDetails ? 2 : 0) + (activeView === "combined" ? 1 : 0);

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
            onClick={() => {
              setGroupByPrice(!groupByPrice);
              setExpandedGroups(new Set());
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
              groupByPrice
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-secondary border-border text-muted-foreground hover:text-foreground"
            }`}
            title={t("stock_table.group_by_price_tooltip")}
          >
            {t("stock_table.group_by_price")}
          </button>
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
            {groupByPrice ? (
              priceGroups.map((group) => {
                const isExpanded = expandedGroups.has(group.band.id);
                return (
                  <GroupRows
                    key={group.band.id}
                    group={group}
                    label={groupLabel(group)}
                    isExpanded={isExpanded}
                    onToggle={() => toggleGroup(group.band.id)}
                    colCount={colCount}
                    showDetails={showDetails}
                    showCompany={activeView === "combined"}
                    unitPrice={unitPrice}
                    t={t}
                  />
                );
              })
            ) : (
              sorted.map((row, i) => (
                <ProductRow
                  key={`${row.companyId}-${row.produs}-${i}`}
                  row={row}
                  showDetails={showDetails}
                  showCompany={activeView === "combined"}
                  unitPrice={unitPrice}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────── */

function ProductRow({
  row,
  showDetails,
  showCompany,
  unitPrice,
}: {
  row: ExtendedRow;
  showDetails: boolean;
  showCompany: boolean;
  unitPrice: (r: StockRow) => number;
}) {
  return (
    <tr className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
      {showCompany && (
        <td className="px-4 py-2">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: COMPANY_VIEW_COLORS[row.companyId] }}
            title={row.companyId.toUpperCase()}
          />
        </td>
      )}
      <td className="px-4 py-2">{row.produs}</td>
      {showDetails && (
        <td className="px-4 py-2 text-right font-mono font-tabular text-muted-foreground">
          {row.cantStocInitial.toLocaleString("ro-RO", { maximumFractionDigits: 2 })}
        </td>
      )}
      {showDetails && (
        <td className="px-4 py-2 text-right font-mono font-tabular text-muted-foreground">
          {row.cantIntrari.toLocaleString("ro-RO", { maximumFractionDigits: 2 })}
        </td>
      )}
      <td className="px-4 py-2 text-right font-mono font-tabular">
        {row.cantStocFinal.toLocaleString("ro-RO", { maximumFractionDigits: 2 })}
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
  );
}

function GroupRows({
  group,
  label,
  isExpanded,
  onToggle,
  colCount,
  showDetails,
  showCompany,
  unitPrice,
  t,
}: {
  group: PriceGroup;
  label: string;
  isExpanded: boolean;
  onToggle: () => void;
  colCount: number;
  showDetails: boolean;
  showCompany: boolean;
  unitPrice: (r: StockRow) => number;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <>
      <tr
        className="border-b border-border/50 bg-secondary/40 cursor-pointer hover:bg-secondary/60 transition-colors"
        onClick={onToggle}
      >
        <td colSpan={colCount} className="px-4 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <motion.span
                className="text-[10px] text-muted-foreground inline-block"
                animate={{ rotate: isExpanded ? 90 : 0 }}
                transition={{ duration: 0.15 }}
              >
                ▶
              </motion.span>
              <span className="font-semibold text-xs">{label}</span>
              <span className="text-[11px] text-muted-foreground">
                {t("stock_table.group_products", { count: group.rows.length })}
              </span>
            </div>
            <div className="flex items-center gap-6 text-xs">
              {!group.isOther && group.totalKg > 0 && (
                <span className="font-mono font-tabular text-muted-foreground">
                  {group.totalKg.toLocaleString("ro-RO", { maximumFractionDigits: 0 })} kg
                </span>
              )}
              <span className="font-mono font-tabular font-medium">
                <Money amount={group.totalValue} className="text-xs" />
              </span>
            </div>
          </div>
        </td>
      </tr>
      {isExpanded &&
        group.rows.map((row, i) => (
          <ProductRow
            key={`${row.companyId}-${row.produs}-${i}`}
            row={row}
            showDetails={showDetails}
            showCompany={showCompany}
            unitPrice={unitPrice}
          />
        ))}
    </>
  );
}
