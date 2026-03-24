"use client";

import { Money } from "@/components/atoms/money";
import { useDataStore } from "@/stores/data-store";
import { useCompanyStore } from "@/stores/company-store";
import { COMPANY_VIEW_COLORS } from "@/types/company";
import type { NormalizedBalantaRow } from "@/types/balanta";
import { useTranslation } from "react-i18next";
import { InfoIcon } from "@/components/atoms/info-tooltip";

const TVA_ACCOUNTS = [
  { cont: "4427", labelRo: "TVA colectat\u0103", labelEn: "Output VAT (collected)", field: "sumeTotaleC" as const, tipRo: "TVA pe care firma a \u00EEncasat-o de la clien\u021Bi la v\u00E2nzare. Se datoreaz\u0103 statului.", tipEn: "VAT collected from clients on sales. Owed to the state." },
  { cont: "4426", labelRo: "TVA deductibil\u0103", labelEn: "Input VAT (deductible)", field: "sumeTotaleD" as const, tipRo: "TVA pl\u0103tit\u0103 la achizi\u021Bii. Se deduce din TVA colectat\u0103.", tipEn: "VAT paid on purchases. Deducted from output VAT." },
  { cont: "4423", labelRo: "TVA de plat\u0103", labelEn: "VAT payable", field: "soldFinalC" as const, tipRo: "Suma TVA r\u0103mas\u0103 de plat\u0103 c\u0103tre stat (colectat\u0103 > deductibil\u0103). Termen: 25 a lunii urm\u0103toare.", tipEn: "Net VAT owed to the state (collected > deductible). Due: 25th of following month." },
  { cont: "4424", labelRo: "TVA de recuperat", labelEn: "VAT receivable", field: "soldFinalD" as const, tipRo: "Suma TVA de recuperat de la stat (deductibil\u0103 > colectat\u0103). Se poate cere rambursare.", tipEn: "Net VAT to recover from the state (deductible > collected). Can request refund." },
];

export function TVASummary() {
  const balanta = useDataStore((s) => s.balanta);
  const { activeView } = useCompanyStore();
  const { i18n } = useTranslation();
  const lang = i18n.language;

  const ifpRows = (balanta.ifp?.rows ?? []) as NormalizedBalantaRow[];
  const filatoRows = (balanta.filato?.rows ?? []) as NormalizedBalantaRow[];

  function getValue(rows: NormalizedBalantaRow[], cont: string, field: string): number {
    const row = rows.find(
      (r) => r.cont === cont && !r.isClassTotal && !r.isGrandTotal
    );
    return row ? (row as unknown as Record<string, number>)[field] ?? 0 : 0;
  }

  return (
    <div className="rounded-xl bg-card border border-border p-5">
      <h3 className="text-sm font-semibold mb-4">
        {lang === "en" ? "VAT Summary" : "Situa\u021Bia TVA"}
      </h3>
      <div className="space-y-3">
        {TVA_ACCOUNTS.map(({ cont, labelRo, labelEn, field, tipRo, tipEn }) => {
          const ifpVal = getValue(ifpRows, cont, field);
          const filatoVal = getValue(filatoRows, cont, field);
          const combined = ifpVal + filatoVal;

          const displayVal =
            activeView === "combined"
              ? combined
              : activeView === "ifp"
                ? ifpVal
                : filatoVal;

          if (displayVal === 0) return null;

          const isPayable = cont === "4423";
          const isReceivable = cont === "4424";

          return (
            <div
              key={cont}
              className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
            >
              <div>
                <p className="text-sm">
                  {lang === "en" ? labelEn : labelRo}
                  <InfoIcon text={lang === "en" ? tipEn : tipRo} position="bottom" />
                </p>
                <p className="text-[10px] text-muted-foreground">{cont}</p>
              </div>
              <div className="text-right">
                <Money
                  amount={displayVal}
                  className={`text-sm font-semibold ${
                    isPayable
                      ? "text-red-400"
                      : isReceivable
                        ? "text-emerald-400"
                        : ""
                  }`}
                />
                {activeView === "combined" && (ifpVal > 0 || filatoVal > 0) && (
                  <div className="flex gap-2 mt-0.5 text-[10px] text-muted-foreground justify-end">
                    {ifpVal > 0 && (
                      <span>
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full mr-0.5"
                          style={{ backgroundColor: COMPANY_VIEW_COLORS.ifp }}
                        />
                        <Money amount={ifpVal} compact className="text-[10px]" />
                      </span>
                    )}
                    {filatoVal > 0 && (
                      <span>
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full mr-0.5"
                          style={{ backgroundColor: COMPANY_VIEW_COLORS.filato }}
                        />
                        <Money amount={filatoVal} compact className="text-[10px]" />
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
