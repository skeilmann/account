"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { useDataStore } from "@/stores/data-store";
import { useCompanyStore } from "@/stores/company-store";
import { useCurrencyStore, convertAmount } from "@/stores/currency-store";
import type { NormalizedBalantaRow } from "@/types/balanta";
import { calcCompanyKPIs } from "@/lib/accounting/kpi-calculator";
import { useTranslation } from "react-i18next";
import { formatCompact, getLocaleCode } from "@/lib/utils/format";

interface WaterfallItem {
  name: string;
  value: number;
  base: number;
  color: string;
  isTotal?: boolean;
}

export function ProfitWaterfall() {
  const balanta = useDataStore((s) => s.balanta);
  const { activeView } = useCompanyStore();
  const { currency, eurRate, customRate } = useCurrencyStore();
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const locale = getLocaleCode(lang);
  const conv = (v: number) => convertAmount(v, currency, eurRate, customRate);

  const ifpRows = (balanta.ifp?.rows ?? []) as NormalizedBalantaRow[];
  const filatoRows = (balanta.filato?.rows ?? []) as NormalizedBalantaRow[];

  function getAcc(rows: NormalizedBalantaRow[], cont: string): number {
    return rows.find((r) => r.cont === cont && !r.isClassTotal && !r.isGrandTotal)?.sumeTotaleD ?? 0;
  }

  const rows = activeView === "ifp" ? ifpRows : activeView === "filato" ? filatoRows : [...ifpRows, ...filatoRows];
  const kpis = activeView === "combined"
    ? { revenue: calcCompanyKPIs(ifpRows).revenue + calcCompanyKPIs(filatoRows).revenue, expenses: calcCompanyKPIs(ifpRows).expenses + calcCompanyKPIs(filatoRows).expenses, profit: calcCompanyKPIs(ifpRows).profit + calcCompanyKPIs(filatoRows).profit }
    : calcCompanyKPIs(rows);

  const cogs = getAcc(ifpRows, "607") + getAcc(filatoRows, "607");
  const transport = getAcc(ifpRows, "624") + getAcc(filatoRows, "624");
  const salaries = getAcc(ifpRows, "641") + getAcc(filatoRows, "641") + getAcc(ifpRows, "6461") + getAcc(filatoRows, "6461");
  const services = getAcc(ifpRows, "628") + getAcc(filatoRows, "628");
  const amortizari = getAcc(ifpRows, "6811") + getAcc(filatoRows, "6811");
  const taxProfit = getAcc(ifpRows, "691") + getAcc(filatoRows, "691");
  const other = kpis.expenses - cogs - transport - salaries - services - amortizari - taxProfit;

  let running = conv(kpis.revenue);
  const items: WaterfallItem[] = [
    { name: lang === "en" ? "Revenue" : "Venituri", value: running, base: 0, color: "#10b981", isTotal: true },
  ];

  function add(name: string, amount: number) {
    const val = conv(amount);
    items.push({ name, value: -val, base: running - val, color: "#ef4444" });
    running -= val;
  }

  add(lang === "en" ? "COGS" : "Cost marfă", cogs);
  add("Transport", transport);
  add(lang === "en" ? "Salaries" : "Salarii", salaries);
  add(lang === "en" ? "Services" : "Servicii", services);
  add(lang === "en" ? "Depreciation" : "Amortizări", amortizari);
  add(lang === "en" ? "Income tax" : "Impozit profit", taxProfit);
  add(lang === "en" ? "Other" : "Altele", Math.max(0, other));

  items.push({
    name: lang === "en" ? "Net Profit" : "Profit net",
    value: running,
    base: 0,
    color: "#10b981",
    isTotal: true,
  });

  // Recharts stacked bar: invisible base + visible value
  const chartData = items.map((item) => ({
    name: item.name,
    base: item.isTotal ? 0 : item.base,
    value: item.isTotal ? item.value : Math.abs(item.value),
    color: item.color,
    isTotal: item.isTotal,
  }));

  return (
    <div className="rounded-xl bg-card border border-border p-5">
      <h3 className="text-sm font-semibold mb-4">
        {lang === "en" ? "Profit Waterfall" : "Cascadă profit"}
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} barSize={36}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
            tickLine={false}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={50}
          />
          <YAxis
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatCompact(v, locale)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1d27",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value, name) => {
              if (name === "base") return [null, null];
              return [
                new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(value)) + " " + currency,
                "",
              ];
            }}
          />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
          <Bar dataKey="base" stackId="a" fill="transparent" />
          <Bar dataKey="value" stackId="a" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} fillOpacity={entry.isTotal ? 1 : 0.7} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
