"use client";

import { Money } from "@/components/atoms/money";
import { useDataStore } from "@/stores/data-store";
import { useCompanyStore } from "@/stores/company-store";
import { COMPANY_VIEW_COLORS } from "@/types/company";
import type { NormalizedBalantaRow } from "@/types/balanta";
import { useTranslation } from "react-i18next";
import { InfoIcon } from "@/components/atoms/info-tooltip";

const ITEMS = [
  {
    labelRo: "Clien\u021Bi (de \u00EEncasat)",
    labelEn: "Clients (receivable)",
    cont: "4111",
    side: "D" as const,
    color: "#10b981",
    tipRo: "Bani pe care clien\u021Bii \u00EE\u021Bi datoreaz\u0103 firmei pentru marf\u0103 livrat\u0103 dar nepl\u0103tit\u0103 \u00EEnc\u0103.",
    tipEn: "Money clients owe the company for delivered but unpaid goods.",
  },
  {
    labelRo: "Furnizori (de pl\u0103tit)",
    labelEn: "Suppliers (payable)",
    cont: "401",
    side: "C" as const,
    color: "#ef4444",
    tipRo: "Bani pe care firma \u00EEi datoreaz\u0103 furnizorilor pentru marf\u0103 primit\u0103 dar nepl\u0103tit\u0103.",
    tipEn: "Money the company owes to suppliers for received but unpaid goods.",
  },
  {
    labelRo: "Debitori diver\u0219i",
    labelEn: "Other debtors",
    cont: "461",
    side: "D" as const,
    color: "#3b82f6",
    tipRo: "Alte sume de \u00EEncasat care nu sunt din activitatea principal\u0103 (garan\u021Bii, avansuri etc.).",
    tipEn: "Other receivables not from main activity (deposits, advances, etc.).",
  },
  {
    labelRo: "Creditori diver\u0219i",
    labelEn: "Other creditors",
    cont: "462",
    side: "C" as const,
    color: "#f59e0b",
    tipRo: "Alte sume de pl\u0103tit care nu sunt c\u0103tre furnizori (depozite primite, diverse obliga\u021Bii).",
    tipEn: "Other payables not to suppliers (deposits received, various obligations).",
  },
  {
    labelRo: "Dividende de pl\u0103tit",
    labelEn: "Dividends payable",
    cont: "457",
    side: "C" as const,
    color: "#8b5cf6",
    tipRo: "Profit distribuit ac\u021Bionarilor dar nepl\u0103tit \u00EEnc\u0103. Necesit\u0103 plata impozitului pe dividende (8%).",
    tipEn: "Profit distributed to shareholders but not yet paid. Requires dividend tax payment (8%).",
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
        {lang === "en" ? "Receivables & Payables" : "De \u00EEncasat & De pl\u0103tit"}
      </h3>
      <div className="flex gap-4 mb-4 text-xs text-muted-foreground">
        <span>
          {lang === "en" ? "Net position" : "Pozi\u021Bie net\u0103"}:{" "}
          <Money
            amount={totalReceivable - totalPayable}
            className={`text-xs font-semibold ${totalReceivable >= totalPayable ? "text-emerald-400" : "text-red-400"}`}
          />
        </span>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.cont}
            className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0"
          >
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
        ))}
      </div>
    </div>
  );
}
