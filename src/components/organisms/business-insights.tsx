"use client";

import { useMemo } from "react";
import { Money } from "@/components/atoms/money";
import { useDataStore } from "@/stores/data-store";
import type { NormalizedBalantaRow } from "@/types/balanta";
import { calcCompanyKPIs } from "@/lib/accounting/kpi-calculator";
import { useTranslation } from "react-i18next";

interface Insight {
  icon: string;
  textRo: string;
  textEn: string;
  sentiment: "positive" | "neutral" | "negative";
}

export function BusinessInsights() {
  const balanta = useDataStore((s) => s.balanta);
  const stock = useDataStore((s) => s.stock);
  const { i18n } = useTranslation();
  const lang = i18n.language;

  const insights = useMemo(() => {
    const ifpRows = (balanta.ifp?.rows ?? []) as NormalizedBalantaRow[];
    const filatoRows = (balanta.filato?.rows ?? []) as NormalizedBalantaRow[];
    const ifp = calcCompanyKPIs(ifpRows);
    const filato = calcCompanyKPIs(filatoRows);
    const results: Insight[] = [];

    // 1. Overall profitability
    const combinedMargin =
      ((ifp.profit + filato.profit) / (ifp.revenue + filato.revenue)) * 100;
    if (combinedMargin > 30) {
      results.push({
        icon: "\uD83D\uDCC8",
        textRo: `Profitabilitate excelent\u0103: marja combinat\u0103 de ${combinedMargin.toFixed(1)}% este peste media industriei textile.`,
        textEn: `Excellent profitability: combined margin of ${combinedMargin.toFixed(1)}% is above textile industry average.`,
        sentiment: "positive",
      });
    }

    // 2. FILATO vs IFP
    if (filato.profit > ifp.profit) {
      const ratio = ((filato.profit / ifp.profit - 1) * 100).toFixed(0);
      results.push({
        icon: "\uD83C\uDFC6",
        textRo: `FILATO genereaz\u0103 cu ${ratio}% mai mult profit dec\u00E2t IFP, de\u0219i IFP are stocuri de ${(ifp.stockValue / filato.stockValue).toFixed(1)}x mai mari.`,
        textEn: `FILATO generates ${ratio}% more profit than IFP, despite IFP holding ${(ifp.stockValue / filato.stockValue).toFixed(1)}x more inventory.`,
        sentiment: "neutral",
      });
    }

    // 3. High inventory
    const stockToRevenue =
      ((ifp.stockValue + filato.stockValue) / (ifp.revenue + filato.revenue)) *
      100;
    if (stockToRevenue > 50) {
      results.push({
        icon: "\uD83D\uDCE6",
        textRo: `Stocurile reprezint\u0103 ${stockToRevenue.toFixed(0)}% din venituri. IFP de\u021Bine ${((ifp.stockValue / (ifp.stockValue + filato.stockValue)) * 100).toFixed(0)}% din stocul total.`,
        textEn: `Inventory is ${stockToRevenue.toFixed(0)}% of revenue. IFP holds ${((ifp.stockValue / (ifp.stockValue + filato.stockValue)) * 100).toFixed(0)}% of total stock.`,
        sentiment: "negative",
      });
    }

    // 4. Cash position
    const totalCash = ifp.cashPosition + filato.cashPosition;
    const monthlyExpenses = (ifp.expenses + filato.expenses) / 12;
    const cashMonths = monthlyExpenses > 0 ? totalCash / monthlyExpenses : 0;
    if (cashMonths < 1) {
      results.push({
        icon: "\u26A0\uFE0F",
        textRo: `Lichiditatea acoper\u0103 doar ${cashMonths.toFixed(1)} luni de cheltuieli. Consider\u0103 optimizarea \u00EEncas\u0103rilor.`,
        textEn: `Cash covers only ${cashMonths.toFixed(1)} months of expenses. Consider optimizing collections.`,
        sentiment: "negative",
      });
    } else {
      results.push({
        icon: "\uD83D\uDCB0",
        textRo: `Lichiditatea acoper\u0103 ${cashMonths.toFixed(1)} luni de cheltuieli.`,
        textEn: `Cash position covers ${cashMonths.toFixed(1)} months of expenses.`,
        sentiment: cashMonths > 3 ? "positive" : "neutral",
      });
    }

    // 5. Transport costs
    function getAcc(rows: NormalizedBalantaRow[], cont: string): number {
      return (
        rows.find(
          (r) => r.cont === cont && !r.isClassTotal && !r.isGrandTotal
        )?.sumeTotaleD ?? 0
      );
    }
    const totalTransport = getAcc(ifpRows, "624") + getAcc(filatoRows, "624");
    const transportPct =
      ((totalTransport / (ifp.revenue + filato.revenue)) * 100);
    if (transportPct > 3) {
      results.push({
        icon: "\uD83D\uDE9A",
        textRo: `Transportul reprezint\u0103 ${transportPct.toFixed(1)}% din venituri (${totalTransport.toLocaleString("ro-RO")} RON). IFP pl\u0103te\u0219te de 3x mai mult transport dec\u00E2t FILATO.`,
        textEn: `Transport costs are ${transportPct.toFixed(1)}% of revenue (${totalTransport.toLocaleString("en-US")} RON). IFP pays 3x more for transport than FILATO.`,
        sentiment: "neutral",
      });
    }

    // 6. External services
    const totalServices = getAcc(ifpRows, "628") + getAcc(filatoRows, "628");
    if (totalServices > 100000) {
      results.push({
        icon: "\uD83D\uDCBC",
        textRo: `Servicii externe (contabilitate, IT, juridic): ${totalServices.toLocaleString("ro-RO")} RON. IFP cheltuie\u0219te semnificativ mai mult pe servicii dec\u00E2t FILATO.`,
        textEn: `External services (accounting, IT, legal): ${totalServices.toLocaleString("en-US")} RON. IFP spends significantly more on services than FILATO.`,
        sentiment: "neutral",
      });
    }

    return results;
  }, [balanta, stock]);

  const SENTIMENT_BG = {
    positive: "border-l-emerald-500/50",
    neutral: "border-l-blue-500/50",
    negative: "border-l-amber-500/50",
  };

  return (
    <div className="rounded-xl bg-card border border-border p-5">
      <h3 className="text-sm font-semibold mb-4">
        {lang === "en" ? "Business Insights" : "Concluzii de business"}
      </h3>
      <div className="space-y-3">
        {insights.map((insight, i) => (
          <div
            key={i}
            className={`border-l-2 ${SENTIMENT_BG[insight.sentiment]} pl-3 py-1`}
          >
            <p className="text-sm leading-relaxed">
              <span className="mr-1.5">{insight.icon}</span>
              {lang === "en" ? insight.textEn : insight.textRo}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
