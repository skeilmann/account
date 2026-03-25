"use client";

import { useTranslation } from "react-i18next";

interface FiscalDeadline {
  code: string;
  nameRo: string;
  nameEn: string;
  frequency: string;
  day: number;
  urgency: "overdue" | "soon" | "upcoming" | "ok";
  nextDate: string;
}

function getDeadlines(): FiscalDeadline[] {
  // Based on current date 2026-03-24, calculate next deadlines
  const now = new Date(2026, 2, 24); // March 24, 2026

  const deadlines: FiscalDeadline[] = [
    {
      code: "D300",
      nameRo: "Decont TVA",
      nameEn: "VAT Return",
      frequency: "lunar",
      day: 25,
      nextDate: "2026-03-25",
      urgency: "soon", // Tomorrow!
    },
    {
      code: "D390",
      nameRo: "Declarație recapitulativă",
      nameEn: "Recapitulative statement",
      frequency: "lunar",
      day: 25,
      nextDate: "2026-03-25",
      urgency: "soon",
    },
    {
      code: "D101",
      nameRo: "Impozit pe profit (T1 2026)",
      nameEn: "Corporate tax (Q1 2026)",
      frequency: "trimestrial",
      day: 25,
      nextDate: "2026-04-25",
      urgency: "upcoming",
    },
    {
      code: "D406",
      nameRo: "SAF-T (februarie 2026)",
      nameEn: "SAF-T (February 2026)",
      frequency: "lunar",
      day: 31,
      nextDate: "2026-03-31",
      urgency: "upcoming",
    },
    {
      code: "D394",
      nameRo: "Declarație informativă (S2 2025)",
      nameEn: "Informative declaration (H2 2025)",
      frequency: "semestrial",
      day: 25,
      nextDate: "2026-02-25",
      urgency: "overdue",
    },
    {
      code: "Bilanț",
      nameRo: "Depunere bilanț contabil 2025",
      nameEn: "Annual financial statements 2025",
      frequency: "anual",
      day: 31,
      nextDate: "2026-05-31",
      urgency: "ok",
    },
  ];

  return deadlines;
}

const URGENCY_STYLE = {
  overdue: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    badge: "bg-red-500/20 text-red-400",
    labelRo: "Depășit",
    labelEn: "Overdue",
  },
  soon: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    badge: "bg-amber-500/20 text-amber-400",
    labelRo: "Mâine!",
    labelEn: "Tomorrow!",
  },
  upcoming: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    badge: "bg-blue-500/20 text-blue-400",
    labelRo: "Curând",
    labelEn: "Soon",
  },
  ok: {
    bg: "bg-secondary/30",
    border: "border-border",
    badge: "bg-secondary text-muted-foreground",
    labelRo: "OK",
    labelEn: "OK",
  },
};

export function FiscalCalendar() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const deadlines = getDeadlines();

  return (
    <div className="rounded-xl bg-card border border-border p-5">
      <h3 className="text-sm font-semibold mb-4">
        {lang === "en" ? "Fiscal Calendar" : "Calendar fiscal"}
      </h3>
      <div className="space-y-2">
        {deadlines.map((d) => {
          const style = URGENCY_STYLE[d.urgency];
          return (
            <div
              key={d.code}
              className={`flex items-center justify-between rounded-lg ${style.bg} border ${style.border} px-3 py-2`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-primary">
                    {d.code}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${style.badge}`}>
                    {lang === "en" ? style.labelEn : style.labelRo}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {lang === "en" ? d.nameEn : d.nameRo}
                </p>
              </div>
              <div className="text-right shrink-0 ml-2">
                <p className="text-xs font-mono">
                  {formatDate(d.nextDate, lang)}
                </p>
                <p className="text-[9px] text-muted-foreground">{d.frequency}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDate(iso: string, lang: string): string {
  const d = new Date(iso + "T00:00:00");
  if (lang === "en") {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  if (lang === "it") {
    return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
  }
  return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.${d.getFullYear()}`;
}
