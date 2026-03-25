"use client";

import { Money } from "@/components/atoms/money";
import { useDataStore } from "@/stores/data-store";
import { COMPANY_VIEW_COLORS } from "@/types/company";
import type { NormalizedBalantaRow } from "@/types/balanta";
import { calcCompanyKPIs } from "@/lib/accounting/kpi-calculator";
import { useTranslation } from "react-i18next";
import { formatPercent, getLocaleCode } from "@/lib/utils/format";

interface ComparisonRow {
  labelRo: string;
  labelEn: string;
  ifpValue: number;
  filatoValue: number;
  isPercentage?: boolean;
  highlight?: boolean;
}

export function CompanyComparison() {
  const balanta = useDataStore((s) => s.balanta);
  const stock = useDataStore((s) => s.stock);
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const locale = getLocaleCode(lang);

  const ifpRows = (balanta.ifp?.rows ?? []) as NormalizedBalantaRow[];
  const filatoRows = (balanta.filato?.rows ?? []) as NormalizedBalantaRow[];
  const ifp = calcCompanyKPIs(ifpRows);
  const filato = calcCompanyKPIs(filatoRows);

  function getAcc(rows: NormalizedBalantaRow[], cont: string, field: keyof NormalizedBalantaRow): number {
    const r = rows.find((x) => x.cont === cont && !x.isClassTotal && !x.isGrandTotal);
    return r ? (r[field] as number) ?? 0 : 0;
  }

  const rows: ComparisonRow[] = [
    { labelRo: "Venituri din vânzări", labelEn: "Sales revenue", ifpValue: ifp.revenue, filatoValue: filato.revenue, highlight: true },
    { labelRo: "Cheltuieli cu marfa", labelEn: "Cost of goods", ifpValue: getAcc(ifpRows, "607", "sumeTotaleD"), filatoValue: getAcc(filatoRows, "607", "sumeTotaleD") },
    { labelRo: "Marjă brută", labelEn: "Gross margin", ifpValue: ifp.revenue > 0 ? ((ifp.revenue - getAcc(ifpRows, "607", "sumeTotaleD")) / ifp.revenue) * 100 : 0, filatoValue: filato.revenue > 0 ? ((filato.revenue - getAcc(filatoRows, "607", "sumeTotaleD")) / filato.revenue) * 100 : 0, isPercentage: true },
    { labelRo: "Transport", labelEn: "Transport", ifpValue: getAcc(ifpRows, "624", "sumeTotaleD"), filatoValue: getAcc(filatoRows, "624", "sumeTotaleD") },
    { labelRo: "Salarii + contribuții", labelEn: "Salaries + contributions", ifpValue: getAcc(ifpRows, "641", "sumeTotaleD") + getAcc(ifpRows, "6461", "sumeTotaleD") + getAcc(ifpRows, "6422", "sumeTotaleD"), filatoValue: getAcc(filatoRows, "641", "sumeTotaleD") + getAcc(filatoRows, "6461", "sumeTotaleD") + getAcc(filatoRows, "6422", "sumeTotaleD") },
    { labelRo: "Servicii externe", labelEn: "External services", ifpValue: getAcc(ifpRows, "628", "sumeTotaleD"), filatoValue: getAcc(filatoRows, "628", "sumeTotaleD") },
    { labelRo: "Chirii", labelEn: "Rent", ifpValue: getAcc(ifpRows, "6123", "sumeTotaleD"), filatoValue: getAcc(filatoRows, "6123", "sumeTotaleD") },
    { labelRo: "Total cheltuieli", labelEn: "Total expenses", ifpValue: ifp.expenses, filatoValue: filato.expenses, highlight: true },
    { labelRo: "Profit net", labelEn: "Net profit", ifpValue: ifp.profit, filatoValue: filato.profit, highlight: true },
    { labelRo: "Marjă de profit", labelEn: "Profit margin", ifpValue: ifp.margin, filatoValue: filato.margin, isPercentage: true },
    { labelRo: "Valoare stocuri", labelEn: "Stock value", ifpValue: ifp.stockValue, filatoValue: filato.stockValue },
    { labelRo: "Nr. produse în stoc", labelEn: "Products in stock", ifpValue: stock.ifp?.rows.length ?? 0, filatoValue: stock.filato?.rows.length ?? 0 },
    { labelRo: "Numerar", labelEn: "Cash", ifpValue: ifp.cashPosition, filatoValue: filato.cashPosition },
    { labelRo: "Clienți (de încasat)", labelEn: "Receivables", ifpValue: getAcc(ifpRows, "4111", "soldFinalD"), filatoValue: getAcc(filatoRows, "4111", "soldFinalD") },
    { labelRo: "Furnizori (de plătit)", labelEn: "Payables", ifpValue: getAcc(ifpRows, "401", "soldFinalC"), filatoValue: getAcc(filatoRows, "401", "soldFinalC") },
  ];

  function winner(ifpVal: number, filatoVal: number, lowerIsBetter = false): "ifp" | "filato" | "tie" {
    if (Math.abs(ifpVal - filatoVal) < 0.01) return "tie";
    if (lowerIsBetter) return ifpVal < filatoVal ? "ifp" : "filato";
    return ifpVal > filatoVal ? "ifp" : "filato";
  }

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold">
          {lang === "en" ? "Company Comparison" : "Comparație firme"}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="px-5 py-2.5 text-left text-muted-foreground font-medium w-1/3">
                {lang === "en" ? "Indicator" : "Indicator"}
              </th>
              <th className="px-5 py-2.5 text-right font-medium w-1/3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COMPANY_VIEW_COLORS.ifp }} />
                  IFP
                </span>
              </th>
              <th className="px-5 py-2.5 text-right font-medium w-1/3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COMPANY_VIEW_COLORS.filato }} />
                  FILATO
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isExpenseRow = row.labelRo.includes("cheltuieli") || row.labelRo.includes("Transport") || row.labelRo.includes("Salarii") || row.labelRo.includes("Servicii") || row.labelRo.includes("Chirii") || row.labelRo.includes("Furnizori");
              const w = row.isPercentage
                ? winner(row.ifpValue, row.filatoValue)
                : isExpenseRow
                  ? winner(row.ifpValue, row.filatoValue, true)
                  : winner(row.ifpValue, row.filatoValue);

              return (
                <tr
                  key={row.labelRo}
                  className={`border-b border-border/30 ${row.highlight ? "bg-secondary/20" : ""}`}
                >
                  <td className={`px-5 py-2 ${row.highlight ? "font-semibold" : "text-muted-foreground"}`}>
                    {lang === "en" ? row.labelEn : row.labelRo}
                  </td>
                  <td className="px-5 py-2 text-right">
                    <span className={`font-mono font-tabular ${w === "ifp" ? "text-emerald-400 font-semibold" : ""}`}>
                      {row.isPercentage ? (
                        formatPercent(row.ifpValue, locale)
                      ) : row.labelRo.includes("Nr.") ? (
                        row.ifpValue
                      ) : (
                        <Money amount={row.ifpValue} className="text-xs" />
                      )}
                    </span>
                  </td>
                  <td className="px-5 py-2 text-right">
                    <span className={`font-mono font-tabular ${w === "filato" ? "text-emerald-400 font-semibold" : ""}`}>
                      {row.isPercentage ? (
                        formatPercent(row.filatoValue, locale)
                      ) : row.labelRo.includes("Nr.") ? (
                        row.filatoValue
                      ) : (
                        <Money amount={row.filatoValue} className="text-xs" />
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
