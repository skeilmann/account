"use client";

import { Money } from "@/components/atoms/money";
import { useDataStore } from "@/stores/data-store";
import { useCompanyStore } from "@/stores/company-store";
import { COMPANY_VIEW_COLORS } from "@/types/company";
import type { NormalizedBalantaRow } from "@/types/balanta";
import { useTranslation } from "react-i18next";
import { InfoIcon } from "@/components/atoms/info-tooltip";
import { SubAccountDialog } from "@/components/molecules/sub-account-dialog";

const ITEMS = [
  {
    labelRo: "Clienți (de încasat)",
    labelEn: "Clients (receivable)",
    cont: "4111",
    side: "D" as const,
    color: "#10b981",
    tipRo: "Bani pe care clienții îți datorează firmei pentru marfă livrată dar neplătită încă.",
    tipEn: "Money clients owe the company for delivered but unpaid goods.",
  },
  {
    labelRo: "Furnizori (de plătit)",
    labelEn: "Suppliers (payable)",
    cont: "401",
    side: "C" as const,
    color: "#ef4444",
    tipRo: "Bani pe care firma îi datorează furnizorilor pentru marfă primită dar neplătită.",
    tipEn: "Money the company owes to suppliers for received but unpaid goods.",
  },
  {
    labelRo: "Debitori diverși",
    labelEn: "Other debtors",
    cont: "461",
    side: "D" as const,
    color: "#3b82f6",
    tipRo: "Alte sume de încasat care nu sunt din activitatea principală (garanții, avansuri etc.).",
    tipEn: "Other receivables not from main activity (deposits, advances, etc.).",
  },
  {
    labelRo: "Creditori diverși",
    labelEn: "Other creditors",
    cont: "462",
    side: "C" as const,
    color: "#f59e0b",
    tipRo: "Alte sume de plătit care nu sunt către furnizori (depozite primite, diverse obligații).",
    tipEn: "Other payables not to suppliers (deposits received, various obligations).",
  },
  {
    labelRo: "Dividende de plătit",
    labelEn: "Dividends payable",
    cont: "457",
    side: "C" as const,
    color: "#8b5cf6",
    tipRo: "Profit distribuit acționarilor dar neplătit încă. Impozit 16% reținut la sursă (Legea 141/2025). CASS 10% peste 24.300 RON. La plată se depune D100.",
    tipEn: "Profit distributed to shareholders but not yet paid. 16% tax withheld at source (Law 141/2025). 10% CASS above 24,300 RON. D100 filed upon payment.",
  },
];

export function ReceivablesPayables() {
  const balanta = useDataStore((s) => s.balanta);
  const { activeView } = useCompanyStore();
  const { i18n } = useTranslation();
  const lang = i18n.language;

  const ifpRows = (balanta.ifp?.rows ?? []) as NormalizedBalantaRow[];
  const filatoRows = (balanta.filato?.rows ?? []) as NormalizedBalantaRow[];

  function getVal(rows: NormalizedBalantaRow[], cont: string, side: "D" | "C"): number {
    const row = rows.find(
      (r) => r.cont === cont && !r.isClassTotal && !r.isGrandTotal
    );
    if (!row) return 0;
    return side === "D" ? row.soldFinalD : row.soldFinalC;
  }

  const items = ITEMS.map((item) => {
    const ifpVal = getVal(ifpRows, item.cont, item.side);
    const filatoVal = getVal(filatoRows, item.cont, item.side);
    const combined = ifpVal + filatoVal;
    const displayVal =
      activeView === "combined"
        ? combined
        : activeView === "ifp"
          ? ifpVal
          : filatoVal;
    return { ...item, ifpVal, filatoVal, displayVal };
  }).filter((i) => i.displayVal > 0);

  const totalReceivable = items
    .filter((i) => i.side === "D")
    .reduce((s, i) => s + i.displayVal, 0);
  const totalPayable = items
    .filter((i) => i.side === "C")
    .reduce((s, i) => s + i.displayVal, 0);

  return (
    <div className="rounded-xl bg-card border border-border p-5">
      <h3 className="text-sm font-semibold mb-1">
        {lang === "en" ? "Receivables & Payables" : "De încasat & De plătit"}
      </h3>
      <div className="flex gap-4 mb-4 text-xs text-muted-foreground">
        <span>
          {lang === "en" ? "Net position" : "Poziție netă"}:{" "}
          <Money
            amount={totalReceivable - totalPayable}
            className={`text-xs font-semibold ${totalReceivable >= totalPayable ? "text-emerald-400" : "text-red-400"}`}
          />
        </span>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <SubAccountDialog
            key={item.cont}
            parentCont={item.cont}
            parentName={lang === "en" ? item.labelEn : item.labelRo}
            side={item.side}
          >
            <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-1 h-6 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <div className="min-w-0">
                  <p className="text-sm truncate">
                    {lang === "en" ? item.labelEn : item.labelRo}
                    <InfoIcon text={lang === "en" ? item.tipEn : item.tipRo} position="bottom" />
                  </p>
                  <p className="text-[10px] text-muted-foreground">{item.cont}</p>
                </div>
              </div>
              <div className="text-right shrink-0 ml-2">
                <Money
                  amount={item.displayVal}
                  className={`text-sm font-semibold ${item.side === "D" ? "text-emerald-400" : "text-red-400"}`}
                />
                {activeView === "combined" && (
                  <div className="flex gap-2 mt-0.5 text-[10px] text-muted-foreground justify-end">
                    {item.ifpVal > 0 && (
                      <span>
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full mr-0.5"
                          style={{ backgroundColor: COMPANY_VIEW_COLORS.ifp }}
                        />
                        <Money amount={item.ifpVal} compact className="text-[10px]" />
                      </span>
                    )}
                    {item.filatoVal > 0 && (
                      <span>
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full mr-0.5"
                          style={{ backgroundColor: COMPANY_VIEW_COLORS.filato }}
                        />
                        <Money amount={item.filatoVal} compact className="text-[10px]" />
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </SubAccountDialog>
        ))}
      </div>
    </div>
  );
}
