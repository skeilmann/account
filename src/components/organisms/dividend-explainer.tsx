"use client";

import { useMemo } from "react";
import { Money } from "@/components/atoms/money";
import { useDataStore } from "@/stores/data-store";
import { useCompanyStore } from "@/stores/company-store";
import { COMPANY_VIEW_COLORS } from "@/types/company";
import type { NormalizedBalantaRow } from "@/types/balanta";
import { InfoIcon } from "@/components/atoms/info-tooltip";
import { useTranslation } from "react-i18next";
import { formatPercent, getLocaleCode } from "@/lib/utils/format";
import { SubAccountDialog } from "@/components/molecules/sub-account-dialog";

// Verified 2026 dividend tax rules:
// - Impozit dividende: 16% (Legea 141/2025, Art. 43 alin. 1 Cod Fiscal, de la 10%)
// - CASS 10% peste plafon (Art. 170 Cod Fiscal)
// - Plafoane CASS bazate pe salariul minim brut 4.050 RON (2025)
// - Sources: alfasign.ro/taxe-dividende-srl, blog.factureaza.ro/dividendele-2025-2026

const DIVIDEND_TAX_RATE = 0.16; // 16% from 01.01.2026
const CASS_RATE = 0.10; // 10%
const MIN_SALARY_2025 = 4050; // RON brut pe luna

const CASS_THRESHOLDS = [
  { minSalaries: 6, amount: 6 * MIN_SALARY_2025, cass: 6 * MIN_SALARY_2025 * CASS_RATE }, // 24,300 → 2,430
  { minSalaries: 12, amount: 12 * MIN_SALARY_2025, cass: 12 * MIN_SALARY_2025 * CASS_RATE }, // 48,600 → 4,860
  { minSalaries: 24, amount: 24 * MIN_SALARY_2025, cass: 24 * MIN_SALARY_2025 * CASS_RATE }, // 97,200 → 9,720
];

function calcDividendTax(grossDividend: number): {
  gross: number;
  taxRate: number;
  tax: number;
  netAfterTax: number;
  cassApplies: boolean;
  cassAmount: number;
  cassThreshold: string;
  netFinal: number;
  effectiveRate: number;
} {
  const tax = grossDividend * DIVIDEND_TAX_RATE;
  const netAfterTax = grossDividend - tax;

  // CASS is calculated on net dividend amount
  let cassAmount = 0;
  let cassThreshold = "";
  let cassApplies = false;

  if (netAfterTax > CASS_THRESHOLDS[2].amount) {
    cassAmount = CASS_THRESHOLDS[2].cass; // 9,720 RON
    cassThreshold = `> ${CASS_THRESHOLDS[2].minSalaries} salarii minime`;
    cassApplies = true;
  } else if (netAfterTax > CASS_THRESHOLDS[1].amount) {
    cassAmount = CASS_THRESHOLDS[1].cass; // 4,860 RON
    cassThreshold = `${CASS_THRESHOLDS[1].minSalaries} salarii minime`;
    cassApplies = true;
  } else if (netAfterTax > CASS_THRESHOLDS[0].amount) {
    cassAmount = CASS_THRESHOLDS[0].cass; // 2,430 RON
    cassThreshold = `${CASS_THRESHOLDS[0].minSalaries} salarii minime`;
    cassApplies = true;
  }

  const netFinal = netAfterTax - cassAmount;
  const effectiveRate = grossDividend > 0 ? ((grossDividend - netFinal) / grossDividend) * 100 : 0;

  return {
    gross: grossDividend,
    taxRate: DIVIDEND_TAX_RATE * 100,
    tax,
    netAfterTax,
    cassApplies,
    cassAmount,
    cassThreshold,
    netFinal,
    effectiveRate,
  };
}

