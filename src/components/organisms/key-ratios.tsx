"use client";

import { useDataStore } from "@/stores/data-store";
import { useCompanyStore } from "@/stores/company-store";
import type { NormalizedBalantaRow } from "@/types/balanta";
import { useTranslation } from "react-i18next";
import { formatPercent, getLocaleCode } from "@/lib/utils/format";
import { InfoIcon } from "@/components/atoms/info-tooltip";

interface Ratio {
  labelRo: string;
  labelEn: string;
  tipRo: string;
  tipEn: string;
  compute: (rows: NormalizedBalantaRow[]) => { value: number; display: string; rag: "green" | "amber" | "red" };
}

function getAcc(rows: NormalizedBalantaRow[], cont: string, field: keyof NormalizedBalantaRow): number {
  const r = rows.find((x) => x.cont === cont && !x.isClassTotal && !x.isGrandTotal);
  return r ? (r[field] as number) ?? 0 : 0;
}

function sumClass(rows: NormalizedBalantaRow[], cls: number, field: keyof NormalizedBalantaRow): number {
  return rows
    .filter((r) => r.accountClass === cls && !r.isClassTotal && !r.isGrandTotal)
    .reduce((s, r) => s + ((r[field] as number) ?? 0), 0);
}

const RATIOS: Ratio[] = [
  {
    labelRo: "Marjă brută",
    labelEn: "Gross margin",
    tipRo: "Cât rămâne din venituri după scăderea costului mărfii vândute. Peste 40% = excelent pentru comerț.",
    tipEn: "What remains from revenue after deducting cost of goods sold. Above 40% = excellent for trading.",
    compute: (rows) => {
      const revenue = sumClass(rows, 7, "sumeTotaleC");
      const cogs = getAcc(rows, "607", "sumeTotaleD");
      const margin = revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0;
      return { value: margin, display: formatPercent(margin), rag: margin > 40 ? "green" : margin > 20 ? "amber" : "red" };
    },
  },
  {
    labelRo: "Rata cheltuielilor salariale",
    labelEn: "Salary expense ratio",
    tipRo: "Ce procent din venituri merge pe salarii. Sub 15% = eficient, peste 30% = greu de susținut.",
    tipEn: "What percentage of revenue goes to salaries. Under 15% = efficient, over 30% = hard to sustain.",
    compute: (rows) => {
      const revenue = sumClass(rows, 7, "sumeTotaleC");
      const salaries = getAcc(rows, "641", "sumeTotaleD");
      const ratio = revenue > 0 ? (salaries / revenue) * 100 : 0;
      return { value: ratio, display: formatPercent(ratio), rag: ratio < 15 ? "green" : ratio < 30 ? "amber" : "red" };
    },
  },
  {
    labelRo: "Rata de îndatorare",
    labelEn: "Debt ratio",
    tipRo: "Cât din activele firmei sunt finanțate prin datorii. Sub 30% = solid, peste 60% = risc.",
    tipEn: "How much of company assets are financed by debt. Under 30% = solid, over 60% = risky.",
    compute: (rows) => {
      const furnizori = getAcc(rows, "401", "soldFinalC");
      const creditori = getAcc(rows, "462", "soldFinalC");
      const dividende = getAcc(rows, "457", "soldFinalC");
      const totalDebt = furnizori + creditori + dividende;
      const totalAssets = rows.find((r) => r.isGrandTotal)?.soldFinalD ?? 0;
      const ratio = totalAssets > 0 ? (totalDebt / totalAssets) * 100 : 0;
      return { value: ratio, display: formatPercent(ratio), rag: ratio < 30 ? "green" : ratio < 60 ? "amber" : "red" };
    },
  },
  {
    labelRo: "Rotație stoc (zile)",
    labelEn: "Inventory turnover (days)",
    tipRo: "În câte zile se vinde stocul mediu. Sub 90 = rapid, peste 180 = bani blocai în marfă.",
    tipEn: "How many days to sell average inventory. Under 90 = fast, over 180 = cash tied up in goods.",
    compute: (rows) => {
      const stock = getAcc(rows, "371", "soldFinalD");
      const cogs = getAcc(rows, "607", "sumeTotaleD");
      const days = cogs > 0 ? Math.round((stock / cogs) * 365) : 0;
      return { value: days, display: `${days} zile`, rag: days < 90 ? "green" : days < 180 ? "amber" : "red" };
    },
  },
  {
    labelRo: "Rotație clienți (zile)",
    labelEn: "Receivables turnover (days)",
    tipRo: "În câte zile încasează firma de la clienți. Sub 30 = bine, peste 60 = problematic.",
    tipEn: "How many days until clients pay. Under 30 = good, over 60 = problematic.",
    compute: (rows) => {
      const clienti = getAcc(rows, "4111", "soldFinalD");
      const revenue = sumClass(rows, 7, "sumeTotaleC");
      const days = revenue > 0 ? Math.round((clienti / revenue) * 365) : 0;
      return { value: days, display: `${days} zile`, rag: days < 30 ? "green" : days < 60 ? "amber" : "red" };
    },
  },
];

export function KeyRatios() {
  const balanta = useDataStore((s) => s.balanta);
  const { activeView } = useCompanyStore();
  const { i18n } = useTranslation();
  const lang = i18n.language;

  const ifpRows = (balanta.ifp?.rows ?? []) as NormalizedBalantaRow[];
  const filatoRows = (balanta.filato?.rows ?? []) as NormalizedBalantaRow[];
  const viewRows =
    activeView === "combined"
      ? [...ifpRows, ...filatoRows]
      : activeView === "ifp"
        ? ifpRows
        : filatoRows;

  const RAG_COLORS = { green: "#10b981", amber: "#f59e0b", red: "#ef4444" };

  return (
    <div className="rounded-xl bg-card border border-border p-5">
      <h3 className="text-sm font-semibold mb-4">
        {lang === "en" ? "Key Ratios" : "Indicatori cheie"}
      </h3>
      <div className="space-y-3">
        {RATIOS.map((ratio) => {
          const result = ratio.compute(viewRows);
          return (
            <div
              key={ratio.labelRo}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-1 min-w-0">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: RAG_COLORS[result.rag] }}
                />
                <span className="text-sm truncate">
                  {lang === "en" ? ratio.labelEn : ratio.labelRo}
                </span>
                <InfoIcon
                  text={lang === "en" ? ratio.tipEn : ratio.tipRo}
                  position="bottom"
                />
              </div>
              <span className="text-sm font-mono font-semibold font-tabular shrink-0 ml-2">
                {result.display}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
