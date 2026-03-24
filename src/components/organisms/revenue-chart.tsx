"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import { useDataStore } from "@/stores/data-store";
import { useTranslation } from "react-i18next";
import { useCurrencyStore, convertAmount } from "@/stores/currency-store";
import { COMPANY_VIEW_COLORS } from "@/types/company";
import { calcCompanyKPIs } from "@/lib/accounting/kpi-calculator";
import type { NormalizedBalantaRow } from "@/types/balanta";
import { formatCompact, getLocaleCode } from "@/lib/utils/format";

export function RevenueChart() {
  const balanta = useDataStore((s) => s.balanta);
  const { t, i18n } = useTranslation("dashboard");
  const { currency, eurRate, customRate } = useCurrencyStore();
  const locale = getLocaleCode(i18n.language);

  const ifpRows = (balanta.ifp?.rows ?? []) as NormalizedBalantaRow[];
  const filatoRows = (balanta.filato?.rows ?? []) as NormalizedBalantaRow[];
  const ifpKPI = calcCompanyKPIs(ifpRows);
  const filatoKPI = calcCompanyKPIs(filatoRows);

  const conv = (v: number) => convertAmount(v, currency, eurRate, customRate);

  const data = [
    {
      name: t("kpi.revenue"),
      IFP: conv(ifpKPI.revenue),
      FILATO: conv(filatoKPI.revenue),
    },
    {
      name: t("kpi.expenses"),
      IFP: conv(ifpKPI.expenses),
      FILATO: conv(filatoKPI.expenses),
    },
    {
      name: t("kpi.profit"),
      IFP: conv(ifpKPI.profit),
      FILATO: conv(filatoKPI.profit),
    },
    {
      name: t("kpi.stock_value"),
      IFP: conv(ifpKPI.stockValue),
      FILATO: conv(filatoKPI.stockValue),
    },
  ];

  return (
    <div className="rounded-xl bg-card border border-border p-5">
      <h3 className="text-sm font-semibold mb-4">
        {t("sections.revenue_chart")}
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="name"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
            tickLine={false}
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
            formatter={(value) =>
              new Intl.NumberFormat(locale, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(Number(value)) +
              " " +
              currency
            }
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          />
          <Bar
            dataKey="IFP"
            fill={COMPANY_VIEW_COLORS.ifp}
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="FILATO"
            fill={COMPANY_VIEW_COLORS.filato}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
