"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Money } from "@/components/atoms/money";
import { useDataStore } from "@/stores/data-store";
import { useCompanyStore } from "@/stores/company-store";
import { useCurrencyStore } from "@/stores/currency-store";
import { COMPANY_VIEW_COLORS } from "@/types/company";
import type { StockRow } from "@/types/stock";
import type { NormalizedBalantaRow } from "@/types/balanta";
import { useTranslation } from "react-i18next";
import { getLocaleCode } from "@/lib/utils/format";

interface StockTotals {
  cantStocFinal: number;
  cantIntrari: number;
  cantIesiri: number;
  valSoldFinal: number;
  valIntrari: number;
  valIesiri: number;
}

function calcTotals(rows: StockRow[]): StockTotals {
  const kgRows = rows.filter((r) => r.um.toUpperCase() === "KG");
  return {
    cantStocFinal: kgRows.reduce((s, r) => s + r.cantStocFinal, 0),
    cantIntrari: kgRows.reduce((s, r) => s + r.cantIntrari, 0),
    cantIesiri: kgRows.reduce((s, r) => s + r.cantIesiri, 0),
    valSoldFinal: rows.reduce((s, r) => s + r.valSoldFinal, 0),
    valIntrari: rows.reduce((s, r) => s + r.valIntrari, 0),
    valIesiri: rows.reduce((s, r) => s + r.valIesiri, 0),
  };
}

function getAccountTotal(
  rows: NormalizedBalantaRow[],
  cont: string,
  field: "sumeTotaleC" | "sumeTotaleD"
): number {
  const row = rows.find((r) => r.cont === cont);
  return row ? row[field] : 0;
}

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

function formatKg(value: number, locale: string): string {
  return (
    new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
    }).format(value) + " kg"
  );
}

function formatKgCompact(value: number, locale: string): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000) {
    return (
      sign +
      new Intl.NumberFormat(locale, {
        maximumFractionDigits: 1,
      }).format(abs / 1_000) +
      "t"
    );
  }
  return formatKg(value, locale);
}

interface CompanySplitProps {
  ifpValue: number;
  filatoValue: number;
  isMoney: boolean;
  locale: string;
}

function CompanySplit({ ifpValue, filatoValue, isMoney, locale }: CompanySplitProps) {
  return (
    <div className="flex gap-3 text-[11px] text-muted-foreground">
      <span>
        <span
          className="inline-block w-2 h-2 rounded-full mr-1"
          style={{ backgroundColor: COMPANY_VIEW_COLORS.ifp }}
        />
        IFP:{" "}
        {isMoney ? (
          <Money amount={ifpValue} compact className="text-[11px]" />
        ) : (
          formatKgCompact(ifpValue, locale)
        )}
      </span>
      <span>
        <span
          className="inline-block w-2 h-2 rounded-full mr-1"
          style={{ backgroundColor: COMPANY_VIEW_COLORS.filato }}
        />
        FILATO:{" "}
        {isMoney ? (
          <Money amount={filatoValue} compact className="text-[11px]" />
        ) : (
          formatKgCompact(filatoValue, locale)
        )}
      </span>
    </div>
  );
}

function eurPerKg(ronValue: number, kg: number, eurRate: number): number | null {
  if (kg <= 0) return null;
  return ronValue / eurRate / kg;
}

function formatEurPerKg(value: number | null, locale: string): string {
  if (value === null) return "—";
  return (
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value) + " EUR/kg"
  );
}

interface StockComboCardProps {
  label: string;
  kg: number;
  ifpKg: number;
  filatoKg: number;
  valueAmount: number;
  valueLabel: string;
  ifpValue: number;
  filatoValue: number;
  showSplit: boolean;
  locale: string;
  subValueAmount?: number;
  subValueLabel?: string;
  ifpSubValue?: number;
  filatoSubValue?: number;
}