export function DividendExplainer() {
  const balanta = useDataStore((s) => s.balanta);
  const { activeView } = useCompanyStore();
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const locale = getLocaleCode(lang);

  const ifpRows = (balanta.ifp?.rows ?? []) as NormalizedBalantaRow[];
  const filatoRows = (balanta.filato?.rows ?? []) as NormalizedBalantaRow[];

  function getVal(rows: NormalizedBalantaRow[], cont: string, field: keyof NormalizedBalantaRow): number {
    const r = rows.find((x) => x.cont === cont && !x.isClassTotal && !x.isGrandTotal);
    return r ? (r[field] as number) ?? 0 : 0;
  }

  const data = useMemo(() => {
    const ifpProfit = getVal(ifpRows, "121", "soldFinalC") - getVal(ifpRows, "121", "soldFinalD");
    const filatoProfit = getVal(filatoRows, "121", "soldFinalC") - getVal(filatoRows, "121", "soldFinalD");
    const filatoDividendeDePlatit = getVal(filatoRows, "457", "soldFinalC");
    const ifpDividendeDePlatit = getVal(ifpRows, "457", "soldFinalC");

    return {
      ifpProfit,
      filatoProfit,
      ifpDividende: ifpDividendeDePlatit,
      filatoDividende: filatoDividendeDePlatit,
      ifpTax: calcDividendTax(ifpDividendeDePlatit),
      filatoTax: calcDividendTax(filatoDividendeDePlatit),
      ifpMaxDistributable: calcDividendTax(ifpProfit),
      filatoMaxDistributable: calcDividendTax(filatoProfit),
    };
  }, [ifpRows, filatoRows]);

  const showIfp = activeView === "combined" || activeView === "ifp";
  const showFilato = activeView === "combined" || activeView === "filato";

  const hasAnyDividends = data.ifpDividende > 0 || data.filatoDividende > 0;
  const hasAnyProfit = data.ifpProfit > 0 || data.filatoProfit > 0;

  if (!hasAnyDividends && !hasAnyProfit) return null;

  return (
    <div className="rounded-xl bg-card border border-border p-5">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-sm font-semibold">
          {lang === "en" ? "Dividend Tax Calculator 2026" : "Calculator taxe dividende 2026"}
        </h3>
        <InfoIcon
          text={
            lang === "en"
              ? "Dividend tax increased to 16% from 01.01.2026 (Law 141/2025). CASS 10% applies above 6 minimum salaries threshold (Art. 170 Fiscal Code)."
              : "Impozitul pe dividende a crescut la 16% de la 01.01.2026 (Legea 141/2025). CASS 10% se aplică peste plafonul de 6 salarii minime (Art. 170 Cod Fiscal)."
          }
          position="bottom"
        />
      </div>
      <p className="text-[10px] text-muted-foreground mb-4">
        {lang === "en"
          ? "Based on Legea 141/2025, Art. 43 & Art. 97 Cod Fiscal. CASS per Art. 170."
          : "Conform Legea 141/2025, Art. 43 și Art. 97 Cod Fiscal. CASS conform Art. 170."}
      </p>

      {/* Unpaid dividends section */}
      {hasAnyDividends && (
        <div className="mb-5">
          <SubAccountDialog
            parentCont="457"
            parentName={lang === "en" ? "Unpaid dividends" : "Dividende neplatite"}
            side="C"
          >
            <p className="text-xs font-medium text-amber-400 mb-2 hover:text-amber-300 cursor-pointer transition-colors">
              {lang === "en" ? "Unpaid dividends (cont 457)" : "Dividende neplătite (cont 457)"}
              <span className="text-[8px] ml-1 opacity-60">→</span>
            </p>
          </SubAccountDialog>
          <div className="space-y-3">
            {showFilato && data.filatoDividende > 0 && (
              <DividendRow
                company="FILATO"
                color={COMPANY_VIEW_COLORS.filato}
                calc={data.filatoTax}
                lang={lang}
                locale={locale}
              />
            )}
            {showIfp && data.ifpDividende > 0 && (
              <DividendRow
                company="IFP"
                color={COMPANY_VIEW_COLORS.ifp}
                calc={data.ifpTax}
                lang={lang}
                locale={locale}
              />
            )}
          </div>
        </div>
      )}

      {/* Distributable profit section */}
      {hasAnyProfit && (
        <div>
          <p className="text-xs font-medium text-foreground/70 mb-2">
            {lang === "en"
              ? "If full 2025 profit were distributed as dividends:"
              : "Dacă tot profitul 2025 ar fi distribuit ca dividende:"}
          </p>
          <div className="space-y-3">
            {showIfp && data.ifpProfit > 0 && (
              <DividendRow
                company="IFP"
                color={COMPANY_VIEW_COLORS.ifp}
                calc={data.ifpMaxDistributable}
                lang={lang}
                locale={locale}
              />
            )}
            {showFilato && data.filatoProfit > 0 && (
              <DividendRow
                company="FILATO"
                color={COMPANY_VIEW_COLORS.filato}
                calc={data.filatoMaxDistributable}
                lang={lang}
                locale={locale}
              />
            )}
          </div>
        </div>
      )}

      {/* Related accounts */}
      <div className="flex gap-3 mt-3 mb-1">
        <SubAccountDialog
          parentCont="462"
          parentName={lang === "en" ? "Creditors (loans)" : "Creditori (imprumuturi)"}
          side="C"
        >
          <span className="text-[9px] text-primary/60 hover:text-primary cursor-pointer transition-colors">
            {lang === "en" ? "Loan contracts (462)" : "Contracte imprumut (462)"} →
          </span>
        </SubAccountDialog>
        <SubAccountDialog
          parentCont="456"
          parentName={lang === "en" ? "Capital settlements" : "Decontari capital"}
          side="D"
        >
          <span className="text-[9px] text-primary/60 hover:text-primary cursor-pointer transition-colors">
            {lang === "en" ? "Capital settlements (456)" : "Decontari capital (456)"} →
          </span>
        </SubAccountDialog>
      </div>

      {/* Legal references */}
      <div className="mt-4 pt-3 border-t border-border/50 space-y-1">
        <p className="text-[9px] text-muted-foreground">
          {lang === "en"
            ? "Sources: Legea 141/2025 (Art. 43 par. 1 Fiscal Code \u2014 16% rate), Art. 97 (withholding for individuals), Art. 170 (CASS on investment income)"
            : "Surse: Legea 141/2025 (Art. 43 alin. 1 Cod Fiscal \u2014 cota 16%), Art. 97 (reținere la sursă PF), Art. 170 (CASS pe venituri din investiții)"}
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href="https://alfasign.ro/taxe-dividende-srl/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] text-primary/70 hover:text-primary"
          >
            Ghid taxe dividende {"\u2197"}
          </a>
          <a
            href="https://blog.factureaza.ro/dividendele-2025-2026/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] text-primary/70 hover:text-primary"
          >
            Dividende 2025-2026 {"\u2197"}
          </a>
          <a
            href="https://startupcafe.ro/impozitarea-dividendelor-ghid-anaf-2026-cu-informatii-pentru-firme-si-persoane-fizice-94043"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] text-primary/70 hover:text-primary"
          >
            Ghid ANAF dividende {"\u2197"}
          </a>
        </div>
      </div>
    </div>
  );
}

