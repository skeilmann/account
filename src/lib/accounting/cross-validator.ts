import type { NormalizedBalantaRow } from "@/types/balanta";
import type { ParsedStock } from "@/types/stock";

export interface ValidationResult {
  ruleCode: string;
  severity: "error" | "warning" | "info";
  messageRo: string;
  messageEn: string;
  expectedValue?: number;
  actualValue?: number;
  difference?: number;
}

/**
 * Validate that the Balanta is balanced (Solduri finale D = C).
 */
export function validateBalantaBalanced(
  rows: NormalizedBalantaRow[]
): ValidationResult | null {
  const total = rows.find((r) => r.isGrandTotal);
  if (!total) {
    return {
      ruleCode: "BALANTA_NO_TOTAL",
      severity: "error",
      messageRo: "Linia de total lipsește din balanță",
      messageEn: "Total row missing from trial balance",
    };
  }

  const diff = Math.abs(total.soldFinalD - total.soldFinalC);
  if (diff > 0.01) {
    return {
      ruleCode: "BALANTA_UNBALANCED",
      severity: "error",
      messageRo: `Balanța nu este echilibrată. Sold final D: ${total.soldFinalD.toLocaleString("ro-RO")}, C: ${total.soldFinalC.toLocaleString("ro-RO")}`,
      messageEn: `Trial balance is not balanced. Final balance D: ${total.soldFinalD.toLocaleString("en-US")}, C: ${total.soldFinalC.toLocaleString("en-US")}`,
      expectedValue: total.soldFinalD,
      actualValue: total.soldFinalC,
      difference: diff,
    };
  }

  return null; // No issue
}

/**
 * Validate stock XLS total matches cont 371 in Balanta.
 */
export function validateStockMatchesCont371(
  rows: NormalizedBalantaRow[],
  stock: ParsedStock
): ValidationResult | null {
  const cont371 = rows.find(
    (r) => r.cont === "371" && !r.isClassTotal && !r.isGrandTotal
  );
  if (!cont371) {
    return {
      ruleCode: "STOCK_NO_371",
      severity: "warning",
      messageRo:
        "Contul 371 (Mărfuri) lipsește din balanța de verificare",
      messageEn: "Account 371 (Merchandise) missing from trial balance",
    };
  }

  const diff = Math.abs(cont371.soldFinalD - stock.totalValSoldFinal);
  if (diff > 1) {
    // Allow 1 RON rounding tolerance
    return {
      ruleCode: "STOCK_371_MISMATCH",
      severity: "warning",
      messageRo: `Valoarea stocului din Balanța stocului (${stock.totalValSoldFinal.toLocaleString("ro-RO")} RON) nu coincide cu contul 371 din Balanță (${cont371.soldFinalD.toLocaleString("ro-RO")} RON)`,
      messageEn: `Stock balance total (${stock.totalValSoldFinal.toLocaleString("en-US")} RON) doesn't match account 371 in trial balance (${cont371.soldFinalD.toLocaleString("en-US")} RON)`,
      expectedValue: cont371.soldFinalD,
      actualValue: stock.totalValSoldFinal,
      difference: diff,
    };
  }

  return null;
}

/**
 * Validate that class 6 and 7 accounts have 0 sold final (closed at year-end).
 */
export function validateExpenseRevenueCleared(
  rows: NormalizedBalantaRow[]
): ValidationResult[] {
  const results: ValidationResult[] = [];

  const unclosed = rows.filter(
    (r) =>
      !r.isClassTotal &&
      !r.isGrandTotal &&
      (r.accountClass === 6 || r.accountClass === 7) &&
      (Math.abs(r.soldFinalD) > 0.01 || Math.abs(r.soldFinalC) > 0.01)
  );

  for (const row of unclosed) {
    results.push({
      ruleCode: "ACCOUNT_NOT_CLOSED",
      severity: "warning",
      messageRo: `Contul ${row.cont} (${row.denumire}) nu este închis la final de an. Sold final: D=${row.soldFinalD}, C=${row.soldFinalC}`,
      messageEn: `Account ${row.cont} (${row.denumire}) not closed at year-end. Final balance: D=${row.soldFinalD}, C=${row.soldFinalC}`,
    });
  }

  return results;
}

/**
 * Run all validation checks.
 */
export function runAllValidations(
  rows: NormalizedBalantaRow[],
  stock?: ParsedStock
): ValidationResult[] {
  const results: ValidationResult[] = [];

  const balanceCheck = validateBalantaBalanced(rows);
  if (balanceCheck) results.push(balanceCheck);

  if (stock) {
    const stockCheck = validateStockMatchesCont371(rows, stock);
    if (stockCheck) results.push(stockCheck);
  }

  results.push(...validateExpenseRevenueCleared(rows));

  return results;
}
