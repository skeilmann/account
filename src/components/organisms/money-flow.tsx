"use client";

import { useMemo } from "react";
import { Money } from "@/components/atoms/money";
import { useDataStore } from "@/stores/data-store";
import { useCurrencyStore, convertAmount } from "@/stores/currency-store";
import { COMPANY_VIEW_COLORS } from "@/types/company";
import type { NormalizedBalantaRow } from "@/types/balanta";
import { calcCompanyKPIs } from "@/lib/accounting/kpi-calculator";
import { useTranslation } from "react-i18next";
import { formatCompact, getLocaleCode } from "@/lib/utils/format";

interface FlowNode {
  id: string;
  label: string;
  value: number;
  color: string;
  x: number;
  y: number;
  width: number;
}

interface FlowLink {
  from: string;
  to: string;
  value: number;
  color: string;
}

export function MoneyFlow() {
  const balanta = useDataStore((s) => s.balanta);
  const { currency, eurRate, customRate } = useCurrencyStore();
  const { t, i18n } = useTranslation("dashboard");
  const locale = getLocaleCode(i18n.language);

  const conv = (v: number) => convertAmount(v, currency, eurRate, customRate);

  const data = useMemo(() => {
    const ifpRows = (balanta.ifp?.rows ?? []) as NormalizedBalantaRow[];
    const filatoRows = (balanta.filato?.rows ?? []) as NormalizedBalantaRow[];
    const ifp = calcCompanyKPIs(ifpRows);
    const filato = calcCompanyKPIs(filatoRows);

    return { ifp, filato };
  }, [balanta]);

  const { ifp, filato } = data;
  const totalRevenue = ifp.revenue + filato.revenue;
  const totalExpenses = ifp.expenses + filato.expenses;
  const totalProfit = ifp.profit + filato.profit;

  // SVG dimensions
  const W = 800;
  const H = 400;
  const colX = [40, 250, 500, 700];

  // Node definitions
  const nodes: FlowNode[] = [
    // Column 1: Revenue sources
    { id: "rev-ifp", label: `IFP ${t("kpi.revenue")}`, value: ifp.revenue, color: COMPANY_VIEW_COLORS.ifp, x: colX[0], y: 60, width: 160 },
    { id: "rev-filato", label: `FILATO ${t("kpi.revenue")}`, value: filato.revenue, color: COMPANY_VIEW_COLORS.filato, x: colX[0], y: 200, width: 160 },
    // Column 2: Total
    { id: "total", label: t("kpi.revenue"), value: totalRevenue, color: COMPANY_VIEW_COLORS.combined, x: colX[1], y: 120, width: 160 },
    // Column 3: Split
    { id: "expenses", label: t("kpi.expenses"), value: totalExpenses, color: "#ef4444", x: colX[2], y: 60, width: 150 },
    { id: "profit", label: t("kpi.profit"), value: totalProfit, color: "#10b981", x: colX[2], y: 240, width: 150 },
    // Column 4: Stock
    { id: "stock", label: t("kpi.stock_value"), value: ifp.stockValue + filato.stockValue, color: "#8b5cf6", x: colX[3], y: 160, width: 90 },
  ];

  const links: FlowLink[] = [
    { from: "rev-ifp", to: "total", value: ifp.revenue, color: COMPANY_VIEW_COLORS.ifp },
    { from: "rev-filato", to: "total", value: filato.revenue, color: COMPANY_VIEW_COLORS.filato },
    { from: "total", to: "expenses", value: totalExpenses, color: "#ef4444" },
    { from: "total", to: "profit", value: totalProfit, color: "#10b981" },
  ];

  function getNodeCenter(id: string): { x: number; y: number } {
    const n = nodes.find((n) => n.id === id)!;
    return { x: n.x + n.width / 2, y: n.y + 24 };
  }

  function makePath(from: string, to: string): string {
    const f = getNodeCenter(from);
    const t = getNodeCenter(to);
    const fNode = nodes.find((n) => n.id === from)!;
    const tNode = nodes.find((n) => n.id === to)!;
    const fx = fNode.x + fNode.width;
    const tx = tNode.x;
    const midX = (fx + tx) / 2;
    return `M ${fx} ${f.y} C ${midX} ${f.y}, ${midX} ${t.y}, ${tx} ${t.y}`;
  }

  return (
    <div className="rounded-xl bg-card border border-border p-5">
      <h3 className="text-sm font-semibold mb-4">
        {i18n.language === "en" ? "Money Flow" : "Fluxul banilor"}
      </h3>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[600px]"
          style={{ maxHeight: 380 }}
        >
          {/* Links */}
          {links.map((link) => {
            const thickness = Math.max(
              2,
              Math.min(30, (link.value / totalRevenue) * 60)
            );
            return (
              <g key={`${link.from}-${link.to}`}>
                <path
                  d={makePath(link.from, link.to)}
                  fill="none"
                  stroke={link.color}
                  strokeWidth={thickness}
                  strokeOpacity={0.25}
                  strokeLinecap="round"
                />
                {/* Animated dot */}
                <circle r={3} fill={link.color} opacity={0.8}>
                  <animateMotion
                    dur="3s"
                    repeatCount="indefinite"
                    path={makePath(link.from, link.to)}
                  />
                </circle>
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => (
            <g key={node.id}>
              <rect
                x={node.x}
                y={node.y}
                width={node.width}
                height={48}
                rx={8}
                fill={node.color + "15"}
                stroke={node.color + "40"}
                strokeWidth={1.5}
              />
              <text
                x={node.x + node.width / 2}
                y={node.y + 18}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize={10}
              >
                {node.label}
              </text>
              <text
                x={node.x + node.width / 2}
                y={node.y + 36}
                textAnchor="middle"
                fill="#f1f5f9"
                fontSize={13}
                fontWeight={700}
                fontFamily="monospace"
              >
                {formatCompact(conv(node.value), locale)} {currency}
              </text>
            </g>
          ))}

          {/* Percentage labels on links */}
          <text
            x={(colX[1] + colX[2]) / 2 + 80}
            y={75}
            textAnchor="middle"
            fill="#ef4444"
            fontSize={10}
            fontWeight={600}
          >
            {((totalExpenses / totalRevenue) * 100).toFixed(0)}%
          </text>
          <text
            x={(colX[1] + colX[2]) / 2 + 80}
            y={255}
            textAnchor="middle"
            fill="#10b981"
            fontSize={10}
            fontWeight={600}
          >
            {((totalProfit / totalRevenue) * 100).toFixed(0)}%
          </text>
        </svg>
      </div>
    </div>
  );
}
