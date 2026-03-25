"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Money } from "@/components/atoms/money";
import { useCompanyStore } from "@/stores/company-store";
import { useDataStore } from "@/stores/data-store";
import { COMPANY_VIEW_COLORS } from "@/types/company";
import type { KPIKey, KPIValue, RAGStatus } from "@/types/kpi";

const POSITIVE_IS_GOOD: Record<KPIKey, boolean> = {
  revenue: true,
  profit: true,
  margin: true,
  cashPosition: true,
  stockValue: true,
  expenses: false,
};
import type { NormalizedBalantaRow } from "@/types/balanta";
import { useTranslation } from "react-i18next";
import { formatPercent, getLocaleCode } from "@/lib/utils/format";
import { getKPIExplanation } from "@/lib/accounting/kpi-explainer";

interface KPICardProps {
  kpiKey: KPIKey;
  value: KPIValue;
  isPercentage?: boolean;
}

const RAG_COLORS: Record<RAGStatus, string> = {
  green: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
};

function getRAG(key: KPIKey, value: KPIValue): RAGStatus {
  if (key === "profit" || key === "margin") {
    if (value.amount <= 0) return "red";
    if (key === "margin" && value.amount < 10) return "amber";
    return "green";
  }
  if (key === "cashPosition") {
    if (value.amount <= 0) return "red";
    if (value.amount < 50000) return "amber";
    return "green";
  }
  return "green";
}

export function KPICard({ kpiKey, value, isPercentage }: KPICardProps) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const { activeView } = useCompanyStore();
  const balanta = useDataStore((s) => s.balanta);
  const { t, i18n } = useTranslation("dashboard");
  const locale = getLocaleCode(i18n.language);
  const lang = i18n.language;
  const color = COMPANY_VIEW_COLORS[activeView];
  const rag = getRAG(kpiKey, value);

  const displayAmount =
    activeView === "combined"
      ? value.amount
      : value.perCompany[activeView === "ifp" ? "ifp" : "filato"];

  const ifpRows = (balanta.ifp?.rows ?? []) as NormalizedBalantaRow[];
  const filatoRows = (balanta.filato?.rows ?? []) as NormalizedBalantaRow[];
  const viewRows =
    activeView === "combined"
      ? [...ifpRows, ...filatoRows]
      : activeView === "ifp"
        ? ifpRows
        : filatoRows;

  const explanation = getKPIExplanation(kpiKey, viewRows, lang);
  const summary = lang === "en" ? explanation.summaryEn : explanation.summaryRo;
  const insight = lang === "en" ? explanation.insightEn : explanation.insightRo;
  const formula = lang === "en" ? explanation.formulaEn : explanation.formulaRo;

  return (
    <div>
      <motion.div
        layout
        className="rounded-xl bg-card border border-border relative overflow-hidden cursor-pointer group"
        style={{ borderTopColor: color, borderTopWidth: 3 }}
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.15 }}
      >
        <div className="p-5">
          {/* RAG indicator */}
          <div
            className="absolute top-4 right-4 w-2 h-2 rounded-full"
            style={{ backgroundColor: RAG_COLORS[rag] }}
          />

          {/* Expand hint */}
          <motion.span
            className="absolute top-4 right-8 text-[10px] text-muted-foreground"
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            {"\u25BC"}
          </motion.span>

          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
            {t(`kpi.${kpiKey}`)}
          </p>

          <div className="text-2xl font-bold font-mono font-tabular">
            {isPercentage ? (
              <span>{formatPercent(displayAmount, locale)}</span>
            ) : (
              <Money amount={displayAmount} />
            )}
          </div>

          {/* Year-over-year change badge */}
          {(() => {
            const change =
              activeView === "combined"
                ? value.changePercent
                : value.perCompanyChange[
                    activeView === "ifp" ? "ifp" : "filato"
                  ];
            return (
              change !== null && (
                <div
                  className="mt-1.5 text-[11px] font-medium"
                  style={{
                    color:
                      (change >= 0) === POSITIVE_IS_GOOD[kpiKey]
                        ? "#10b981"
                        : "#ef4444",
                  }}
                >
                  {change >= 0 ? "▲" : "▼"}{" "}
                  {Math.abs(change).toFixed(1)}%
                  <span className="text-muted-foreground font-normal ml-1">
                    vs 2024
                  </span>
                </div>
              )
            );
          })()}

          {/* Hover summary */}
          <AnimatePresence>
            {hovered && !expanded && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="text-[11px] text-muted-foreground mt-2 leading-relaxed"
              >
                {summary}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Per-company split for combined view */}
          {activeView === "combined" && (
            <div className="mt-3 flex gap-3 text-[11px] text-muted-foreground">
              <span>
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1"
                  style={{ backgroundColor: COMPANY_VIEW_COLORS.ifp }}
                />
                IFP:{" "}
                {isPercentage ? (
                  formatPercent(value.perCompany.ifp, locale)
                ) : (
                  <Money
                    amount={value.perCompany.ifp}
                    compact
                    className="text-[11px]"
                  />
                )}
              </span>
              <span>
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1"
                  style={{ backgroundColor: COMPANY_VIEW_COLORS.filato }}
                />
                FILATO:{" "}
                {isPercentage ? (
                  formatPercent(value.perCompany.filato, locale)
                ) : (
                  <Money
                    amount={value.perCompany.filato}
                    compact
                    className="text-[11px]"
                  />
                )}
              </span>
            </div>
          )}
        </div>

        {/* Expanded detail panel */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-4 border-t border-border/50 pt-3 space-y-3">
                {/* Human-friendly insight */}
                <p className="text-[11px] text-foreground/80 leading-relaxed">
                  {insight}
                </p>

                {/* Formula */}
                <p className="text-[10px] text-primary/70 italic">
                  {formula}
                </p>

                {/* Contributing accounts */}
                {explanation.accounts.length > 0 && (
                  <div className="space-y-1 max-h-44 overflow-y-auto">
                    {explanation.accounts.map((acc) => (
                      <div
                        key={acc.cont}
                        className="flex items-center justify-between text-[11px] py-0.5"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-primary font-mono shrink-0 text-[10px]">
                            {acc.cont}
                          </span>
                          <span className="text-muted-foreground truncate text-[10px]">
                            {acc.denumire}
                          </span>
                        </div>
                        <Money
                          amount={acc.value}
                          className="text-[11px] font-semibold shrink-0 ml-2"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Total line */}
                {explanation.accounts.length > 1 && (
                  <div className="flex items-center justify-between text-xs font-semibold pt-2 border-t border-border/30">
                    <span className="text-muted-foreground">Total</span>
                    {isPercentage ? (
                      <span className="font-mono font-tabular">
                        {formatPercent(displayAmount, locale)}
                      </span>
                    ) : (
                      <Money amount={displayAmount} className="text-xs" />
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
