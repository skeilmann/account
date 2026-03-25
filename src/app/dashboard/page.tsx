"use client";

import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { CompanySelector } from "@/components/molecules/company-selector";
import { CurrencyToggle } from "@/components/atoms/currency-toggle";
import { LangSwitcher } from "@/components/atoms/lang-switcher";
import { KPIGrid } from "@/components/organisms/kpi-grid";
import { ExpenseBreakdown } from "@/components/organisms/expense-breakdown";
import { RevenueChart } from "@/components/organisms/revenue-chart";
import { ExpenseChart } from "@/components/organisms/expense-chart";
import { CashPosition } from "@/components/organisms/cash-position";
import { TVASummary } from "@/components/organisms/tva-summary";
import { ReceivablesPayables } from "@/components/organisms/receivables-payables";
import { KeyRatios } from "@/components/organisms/key-ratios";
import { FiscalCalendar } from "@/components/organisms/fiscal-calendar";
import { StockTable } from "@/components/organisms/stock-table";
import { AlertsPanel } from "@/components/organisms/alerts-panel";
import { BusinessInsights } from "@/components/organisms/business-insights";
import { CompanyComparison } from "@/components/organisms/company-comparison";
import { LegislationPanel } from "@/components/organisms/legislation-panel";
import { DividendExplainer } from "@/components/organisms/dividend-explainer";
import { CustomCards } from "@/components/organisms/custom-card";
import { Calculator } from "@/components/organisms/calculator";
import { useDataStore } from "@/stores/data-store";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

export default function DashboardPage() {
  const { t } = useTranslation("common");
  const kpiSet = useDataStore((s) => s.kpiSet);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm px-6 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-lg font-semibold text-foreground">
            {t("app_title")}
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <LangSwitcher />
            <CompanySelector />
            <CurrencyToggle />
            <span className="text-xs text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-md">
              {t("period.full_year", { year: "2025" })}
            </span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-6 space-y-6">
        {kpiSet ? (
          <>
            {/* Custom cards */}
            <CustomCards />

            {/* Alerts */}
            <motion.div variants={fadeUp} initial="hidden" animate="show">
              <AlertsPanel />
            </motion.div>

            {/* KPI Cards */}
            <KPIGrid />

            {/* Charts row */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              transition={{ delay: 0.3 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              <RevenueChart />
              <ExpenseChart />
            </motion.div>

            {/* Expense + right column */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              transition={{ delay: 0.4 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              <div className="lg:col-span-2 space-y-6">
                <ExpenseBreakdown />
                <ReceivablesPayables />
              </div>
              <div className="space-y-6">
                <TVASummary />
                <CashPosition />
                <KeyRatios />
              </div>
            </motion.div>

            {/* Business insights + Company comparison */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              transition={{ delay: 0.5 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              <div className="space-y-6">
                <BusinessInsights />
                <DividendExplainer />
              </div>
              <CompanyComparison />
            </motion.div>

            {/* Fiscal calendar + Stock */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              transition={{ delay: 0.55 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              <div className="lg:col-span-2">
                <StockTable />
              </div>
              <div className="space-y-6">
                <FiscalCalendar />
                <LegislationPanel />
              </div>
            </motion.div>
          </>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            {t("status.no_data")}
          </div>
        )}
      </main>

      {/* Floating calculator */}
      <Calculator />
    </div>
  );
}
