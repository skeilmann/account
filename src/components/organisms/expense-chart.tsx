"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { useDataStore } from "@/stores/data-store";
import { useCompanyStore } from "@/stores/company-store";
import { useCurrencyStore, convertAmount } from "@/stores/currency-store";
import { useTranslation } from "react-i18next";
import { getLocaleCode } from "@/lib/utils/format";

const COLORS = [
  "#3b82f6",
  "#14b8a6",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#6366f1",
  "#ef4444",
  "#22d3ee",
  "#a3e635",
];

export function ExpenseChart() {
  const expenseGroups = useDataStore((s) => s.expenseGroups);
  const { activeView } = useCompanyStore();
  const { currency, eurRate, customRate } = useCurrencyStore();
  const { t, i18n } = useTranslation("dashboard");
  const locale = getLocaleCode(i18n.language);

  if (expenseGroups.length === 0) return null;

  const conv = (v: number) => convertAmount(v, currency, eurRate, customRate);

  const data = [...expenseGroups]
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 8)
    .map((g) => {
      const amount =
        activeView === "combined"
          ? g.totalAmount
          : g.perCompany[activeView === "ifp" ? "ifp" : "filato"];
      return {
        name: t(`expense_groups.${g.definition.id}`, g.definition.id),
        value: conv(amount),
        icon: g.definition.icon,
      };
    })
    .filter((d) => d.value > 0);

  return (
    <div className="rounded-xl bg-card border border-border p-5">
      <h3 className="text-sm font-semibold mb-4">
        {t("sections.expense_chart")}
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            dataKey="value"
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
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
            layout="vertical"
            align="right"
            verticalAlign="middle"
            wrapperStyle={{ fontSize: 11, lineHeight: "20px" }}
            formatter={(value) => {
              const item = data.find((d) => d.name === value);
              return `${item?.icon || ""} ${value}`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
