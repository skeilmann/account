"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

interface LegSection {
  titleKey: string;
  items: { key: string; urgent?: boolean }[];
}

const SECTIONS: LegSection[] = [
  {
    titleKey: "tva.title",
    items: [
      { key: "tva.cota_standard", urgent: true },
      { key: "tva.cota_redusa" },
      { key: "tva.plafon_scutire" },
      { key: "tva.plafon_incasare" },
      { key: "tva.deadline_d300", urgent: true },
      { key: "tva.e_factura" },
      { key: "tva.e_tva" },
    ],
  },
  {
    titleKey: "profit_tax.title",
    items: [
      { key: "profit_tax.rate" },
      { key: "profit_tax.dividende", urgent: true },
      { key: "profit_tax.mijloace_fixe" },
      { key: "profit_tax.micro" },
      { key: "profit_tax.deadline" },
    ],
  },
  {
    titleKey: "saft.title",
    items: [
      { key: "saft.descriere", urgent: true },
      { key: "saft.periodicitate_lunar" },
      { key: "saft.periodicitate_trimestrial" },
      { key: "saft.active" },
      { key: "saft.stocuri" },
    ],
  },
  {
    titleKey: "bilant.title",
    items: [
      { key: "bilant.termen", urgent: true },
      { key: "bilant.format" },
      { key: "bilant.continut" },
      { key: "bilant.sanctiuni", urgent: true },
    ],
  },
  {
    titleKey: "capital_social.title",
    items: [
      { key: "capital_social.srl_nou" },
      { key: "capital_social.srl_existent" },
      { key: "capital_social.cont_bancar", urgent: true },
    ],
  },
  {
    titleKey: "salary",
    items: [
      { key: "salary.cas" },
      { key: "salary.cass" },
      { key: "salary.cam" },
      { key: "salary.impozit" },
    ],
  },
];

export function LegislationPanel() {
  const { t, i18n } = useTranslation("legislation");
  const lang = i18n.language;
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);

  return (
    <div className="rounded-xl bg-card border border-border p-5">
      <h3 className="text-sm font-semibold mb-1">
        {lang === "en"
          ? "Legislation Reference 2026"
          : lang === "it"
            ? "Riferimenti legislativi 2026"
            : "Legislație de referință 2026"}
      </h3>
      <p className="text-[10px] text-muted-foreground mb-4">
        {lang === "en"
          ? "Verified from Monitorul Oficial, ANAF, and Legea 141/2025 / OUG 8/2026"
          : lang === "it"
            ? "Verificato da Monitorul Oficial, ANAF e Legge 141/2025 / OUG 8/2026"
            : "Verificat din Monitorul Oficial, ANAF și Legea 141/2025 / OUG 8/2026"}
      </p>

      <div className="space-y-2">
        {SECTIONS.map((section, idx) => {
          const isExpanded = expandedIdx === idx;
          const titleText = t(section.titleKey, section.titleKey);

          return (
            <div key={idx} className="border border-border/50 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-secondary/30 transition-colors"
              >
                <span className="text-xs font-medium">{titleText}</span>
                <motion.span
                  className="text-[9px] text-muted-foreground"
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {"\u25BC"}
                </motion.span>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 space-y-1.5">
                      {section.items.map((item) => {
                        const text = t(item.key, item.key);
                        return (
                          <div
                            key={item.key}
                            className={`text-[11px] leading-relaxed py-1 px-2 rounded ${
                              item.urgent
                                ? "bg-amber-500/10 border-l-2 border-amber-500/40 text-foreground/90"
                                : "text-muted-foreground"
                            }`}
                          >
                            {text}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Source links */}
      <div className="mt-4 pt-3 border-t border-border/50">
        <p className="text-[9px] text-muted-foreground mb-1">
          {lang === "en" ? "Official sources:" : "Surse oficiale:"}
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "ANAF", url: "https://www.anaf.ro" },
            { label: "Monitorul Oficial", url: "https://monitoruloficial.ro" },
            { label: "MFinanțe", url: "https://mfinante.gov.ro" },
            { label: "CECCAR", url: "https://ceccar.ro" },
          ].map((src) => (
            <a
              key={src.label}
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] text-primary/70 hover:text-primary transition-colors"
            >
              {src.label} {"\u2197"}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
