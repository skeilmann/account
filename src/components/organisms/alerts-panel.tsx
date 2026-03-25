"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDataStore } from "@/stores/data-store";
import {
  generateAlerts,
  type Alert,
  type AlertSeverity,
} from "@/lib/accounting/alerts-engine";
import type { NormalizedBalantaRow } from "@/types/balanta";
import { useTranslation } from "react-i18next";

const SEVERITY_CONFIG: Record<
  AlertSeverity,
  { icon: string; bg: string; border: string; text: string }
> = {
  error: {
    icon: "\u26D4",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-400",
  },
  warning: {
    icon: "\u26A0\uFE0F",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-400",
  },
  info: {
    icon: "\u2139\uFE0F",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-400",
  },
  success: {
    icon: "\u2705",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
  },
};

export function AlertsPanel() {
  const balanta = useDataStore((s) => s.balanta);
  const stock = useDataStore((s) => s.stock);
  const { i18n } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const lang = i18n.language;

  const alerts = useMemo(() => {
    const ifpRows = (balanta.ifp?.rows ?? []) as NormalizedBalantaRow[];
    const filatoRows = (balanta.filato?.rows ?? []) as NormalizedBalantaRow[];
    return generateAlerts(ifpRows, filatoRows, stock.ifp, stock.filato);
  }, [balanta, stock]);

  if (alerts.length === 0) return null;

  const errors = alerts.filter((a) => a.severity === "error");
  const warnings = alerts.filter((a) => a.severity === "warning");
  const infos = alerts.filter((a) => a.severity === "info");
  const successes = alerts.filter((a) => a.severity === "success");

  const sortedAlerts = [...errors, ...warnings, ...infos, ...successes];

  return (
    <div className="rounded-xl bg-card border border-border p-5">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">
            {lang === "en" ? "Alerts & Checks" : "Alerte și verificări"}
          </h3>
          <div className="flex items-center gap-1">
            {errors.length > 0 && (
              <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-medium">
                {errors.length}
              </span>
            )}
            {warnings.length > 0 && (
              <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-medium">
                {warnings.length}
              </span>
            )}
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-medium">
              {successes.length} OK
            </span>
          </div>
        </div>
        <motion.span
          className="text-[10px] text-muted-foreground"
          animate={{ rotate: collapsed ? 0 : 180 }}
          transition={{ duration: 0.2 }}
        >
          {"\u25BC"}
        </motion.span>
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2">
              {sortedAlerts.map((alert, i) => (
                <AlertRow key={alert.id} alert={alert} lang={lang} index={i} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AlertRow({
  alert,
  lang,
  index,
}: {
  alert: Alert;
  lang: string;
  index: number;
}) {
  const cfg = SEVERITY_CONFIG[alert.severity];
  const title = lang === "en" ? alert.titleEn : alert.titleRo;
  const message = lang === "en" ? alert.messageEn : alert.messageRo;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`flex items-start gap-2 rounded-lg ${cfg.bg} border ${cfg.border} px-3 py-2`}
    >
      <span className="text-sm shrink-0 mt-0.5">{cfg.icon}</span>
      <div className="min-w-0">
        <p className={`text-xs font-medium ${cfg.text}`}>{title}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{message}</p>
      </div>
    </motion.div>
  );
}