function StockComboCard({
  label,
  kg,
  ifpKg,
  filatoKg,
  valueAmount,
  valueLabel,
  ifpValue,
  filatoValue,
  showSplit,
  locale,
  subValueAmount,
  subValueLabel,
  ifpSubValue,
  filatoSubValue,
}: StockComboCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { activeView } = useCompanyStore();
  const { eurRate, customRate } = useCurrencyStore();
  const { t } = useTranslation("dashboard");
  const color = COMPANY_VIEW_COLORS[activeView];
  const rate = customRate || eurRate;

  const combinedRatio = eurPerKg(valueAmount, kg, rate);
  const ifpRatio = eurPerKg(ifpValue, ifpKg, rate);
  const filatoRatio = eurPerKg(filatoValue, filatoKg, rate);

  return (
    <motion.div
      layout
      className="rounded-xl bg-card border border-border relative overflow-hidden cursor-pointer group"
      style={{ borderTopColor: color, borderTopWidth: 3 }}
      onClick={() => setExpanded(!expanded)}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.15 }}
    >
      <div className="p-5">
        {/* Expand hint */}
        <motion.span
          className="absolute top-4 right-4 text-[10px] text-muted-foreground"
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          {"\u25BC"}
        </motion.span>

        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
          {label}
        </p>

        {/* KG row */}
        <div className="text-2xl font-bold font-mono font-tabular">
          {formatKg(kg, locale)}
        </div>
        {showSplit && (
          <div className="mt-1.5">
            <CompanySplit ifpValue={ifpKg} filatoValue={filatoKg} isMoney={false} locale={locale} />
          </div>
        )}

        {/* Value row */}
        <div className="mt-4 pt-3 border-t border-border/30">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
            {valueLabel}
          </p>
          <div className="text-lg font-semibold font-mono font-tabular">
            <Money amount={valueAmount} />
          </div>
          {showSplit && (
            <div className="mt-1.5">
              <CompanySplit ifpValue={ifpValue} filatoValue={filatoValue} isMoney locale={locale} />
            </div>
          )}
        </div>

        {/* Sub-value row (e.g. COGS under sales revenue) */}
        {subValueAmount !== undefined && subValueLabel && (
          <div className="mt-2.5 pt-2 border-t border-border/20">
            <div className="flex items-baseline justify-between">
              <p className="text-[10px] text-muted-foreground">
                {subValueLabel}
              </p>
              <span className="text-xs font-mono font-tabular text-muted-foreground">
                <Money amount={subValueAmount} className="text-xs text-muted-foreground" />
              </span>
            </div>
            {showSplit && ifpSubValue !== undefined && filatoSubValue !== undefined && (
              <div className="mt-1">
                <CompanySplit ifpValue={ifpSubValue} filatoValue={filatoSubValue} isMoney locale={locale} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expanded: EUR/kg ratio */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 border-t border-border/50 pt-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                {t("stock_kpi.eurPerKg")}
              </p>
              <div className="text-base font-semibold font-mono font-tabular text-primary">
                {formatEurPerKg(combinedRatio, locale)}
              </div>
              {showSplit && (
                <div className="mt-2 flex gap-4 text-[11px] text-muted-foreground">
                  <span>
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1"
                      style={{ backgroundColor: COMPANY_VIEW_COLORS.ifp }}
                    />
                    IFP: {formatEurPerKg(ifpRatio, locale)}
                  </span>
                  <span>
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1"
                      style={{ backgroundColor: COMPANY_VIEW_COLORS.filato }}
                    />
                    FILATO: {formatEurPerKg(filatoRatio, locale)}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function StockKPIGrid() {
  const stock = useDataStore((s) => s.stock);
  const balanta = useDataStore((s) => s.balanta);
  const { activeView } = useCompanyStore();
  const { t, i18n } = useTranslation("dashboard");
  const locale = getLocaleCode(i18n.language);

  const ifpTotals = calcTotals(stock.ifp?.rows ?? []);
  const filatoTotals = calcTotals(stock.filato?.rows ?? []);

  // Account 707 — revenue from goods sold
  const ifpRows = (balanta.ifp?.rows ?? []) as NormalizedBalantaRow[];
  const filatoRows = (balanta.filato?.rows ?? []) as NormalizedBalantaRow[];
  const ifpSalesRevenue = getAccountTotal(ifpRows, "707", "sumeTotaleC");
  const filatoSalesRevenue = getAccountTotal(filatoRows, "707", "sumeTotaleC");

  function getVal(getValue: (t: StockTotals) => number): number {
    if (activeView === "combined")
      return getValue(ifpTotals) + getValue(filatoTotals);
    if (activeView === "ifp") return getValue(ifpTotals);
    return getValue(filatoTotals);
  }

  function getRevenue(): number {
    if (activeView === "combined") return ifpSalesRevenue + filatoSalesRevenue;
    if (activeView === "ifp") return ifpSalesRevenue;
    return filatoSalesRevenue;
  }

  const showSplit = activeView === "combined";

  if (!stock.ifp && !stock.filato) return null;

  return (
    <div>
      <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-semibold">
        {t("sections.stock_overview")}
      </h3>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {/* Card 1: Stoc actual */}
        <motion.div variants={item}>
          <StockComboCard
            label={t("stock_kpi.stockKg")}
            kg={getVal((t) => t.cantStocFinal)}
            ifpKg={ifpTotals.cantStocFinal}
            filatoKg={filatoTotals.cantStocFinal}
            valueAmount={getVal((t) => t.valSoldFinal)}
            valueLabel={t("stock_kpi.stockValue")}
            ifpValue={ifpTotals.valSoldFinal}
            filatoValue={filatoTotals.valSoldFinal}
            showSplit={showSplit}
            locale={locale}
          />
        </motion.div>

        {/* Card 2: Cumpărat */}
        <motion.div variants={item}>
          <StockComboCard
            label={t("stock_kpi.purchasedKg")}
            kg={getVal((t) => t.cantIntrari)}
            ifpKg={ifpTotals.cantIntrari}
            filatoKg={filatoTotals.cantIntrari}
            valueAmount={getVal((t) => t.valIntrari)}
            valueLabel={t("stock_kpi.purchasedValue")}
            ifpValue={ifpTotals.valIntrari}
            filatoValue={filatoTotals.valIntrari}
            showSplit={showSplit}
            locale={locale}
          />
        </motion.div>

        {/* Card 3: Vândut */}
        <motion.div variants={item}>
          <StockComboCard
            label={t("stock_kpi.soldKg")}
            kg={getVal((t) => t.cantIesiri)}
            ifpKg={ifpTotals.cantIesiri}
            filatoKg={filatoTotals.cantIesiri}
            valueAmount={getRevenue()}
            valueLabel={t("stock_kpi.salesRevenue")}
            ifpValue={ifpSalesRevenue}
            filatoValue={filatoSalesRevenue}
            showSplit={showSplit}
            locale={locale}
            subValueAmount={getVal((t) => t.valIesiri)}
            subValueLabel={t("stock_kpi.soldValue")}
            ifpSubValue={ifpTotals.valIesiri}
            filatoSubValue={filatoTotals.valIesiri}
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