function DividendRow({
  company,
  color,
  calc,
  lang,
  locale,
}: {
  company: string;
  color: string;
  calc: ReturnType<typeof calcDividendTax>;
  lang: string;
  locale: string;
}) {
  return (
    <div className="bg-secondary/30 rounded-lg p-3 border border-border/30">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs font-semibold">{company}</span>
      </div>

      <div className="space-y-1 text-[11px]">
        <Row
          label={lang === "en" ? "Gross dividend" : "Dividend brut"}
          value={<Money amount={calc.gross} className="text-[11px]" />}
        />
        <Row
          label={`${lang === "en" ? "Tax" : "Impozit"} ${calc.taxRate}%`}
          value={
            <span className="text-red-400 font-mono font-tabular">
              -<Money amount={calc.tax} className="text-[11px] text-red-400" />
            </span>
          }
          info={
            lang === "en"
              ? "16% withheld at source by the company (Art. 43 Fiscal Code, modified by Law 141/2025)"
              : "16% reținut la sursă de firmă (Art. 43 Cod Fiscal, modificat prin Legea 141/2025)"
          }
        />
        <Row
          label={lang === "en" ? "Net after tax" : "Net după impozit"}
          value={<Money amount={calc.netAfterTax} className="text-[11px] font-semibold" />}
        />

        {calc.cassApplies && (
          <>
            <div className="border-t border-border/20 my-1" />
            <Row
              label={`CASS 10% (${calc.cassThreshold})`}
              value={
                <span className="text-red-400 font-mono font-tabular">
                  -<Money amount={calc.cassAmount} className="text-[11px] text-red-400" />
                </span>
              }
              info={
                lang === "en"
                  ? `Health insurance contribution (Art. 170 Fiscal Code). Applies because net dividend exceeds ${CASS_THRESHOLDS[0].amount.toLocaleString()} RON (6 minimum salaries). Max CASS: 9,720 RON/year.`
                  : `Contribuție de asigurări de sănătate (Art. 170 Cod Fiscal). Se aplică deoarece dividendul net depășește ${CASS_THRESHOLDS[0].amount.toLocaleString("ro-RO")} RON (6 salarii minime). Max CASS: 9.720 RON/an.`
              }
            />
          </>
        )}

        <div className="border-t border-border/30 mt-1 pt-1">
          <Row
            label={lang === "en" ? "Net received by shareholder" : "Net primit de acționar"}
            value={
              <Money amount={calc.netFinal} className="text-[11px] font-bold text-emerald-400" />
            }
            bold
          />
          <Row
            label={lang === "en" ? "Effective tax rate" : "Rată efectivă de impozitare"}
            value={
              <span className="font-mono font-tabular text-muted-foreground">
                {formatPercent(calc.effectiveRate, locale)}
              </span>
            }
          />
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  info,
  bold,
}: {
  label: string;
  value: React.ReactNode;
  info?: string;
  bold?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground flex items-center gap-0.5">
        {label}
        {info && <InfoIcon text={info} position="bottom" />}
      </span>
      {value}
    </div>
  );
}
