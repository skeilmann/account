import type { CompanyId } from "@/types/company";
import type { ParsedStock, StockRow } from "@/types/stock";
import * as XLSX from "xlsx";

/**
 * Parse a Balanta Stocului XLS file.
 *
 * Expected structure (from SAGA C):
 * Row 0: Company name
 * Row 1: CIF + address
 * Row 2: empty
 * Row 3: "Balanta stocului"
 * Row 4: "Perioada: 01/01/2025 - 31/12/2025"
 * Row 5-7: Gestiune/filter info
 * Row 8: Group headers ("Cantitati" / "Valori")
 * Row 9: Column headers (Gestiune, Produs, U.M., Stoc initial, Intrari, Iesiri, Stoc final, Sold initial, Intrari, Iesiri, Sold final)
 * Row 10+: Data rows
 * Last data row before blank: "Total" row
 */
export function parseStock(buffer: ArrayBuffer): ParsedStock {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data: (string | number)[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
  });

  // Extract company info from rows 0-1
  const companyName = String(data[0]?.[0] || "").trim();
  const cifLine = String(data[1]?.[0] || "");

  let companyId: CompanyId = "filato";
  let companyCui = "RO48445070";
  if (
    companyName.includes("IFP") ||
    cifLine.includes("RO47181930")
  ) {
    companyId = "ifp";
    companyCui = "RO47181930";
  } else if (cifLine.includes("RO48445070")) {
    companyCui = "RO48445070";
  }

  // Extract period from row 4
  const periodLine = String(data[4]?.[0] || "");
  const periodMatch = periodLine.match(
    /(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(\d{2})\/(\d{2})\/(\d{4})/
  );
  const periodStart = periodMatch
    ? `${periodMatch[3]}-${periodMatch[2]}-${periodMatch[1]}`
    : "2025-01-01";
  const periodEnd = periodMatch
    ? `${periodMatch[6]}-${periodMatch[5]}-${periodMatch[4]}`
    : "2025-12-31";

  // Parse data rows (starting at row 10, column headers at row 9)
  const rows: StockRow[] = [];
  let totalValSoldInitial = 0;
  let totalValIntrari = 0;
  let totalValIesiri = 0;
  let totalValSoldFinal = 0;

  for (let r = 10; r < data.length; r++) {
    const row = data[r];
    if (!row || row.length === 0) continue;

    const gestiune = String(row[0] || "").trim();
    const produs = String(row[1] || "").trim();

    // Skip empty rows and the "Total" summary row
    if (!produs && gestiune !== "Total") continue;

    if (gestiune === "Total") {
      // Extract totals from the Total row
      totalValSoldInitial = toNum(row[7]);
      totalValIntrari = toNum(row[8]);
      totalValIesiri = toNum(row[9]);
      totalValSoldFinal = toNum(row[10]);
      continue;
    }

    rows.push({
      gestiune,
      produs,
      um: String(row[2] || "").trim(),
      cantStocInitial: toNum(row[3]),
      cantIntrari: toNum(row[4]),
      cantIesiri: toNum(row[5]),
      cantStocFinal: toNum(row[6]),
      valSoldInitial: toNum(row[7]),
      valIntrari: toNum(row[8]),
      valIesiri: toNum(row[9]),
      valSoldFinal: toNum(row[10]),
    });
  }

  return {
    companyId,
    companyName,
    companyCui,
    periodStart,
    periodEnd,
    rows,
    totalValSoldInitial,
    totalValIntrari,
    totalValIesiri,
    totalValSoldFinal,
  };
}

function toNum(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const cleaned = val.replace(/\s/g, "").replace(",", ".");
    return parseFloat(cleaned) || 0;
  }
  return 0;
}
