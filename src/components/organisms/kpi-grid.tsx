"use client";

import { motion } from "framer-motion";
import { KPICard } from "@/components/molecules/kpi-card";
import { useDataStore } from "@/stores/data-store";
import type { KPIKey } from "@/types/kpi";

const KPI_ORDER: { key: KPIKey; isPercentage: boolean }[] = [
  { key: "revenue", isPercentage: false },
  { key: "expenses", isPercentage: false },
  { key: "profit", isPercentage: false },
  { key: "margin", isPercentage: true },
  { key: "stockValue", isPercentage: false },
  { key: "cashPosition", isPercentage: false },
];

const container = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

export function KPIGrid() {
  const kpiSet = useDataStore((s) => s.kpiSet);

  if (!kpiSet) return null;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4"
    >
      {KPI_ORDER.map(({ key, isPercentage }) => (
        <motion.div key={key} variants={item}>
          <KPICard
            kpiKey={key}
            value={kpiSet[key]}
            isPercentage={isPercentage}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}
