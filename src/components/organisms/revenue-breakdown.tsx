"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Money } from "@/components/atoms/money";
import { useDataStore } from "@/stores/data-store";
import { useCompanyStore } from "@/stores/company-store";
import { COMPANY_VIEW_COLORS } from "@/types/company";
import type { NormalizedBalantaRow } from "@/types/balanta";
import type { RevenueGroupValue } from "@/types/expense-group";
import { useTranslation } from "react-i18next";
import { formatPercent, getLocaleCode } from "@/lib/utils/format";
import { useCustomCardStore } from "@/stores/custom-card-store";

export function RevenueBreakdown() {
  const revenueGroups = useDataStore((s) => s.revenueGroups);
  const balanta = useDataStore((s) => s.balanta);
  const getSubAccounts = useDataStore((s) => s.getSubAccounts);
  const { activeView } = useCompanyStore();
  const { t, i18n } = useTranslation("dashboard");
  const locale = getLocaleCode(i18n.language);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedAccountCont, setExpandedAccountCont] = useState<string | null>(null);
  const setPendingField = useCustomCardStore((s) => s.setPendingField);

  if (revenueGroups.length === 0) return null;

  const sorted = [...revenueGroups].sort(
    (a, b) => b.totalAmount - a.totalAmount
  );

  const ifpRows = (balanta.ifp?.rows ?? []) as NormalizedBalantaRow[];
  const filatoRows = (balanta.filato?.rows ?? []) as NormalizedBalantaRow[];

  function getAccountsForGroup(group: RevenueGroupValue): {
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
        existing.ifpVal = r.sumeTotaleC;
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
        existing.filatoVal = r.sumeTotaleC;
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
      <h3 className="text-sm font-semibold mb-4">{t("sections.revenue")}</h3>
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
              <div className="flex items-center gap-1">
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
                          `revenue_groups.${group.definition.id}`,
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
                        {formatPercent(group.percentOfRevenue, locale)}
                      </span>
                      <Money
                        amount={displayAmount}
                        className="text-sm font-semibold text-emerald-400"
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
                            width: `${(group.perCompany.ifp / group.totalAmount) * group.percentOfRevenue}%`,
                            backgroundColor: COMPANY_VIEW_COLORS.ifp,
                          }}
                        />
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${(group.perCompany.filato / group.totalAmount) * group.percentOfRevenue}%`,
                            backgroundColor: COMPANY_VIEW_COLORS.filato,
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${group.percentOfRevenue}%`,
                          backgroundColor:
                            COMPANY_VIEW_COLORS[
                              activeView === "ifp" ? "ifp" : "filato"
                            ],
                        }}
                      />
                    )}
                  </div>
                </motion.button>

                {/* Add to card button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingField({
                      id: crypto.randomUUID(),
                      label: t(`revenue_groups.${group.definition.id}`, group.definition.id),
                      type: "account",
                      accountCodes: group.definition.accounts.join(","),
                      valueField: "sumeTotaleC",
                    });
                  }}
                  className="w-5 h-5 rounded bg-primary/10 text-primary text-[10px] hover:bg-primary/20 opacity-0 hover:opacity-100 transition-opacity shrink-0"
                  title={locale === "ro" ? "Adauga la card personalizat" : "Add to custom card"}
                >
                  +
                </button>
              </div>

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
                    <div className="ml-8 mt-2 mb-1 space-y-1 border-l-2 border-emerald-500/20 pl-3">
                      {accounts.map((acc) => {
                        const accDisplay =
                          activeView === "combined"
                            ? acc.total
                            : activeView === "ifp"
                              ? acc.ifpVal
                              : acc.filatoVal;

                        if (accDisplay <= 0) return null;

                        const isAccountExpanded = expandedAccountCont === acc.cont;
                        const subAccounts = isAccountExpanded
                          ? getSubAccounts(acc.cont, activeView === "combined" ? "combined" : activeView)
                          : [];
                        const hasSubAccounts = getSubAccounts(acc.cont, activeView === "combined" ? "combined" : activeView).length > 0;

                        return (
                          <div key={`rev-${group.definition.id}-${acc.cont}`}>
                            <div className="flex items-center gap-1">
                              <button
                                className="flex-1 flex items-center justify-between text-[11px] py-0.5 min-w-0 text-left hover:bg-secondary/30 rounded px-1 -mx-1 transition-colors"
                                onClick={() =>
                                  hasSubAccounts && setExpandedAccountCont(isAccountExpanded ? null : acc.cont)
                                }
                                disabled={!hasSubAccounts}
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-emerald-400/70 font-mono shrink-0 text-[10px]">
                                    {acc.cont}
                                  </span>
                                  <span className="text-muted-foreground truncate text-[10px]">
                                    {acc.denumire}
                                  </span>
                                  {hasSubAccounts && (
                                    <motion.span
                                      className="text-[8px] text-muted-foreground/60"
                                      animate={{ rotate: isAccountExpanded ? 180 : 0 }}
                                      transition={{ duration: 0.15 }}
                                    >
                                      {"\u25BC"}
                                    </motion.span>
                                  )}
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
                              </button>

                              {/* Add individual account to card */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPendingField({
                                    id: crypto.randomUUID(),
                                    label: `${acc.denumire} (${acc.cont})`,
                                    type: "account",
                                    accountCodes: acc.cont,
                                    valueField: "sumeTotaleC",
                                  });
                                }}
                                className="w-4 h-4 rounded bg-primary/10 text-primary text-[9px] hover:bg-primary/20 opacity-0 hover:opacity-100 transition-opacity shrink-0"
                                title={locale === "ro" ? "Adauga la card personalizat" : "Add to custom card"}
                              >
                                +
                              </button>
                            </div>

                            {/* Inline sub-account drill-down */}
                            <AnimatePresence>
                              {isAccountExpanded && subAccounts.length > 0 && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.15, ease: "easeInOut" }}
                                  className="overflow-hidden"
                                >
                                  <div className="ml-6 mt-1 mb-1 space-y-0.5 border-l border-emerald-500/10 pl-2">
                                    {subAccounts
                                      .filter((s) => s.sumeTotaleC > 0)
                                      .sort((a, b) => b.sumeTotaleC - a.sumeTotaleC)
                                      .map((sub, idx) => (
                                        <div
                                          key={`${sub.cont}-${idx}`}
                                          className="flex items-center justify-between text-[10px] py-0.5"
                                        >
                                          <div className="flex items-center gap-1 min-w-0">
                                            <span className="text-emerald-400/40 font-mono shrink-0 text-[9px]">
                                              {sub.cont}
                                            </span>
                                            <span className="text-muted-foreground/70 truncate text-[9px]">
                                              {sub.denumire}
                                            </span>
                                          </div>
                                          <Money
                                            amount={sub.sumeTotaleC}
                                            className="text-[10px] font-medium text-muted-foreground shrink-0 ml-2"
                                          />
                                        </div>
                                      ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
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
