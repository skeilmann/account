"use client";

import { Money } from "@/components/atoms/money";
import { useDataStore } from "@/stores/data-store";
import { useCompanyStore } from "@/stores/company-store";
import { COMPANY_VIEW_COLORS } from "@/types/company";
import type { NormalizedBalantaRow } from "@/types/balanta";
import { useTranslation } from "react-i18next";
import { InfoIcon } from "@/components/atoms/info-tooltip";

const CASH_ACCOUNTS = [
  { cont: "5121", labelKey: "5121", tipRo: "Soldul conturilor bancare \u00EEn lei la sf\u00E2r\u0219itul anului.", tipEn: "RON bank account balance at year end." },
  { cont: "5124", labelKey: "5124", tipRo: "Soldul conturilor bancare \u00EEn valut\u0103 (EUR, USD etc.) exprimat \u00EEn RON.", tipEn: "Foreign currency bank balance (EUR, USD, etc.) expressed in RON." },
  { cont: "5311", labelKey: "5311", tipRo: "Numerar fizic \u00EEn casa firmei.", tipEn: "Physical cash in the company register." },
  { cont: "542", labelKey: "542", tipRo: "Avansuri de trezorerie date angaja\u021Bilor pentru deplas\u0103ri sau achizi\u021Bii.", tipEn: "Treasury advances given to employees for trips or purchases." },
];

export function CashPosition() {
  const balanta = useDataStore((s) => s.balanta);
  const { activeView } = useCompanyStore();
  const { t, i18n } = useTranslation(["dashboard", "accounts"]);
  const lang = i18n.language;

  function getAccountValue(
    rows: NormalizedBalantaRow[],
    cont: string
  ): number {
    const row = rows.find(
      (r) => r.cont === cont && !r.isClassTotal && !r.isGrandTotal
    );
    return row ? row.soldFinalD - row.soldFinalC : 0;
  }

  const ifpRows = (balanta.ifp?.rows ?? []) as NormalizedBalantaRow[];
  const filatoRows = (balanta.filato?.rows ?? []) as NormalizedBalantaRow[];

  const cashItems = CASH_ACCOUNTS.map(({ cont, labelKey, tipRo, tipEn }) => {
    const ifpVal = getAccountValue(ifpRows, cont);
    const filatoVal = getAccountValue(filatoRows, cont);
    const combined = ifpVal + filatoVal;

    if (combined === 0 && activeView === "combined") return null;

    const displayVal =
      activeView === "combined"
        ? combined
        : activeView === "ifp"
          ? ifpVal
          : filatoVal;

    if (displayVal === 0) return null;

    return { cont, labelKey, displayVal, ifpVal, filatoVal, tipRo, tipEn };
  }).filter(Boolean);

  return (
    <div className="rounded-xl bg-card border border-border p-5">
      <h3 className="text-sm font-semibold mb-4">
        {t("dashboard:sections.cash")}
      </h3>
      <div className="space-y-3">
        {cashItems.map((item) => {
          if (!item) return null;
          return (
            <div
              key={item.cont}
              className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
            >
              <div>
                <p className="text-sm">
                  {t(`accounts:${item.cont}`, item.cont)}
                  <InfoIcon text={lang === "en" ? item.tipEn : item.tipRo} position="bottom" />
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {item.cont}
                </p>
              </div>
              <div className="text-right">
                <Money amount={item.displayVal} className="text-sm font-semibold" />
                {activeView === "combined" && (
                  <div className="flex gap-2 mt-0.5 text-[10px] text-muted-foreground">
                    <span>
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full mr-0.5"
                        style={{ backgroundColor: COMPANY_VIEW_COLORS.ifp }}
                      />
                      <Money amount={item.ifpVal} compact className="text-[10px]" />
                    </span>
                    <span>
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full mr-0.5"
                        style={{ backgroundColor: COMPANY_VIEW_COLORS.filato }}
                      />
                      <Money amount={item.filatoVal} compact className="text-[10px]" />
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
