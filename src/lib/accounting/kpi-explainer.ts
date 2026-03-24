import type { NormalizedBalantaRow } from "@/types/balanta";
import type { KPIKey } from "@/types/kpi";

export interface KPIExplanation {
  /** Short human-friendly summary shown under the KPI value */
  summaryRo: string;
  summaryEn: string;
  /** Formula explanation shown in expanded view */
  formulaRo: string;
  formulaEn: string;
  /** Contextual insight based on the actual numbers */
  insightRo: string;
  insightEn: string;
  /** Contributing accounts */
  accounts: { cont: string; denumire: string; value: number }[];
}

function fmt(n: number): string {
  return n.toLocaleString("ro-RO", { maximumFractionDigits: 0 });
}

function getAccounts(
  rows: NormalizedBalantaRow[],
  filter: (r: NormalizedBalantaRow) => boolean,
  valueField: keyof NormalizedBalantaRow
): { cont: string; denumire: string; value: number }[] {
  return rows
    .filter((r) => !r.isClassTotal && !r.isGrandTotal && filter(r))
    .map((r) => ({
      cont: r.cont,
      denumire: r.denumire,
      value: r[valueField] as number,
    }))
    .filter((r) => r.value !== 0)
    .sort((a, b) => b.value - a.value);
}

export function getKPIExplanation(
  key: KPIKey,
  rows: NormalizedBalantaRow[],
  lang: string
): KPIExplanation {
  switch (key) {
    case "revenue": {
      const accounts = getAccounts(
        rows,
        (r) => r.accountClass === 7,
        "sumeTotaleC"
      );
      const total = accounts.reduce((s, a) => s + a.value, 0);
      const topAccount = accounts[0];
      const topPct = total > 0 && topAccount ? ((topAccount.value / total) * 100).toFixed(0) : "0";

      return {
        summaryRo: `C\u00E2t a v\u00E2ndut firma \u00EEn total pe anul 2025`,
        summaryEn: `Total sales generated during 2025`,
        formulaRo: `Suma tuturor conturilor de venituri (clasa 7) din Balan\u021Ba de verificare`,
        formulaEn: `Sum of all revenue accounts (class 7) from the trial balance`,
        insightRo: topAccount
          ? `${topPct}% din venituri provin din ${topAccount.denumire.toLowerCase()} (cont ${topAccount.cont}). ${accounts.length === 1 ? "Exist\u0103 o singur\u0103 surs\u0103 de venit." : `Exist\u0103 ${accounts.length} surse de venit.`}`
          : "Nu exist\u0103 venituri \u00EEnregistrate.",
        insightEn: topAccount
          ? `${topPct}% of revenue comes from ${topAccount.denumire.toLowerCase()} (account ${topAccount.cont}). ${accounts.length === 1 ? "There is a single revenue source." : `There are ${accounts.length} revenue sources.`}`
          : "No revenue recorded.",
        accounts,
      };
    }

    case "expenses": {
      const accounts = getAccounts(
        rows,
        (r) => r.accountClass === 6,
        "sumeTotaleD"
      );
      const total = accounts.reduce((s, a) => s + a.value, 0);
      const topAccount = accounts[0];
      const topPct = total > 0 && topAccount ? ((topAccount.value / total) * 100).toFixed(0) : "0";

      return {
        summaryRo: `Totalul cheltuielilor firmei pe anul 2025`,
        summaryEn: `Total company expenses during 2025`,
        formulaRo: `Suma tuturor conturilor de cheltuieli (clasa 6) din Balan\u021Ba de verificare`,
        formulaEn: `Sum of all expense accounts (class 6) from the trial balance`,
        insightRo: topAccount
          ? `Cea mai mare cheltuial\u0103: ${topAccount.denumire.toLowerCase()} (${fmt(topAccount.value)} RON, ${topPct}% din total). Sunt ${accounts.length} categorii de cheltuieli active.`
          : "Nu exist\u0103 cheltuieli \u00EEnregistrate.",
        insightEn: topAccount
          ? `Largest expense: ${topAccount.denumire.toLowerCase()} (${fmt(topAccount.value)} RON, ${topPct}% of total). There are ${accounts.length} active expense categories.`
          : "No expenses recorded.",
        accounts,
      };
    }

    case "profit": {
      const accounts = getAccounts(
        rows,
        (r) => r.cont === "121",
        "soldFinalC"
      );
      const profitRow = rows.find(
        (r) => r.cont === "121" && !r.isClassTotal && !r.isGrandTotal
      );
      const profit = profitRow
        ? profitRow.soldFinalC - profitRow.soldFinalD
        : 0;

      // Get revenue and expenses for context
      const revenue = rows
        .filter((r) => r.accountClass === 7 && !r.isClassTotal && !r.isGrandTotal)
        .reduce((s, r) => s + r.sumeTotaleC, 0);
      const expenses = rows
        .filter((r) => r.accountClass === 6 && !r.isClassTotal && !r.isGrandTotal)
        .reduce((s, r) => s + r.sumeTotaleD, 0);

      return {
        summaryRo: profit > 0
          ? `Firma a fost profitabil\u0103 \u2014 din fiecare 100 RON venituri, ${((profit / revenue) * 100).toFixed(0)} RON r\u0103m\u00E2n ca profit`
          : `Firma a \u00EEnregistrat pierdere pe anul 2025`,
        summaryEn: profit > 0
          ? `The company was profitable \u2014 for every 100 RON in revenue, ${((profit / revenue) * 100).toFixed(0)} RON remains as profit`
          : `The company recorded a loss in 2025`,
        formulaRo: `Contul 121 (Profit \u0219i pierdere) = Venituri totale \u2212 Cheltuieli totale`,
        formulaEn: `Account 121 (Profit and loss) = Total revenue \u2212 Total expenses`,
        insightRo: `Venituri: ${fmt(revenue)} RON \u2212 Cheltuieli: ${fmt(expenses)} RON = Profit: ${fmt(profit)} RON. ${profit > 500000 ? "Profitul este semnificativ \u2014 consider\u0103 optimizarea fiscal\u0103." : ""}`,
        insightEn: `Revenue: ${fmt(revenue)} RON \u2212 Expenses: ${fmt(expenses)} RON = Profit: ${fmt(profit)} RON. ${profit > 500000 ? "Profit is significant \u2014 consider tax optimization." : ""}`,
        accounts: accounts.map((a) => ({
          ...a,
          value: profit,
        })),
      };
    }

    case "margin": {
      const revenue = rows
        .filter((r) => r.accountClass === 7 && !r.isClassTotal && !r.isGrandTotal)
        .reduce((s, r) => s + r.sumeTotaleC, 0);
      const profitRow = rows.find(
        (r) => r.cont === "121" && !r.isClassTotal && !r.isGrandTotal
      );
      const profit = profitRow
        ? profitRow.soldFinalC - profitRow.soldFinalD
        : 0;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

      return {
        summaryRo: margin > 30
          ? `Marj\u0103 excelent\u0103 \u2014 firma p\u0103streaz\u0103 o parte important\u0103 din venituri ca profit`
          : margin > 15
            ? `Marj\u0103 bun\u0103 \u2014 \u00EEn intervalul normal pentru comer\u021Bul cu textile`
            : `Marj\u0103 sc\u0103zut\u0103 \u2014 necesit\u0103 analiz\u0103 a costurilor`,
        summaryEn: margin > 30
          ? `Excellent margin \u2014 the company retains a significant portion of revenue as profit`
          : margin > 15
            ? `Good margin \u2014 within normal range for textile trading`
            : `Low margin \u2014 cost analysis needed`,
        formulaRo: `Profit net \u00F7 Venituri totale \u00D7 100`,
        formulaEn: `Net profit \u00F7 Total revenue \u00D7 100`,
        insightRo: `${fmt(profit)} RON profit din ${fmt(revenue)} RON venituri. Media industriei textile: 10-20%. ${margin > 30 ? "Firma performeaz\u0103 peste medie." : ""}`,
        insightEn: `${fmt(profit)} RON profit from ${fmt(revenue)} RON revenue. Textile industry average: 10-20%. ${margin > 30 ? "The company outperforms the average." : ""}`,
        accounts: [],
      };
    }

    case "stockValue": {
      const accounts = getAccounts(
        rows,
        (r) => r.cont === "371",
        "soldFinalD"
      );
      const stockVal = accounts[0]?.value ?? 0;
      const revenue = rows
        .filter((r) => r.accountClass === 7 && !r.isClassTotal && !r.isGrandTotal)
        .reduce((s, r) => s + r.sumeTotaleC, 0);
      const stockToRevenue = revenue > 0 ? (stockVal / revenue) * 100 : 0;
      const turnoverDays = (() => {
        const cogs = rows.find(
          (r) => r.cont === "607" && !r.isClassTotal && !r.isGrandTotal
        )?.sumeTotaleD ?? 0;
        return cogs > 0 ? Math.round((stockVal / cogs) * 365) : 0;
      })();

      return {
        summaryRo: `Valoarea marf\u0103 aflat\u0103 \u00EEn depozit la sf\u00E2r\u0219itul anului 2025`,
        summaryEn: `Value of merchandise in warehouse at end of 2025`,
        formulaRo: `Contul 371 (M\u0103rfuri) \u2014 sold final debitor`,
        formulaEn: `Account 371 (Merchandise) \u2014 final debit balance`,
        insightRo: `Stocul reprezint\u0103 ${stockToRevenue.toFixed(0)}% din venitul anual. Rota\u021Bie: ~${turnoverDays} zile. ${turnoverDays > 200 ? "Rota\u021Bia este lent\u0103 \u2014 stoc mare imobilizat." : turnoverDays > 90 ? "Rota\u021Bie normal\u0103 pentru comer\u021B cu fire textile." : "Rota\u021Bie rapid\u0103."}`,
        insightEn: `Stock is ${stockToRevenue.toFixed(0)}% of annual revenue. Turnover: ~${turnoverDays} days. ${turnoverDays > 200 ? "Slow turnover \u2014 large immobilized stock." : turnoverDays > 90 ? "Normal turnover for textile yarn trading." : "Fast turnover."}`,
        accounts,
      };
    }

    case "cashPosition": {
      const cashAccounts = ["5121", "5124", "5311"];
      const accounts = getAccounts(
        rows,
        (r) => cashAccounts.includes(r.cont),
        "soldFinalD"
      );
      const total = accounts.reduce((s, a) => s + a.value, 0);
      const expenses = rows
        .filter((r) => r.accountClass === 6 && !r.isClassTotal && !r.isGrandTotal)
        .reduce((s, r) => s + r.sumeTotaleD, 0);
      const monthlyExp = expenses / 12;
      const runwayMonths = monthlyExp > 0 ? total / monthlyExp : 0;
      const hasForeignCurrency = accounts.some((a) => a.cont === "5124" && a.value > 0);

      return {
        summaryRo: `Banii disponibili \u00EEn banc\u0103 \u0219i cas\u0103 la sf\u00E2r\u0219itul anului`,
        summaryEn: `Cash available in bank and register at year end`,
        formulaRo: `Conturile 5121 (banc\u0103 RON) + 5124 (banc\u0103 valut\u0103) + 5311 (cas\u0103)`,
        formulaEn: `Accounts 5121 (bank RON) + 5124 (bank foreign currency) + 5311 (cash register)`,
        insightRo: `Lichiditatea acoper\u0103 ~${runwayMonths.toFixed(1)} luni de cheltuieli medii. ${hasForeignCurrency ? "Include conturi \u00EEn valut\u0103." : ""} ${runwayMonths < 2 ? "Aten\u021Bie \u2014 lichiditate sc\u0103zut\u0103!" : ""}`,
        insightEn: `Cash covers ~${runwayMonths.toFixed(1)} months of average expenses. ${hasForeignCurrency ? "Includes foreign currency accounts." : ""} ${runwayMonths < 2 ? "Warning \u2014 low liquidity!" : ""}`,
        accounts,
      };
    }
  }
}
