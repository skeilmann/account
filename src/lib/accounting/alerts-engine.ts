import type { NormalizedBalantaRow } from "@/types/balanta";
import type { CompanyId } from "@/types/company";
import type { ParsedStock } from "@/types/stock";

export type AlertSeverity = "error" | "warning" | "info" | "success";

export interface Alert {
  id: string;
  severity: AlertSeverity;
  titleRo: string;
  titleEn: string;
  messageRo: string;
  messageEn: string;
  companyId?: CompanyId;
  value?: number;
}

function getAccountValue(
  rows: NormalizedBalantaRow[],
  cont: string,
  field: "sumeTotaleD" | "sumeTotaleC" | "soldFinalD" | "soldFinalC"
): number {
  const row = rows.find(
    (r) => r.cont === cont && !r.isClassTotal && !r.isGrandTotal
  );
  return row ? row[field] : 0;
}

export function generateAlerts(
  ifpRows: NormalizedBalantaRow[],
  filatoRows: NormalizedBalantaRow[],
  ifpStock: ParsedStock | null,
  filatoStock: ParsedStock | null
): Alert[] {
  const alerts: Alert[] = [];

  // --- Validation alerts ---
  for (const [companyId, rows] of [
    ["ifp", ifpRows],
    ["filato", filatoRows],
  ] as const) {
    const total = rows.find((r) => r.isGrandTotal);
    if (total) {
      const diff = Math.abs(total.soldFinalD - total.soldFinalC);
      if (diff < 0.01) {
        alerts.push({
          id: `balanced-${companyId}`,
          severity: "success",
          titleRo: "Balan\u021B\u0103 echilibrat\u0103",
          titleEn: "Trial balance is balanced",
          messageRo: `${companyId.toUpperCase()}: Sold final D = C`,
          messageEn: `${companyId.toUpperCase()}: Final balance D = C`,
          companyId,
        });
      } else {
        alerts.push({
          id: `unbalanced-${companyId}`,
          severity: "error",
          titleRo: "Balan\u021B\u0103 neechilibrat\u0103!",
          titleEn: "Trial balance NOT balanced!",
          messageRo: `${companyId.toUpperCase()}: Diferen\u021B\u0103 de ${diff.toFixed(2)} RON`,
          messageEn: `${companyId.toUpperCase()}: Difference of ${diff.toFixed(2)} RON`,
          companyId,
          value: diff,
        });
      }
    }
  }

  // --- TVA alerts ---
  const ifpTvaPlata = getAccountValue(ifpRows, "4423", "soldFinalC");
  const filatoTvaRecuperat = getAccountValue(filatoRows, "4424", "soldFinalD");

  if (ifpTvaPlata > 0) {
    alerts.push({
      id: "tva-plata-ifp",
      severity: "warning",
      titleRo: "TVA de plat\u0103 \u2014 IFP",
      titleEn: "VAT payable \u2014 IFP",
      messageRo: `IFP are TVA de plat\u0103: ${ifpTvaPlata.toLocaleString("ro-RO")} RON. Termen: 25 a lunii urm\u0103toare.`,
      messageEn: `IFP has VAT payable: ${ifpTvaPlata.toLocaleString("en-US")} RON. Deadline: 25th of following month.`,
      companyId: "ifp",
      value: ifpTvaPlata,
    });
  }

  if (filatoTvaRecuperat > 0) {
    alerts.push({
      id: "tva-recuperat-filato",
      severity: "info",
      titleRo: "TVA de recuperat \u2014 FILATO",
      titleEn: "VAT receivable \u2014 FILATO",
      messageRo: `FILATO are TVA de recuperat: ${filatoTvaRecuperat.toLocaleString("ro-RO")} RON.`,
      messageEn: `FILATO has VAT receivable: ${filatoTvaRecuperat.toLocaleString("en-US")} RON.`,
      companyId: "filato",
      value: filatoTvaRecuperat,
    });
  }

  // --- Stock cross-validation ---
  for (const [companyId, rows, stock] of [
    ["ifp", ifpRows, ifpStock],
    ["filato", filatoRows, filatoStock],
  ] as const) {
    if (!stock) continue;
    const cont371 = getAccountValue(rows, "371", "soldFinalD");
    const diff = Math.abs(cont371 - stock.totalValSoldFinal);
    if (diff > 1) {
      alerts.push({
        id: `stock-mismatch-${companyId}`,
        severity: "warning",
        titleRo: "Diferen\u021B\u0103 stoc vs cont 371",
        titleEn: "Stock vs account 371 mismatch",
        messageRo: `${companyId.toUpperCase()}: Stoc (${stock.totalValSoldFinal.toLocaleString("ro-RO")}) vs cont 371 (${cont371.toLocaleString("ro-RO")}). Diferen\u021B\u0103: ${diff.toFixed(2)} RON`,
        messageEn: `${companyId.toUpperCase()}: Stock (${stock.totalValSoldFinal.toLocaleString("en-US")}) vs account 371 (${cont371.toLocaleString("en-US")}). Diff: ${diff.toFixed(2)} RON`,
        companyId,
        value: diff,
      });
    } else {
      alerts.push({
        id: `stock-match-${companyId}`,
        severity: "success",
        titleRo: "Stoc reconciliat",
        titleEn: "Stock reconciled",
        messageRo: `${companyId.toUpperCase()}: Balan\u021Ba stocului corespunde cu contul 371`,
        messageEn: `${companyId.toUpperCase()}: Stock balance matches account 371`,
        companyId,
      });
    }
  }

  // --- Dividende de platit ---
  const filatoDividende = getAccountValue(filatoRows, "457", "soldFinalC");
  if (filatoDividende > 0) {
    alerts.push({
      id: "dividende-filato",
      severity: "info",
      titleRo: "Dividende de pl\u0103tit \u2014 FILATO",
      titleEn: "Dividends payable \u2014 FILATO",
      messageRo: `FILATO are dividende nepl\u0103tite: ${filatoDividende.toLocaleString("ro-RO")} RON`,
      messageEn: `FILATO has unpaid dividends: ${filatoDividende.toLocaleString("en-US")} RON`,
      companyId: "filato",
      value: filatoDividende,
    });
  }

  // --- Large shareholder balance ---
  for (const [companyId, rows] of [
    ["ifp", ifpRows],
    ["filato", filatoRows],
  ] as const) {
    const cont456C = getAccountValue(rows, "456", "soldFinalC");
    if (cont456C > 100000) {
      alerts.push({
        id: `decontari-456-${companyId}`,
        severity: "info",
        titleRo: `Sold mare cont 456 \u2014 ${companyId.toUpperCase()}`,
        titleEn: `Large balance account 456 \u2014 ${companyId.toUpperCase()}`,
        messageRo: `Decontari cu ac\u021Bionari: ${cont456C.toLocaleString("ro-RO")} RON creditoare`,
        messageEn: `Shareholder settlements: ${cont456C.toLocaleString("en-US")} RON credit balance`,
        companyId,
        value: cont456C,
      });
    }
  }

  // --- Profit comparison ---
  const ifpProfit =
    getAccountValue(ifpRows, "121", "soldFinalC") -
    getAccountValue(ifpRows, "121", "soldFinalD");
  const filatoProfit =
    getAccountValue(filatoRows, "121", "soldFinalC") -
    getAccountValue(filatoRows, "121", "soldFinalD");

  if (filatoProfit > ifpProfit * 1.5 && ifpProfit > 0) {
    alerts.push({
      id: "profit-gap",
      severity: "info",
      titleRo: "Diferen\u021B\u0103 mare de profitabilitate",
      titleEn: "Large profitability gap",
      messageRo: `FILATO are profit de ${((filatoProfit / ifpProfit - 1) * 100).toFixed(0)}% mai mare dec\u00E2t IFP`,
      messageEn: `FILATO profit is ${((filatoProfit / ifpProfit - 1) * 100).toFixed(0)}% higher than IFP`,
    });
  }

  return alerts;
}
