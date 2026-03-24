"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Money } from "@/components/atoms/money";
import { useDataStore } from "@/stores/data-store";
import { useCompanyStore } from "@/stores/company-store";
import { COMPANY_VIEW_COLORS } from "@/types/company";
import type { NormalizedBalantaRow } from "@/types/balanta";
import type { ExpenseGroupValue } from "@/types/expense-group";
import { useTranslation } from "react-i18next";
import { formatPercent, getLocaleCode } from "@/lib/utils/format";

export function ExpenseBreakdown() {
  const expenseGroups = useDataStore((s) => s.expenseGroups);
  const balanta = useDataStore((s) => s.balanta);
  const { activeView } = useCompanyStore();
  const { t, i18n } = useTranslation("dashboard");
  const locale = getLocaleCode(i18n.language);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (expenseGroups.length === 0) return null;

  const sorted = [...expenseGroups].sort(
    (a, b) => b.totalAmount - a.totalAmount
  );

  const ifpRows = (balanta.ifp?.rows ?? []) as NormalizedBalantaRow[];
  const filatoRows = (balanta.filato?.rows ?? []) as NormalizedBalantaRow[];

  function getAccountsForGroup(group: ExpenseGroupValue): {
    cont: string;
    denumire: string;
    ifpVal: number;
    filatoVal: number;
    total: number;
  }[] {
    const prefixes = group.definition.accounts;

    const accountMap = new Map<
      string,
      { cont: string; denumire: string; ifpVal: number; filatoVal: number }
    >();

    for (const r of ifpRows) {
      if (
        !r.isClassTotal &&
        !r.isGrandTotal &&
        prefixes.some((p) => r.cont.startsWith(p))
      ) {
        const existing = accountMap.get(r.cont) || {
          cont: r.cont,
          denumire: r.denumire,
          ifpVal: 0,
          filatoVal: 0,
        };
        existing.ifpVal = r.sumeTotaleD;
        accountMap.set(r.cont, existing);
      }
    }

    for (const r of filatoRows) {
      if (
        !r.isClassTotal &&
        !r.isGrandTotal &&
        prefixes.some((p) => r.cont.startsWith(p))
      ) {
        const existing = accountMap.get(r.cont) || {
          cont: r.cont,
          denumire: r.denumire,
          ifpVal: 0,
          filatoVal: 0,
        };
        existing.filatoVal = r.sumeTotaleD;
        if (!existing.denumire) existing.denumire = r.denumire;
        accountMap.set(r.cont, existing);
      }
    }

    return Array.from(accountMap.values())
      .map((a) => ({ ...a, total: a.ifpVal + a.filatoVal }))
      .filter((a) => a.total > 0)
      .sort((a, b) => b.total - a.total);
  }

  return (
    <div className="rounded-xl bg-card border border-border p-5">
      <h3 className="text-sm font-semibold mb-4">{t("sections.expenses")}</h3>
      <div className="space-y-2">
        {sorted.map((group) => {
          const displayAmount =
            activeView === "combined"
              ? group.totalAmount
              : group.perCompany[activeView === "ifp" ? "ifp" : "filato"];

          if (displayAmount <= 0) return null;

          const isExpanded = expandedId === group.definition.id;
          const accounts = isExpanded ? getAccountsForGroup(group) : [];

          return (
            <div key={group.definition.id}>
              <motion.button
                className="w-full text-left group"
                onClick={() =>
                  setExpandedId(isExpanded ? null : group.definition.id)
                }
                whileHover={{ x: 2 }}
                transition={{ duration: 0.1 }}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base">{group.definition.icon}</span>
                    <span className="text-sm truncate">
                      {t(
                        `expense_groups.${group.definition.id}`,
                        group.definition.id
                      )}
                    </span>
                    <motion.span
                      className="text-[9px] text-muted-foreground"
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {"\u25BC"}
                    </motion.span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {formatPercent(group.percentOfExpenses, locale)}
                    </span>
                    <Money
                      amount={displayAmount}
                      className="text-sm font-semibold"
                    />
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  {activeView === "combined" ? (
                    <div className="h-full flex">
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${(group.perCompany.ifp / group.totalAmount) * group.percentOfExpenses}%`,
                          backgroundColor: COMPANY_VIEW_COLORS.ifp,
                        }}
                      />
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${(group.perCompany.filato / group.totalAmount) * group.percentOfExpenses}%`,
                          backgroundColor: COMPANY_VIEW_COLORS.filato,
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${group.percentOfExpenses}%`,
                        backgroundColor:
                          COMPANY_VIEW_COLORS[
                            activeView === "ifp" ? "ifp" : "filato"
                          ],
                      }}
                    />
                  )}
                </div>
              </motion.button>

              {/* Expanded accounts detail */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="ml-8 mt-2 mb-1 space-y-1 border-l-2 border-primary/20 pl-3">
                      {accounts.map((acc) => {
                        const accDisplay =
                          activeView === "combined"
                            ? acc.total
                            : activeView === "ifp"
                              ? acc.ifpVal
                              : acc.filatoVal;

                        if (accDisplay <= 0) return null;

                        return (
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
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              {activeView === "combined" && (
                                <div className="flex gap-1 text-[9px] text-muted-foreground">
                                  {acc.ifpVal > 0 && (
                                    <span>
                                      <span
                                        className="inline-block w-1.5 h-1.5 rounded-full mr-0.5"
                                        style={{
                                          backgroundColor:
                                            COMPANY_VIEW_COLORS.ifp,
                                        }}
                                      />
                                      <Money
                                        amount={acc.ifpVal}
                                        compact
                                        className="text-[9px]"
                                      />
                                    </span>
                                  )}
                                  {acc.filatoVal > 0 && (
                                    <span>
                                      <span
                                        className="inline-block w-1.5 h-1.5 rounded-full mr-0.5"
                                        style={{
                                          backgroundColor:
                                            COMPANY_VIEW_COLORS.filato,
                                        }}
                                      />
                                      <Money
                                        amount={acc.filatoVal}
                                        compact
                                        className="text-[9px]"
                                      />
                                    </span>
                                  )}
                                </div>
                              )}
                              <Money
                                amount={accDisplay}
                                className="text-[11px] font-semibold"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
