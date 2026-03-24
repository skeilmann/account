import type {
  BalantaFormat,
  NormalizedBalantaRow,
  ParsedBalanta,
} from "@/types/balanta";
import type { CompanyId } from "@/types/company";

/**
 * Parse Romanian number format: space as thousands separator, dot as decimal.
 * Examples: "1 083 181.10" -> 1083181.10, "-540.00" -> -540.00
 */
export function parseRomanianNumber(raw: string): number {
  const cleaned = raw.replace(/\s/g, "").trim();
  if (!cleaned || cleaned === "-" || cleaned === "") return 0;
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Extract all number sequences from a line.
 * Matches patterns like "1 083 181.10", "0.00", "-540.00"
 */
export function extractNumbers(line: string): number[] {
  const pattern = /-?(?:\d[\d\s]*\d|\d)\.\d{2}/g;
  const matches = line.match(pattern) || [];
  return matches.map(parseRomanianNumber);
}

/**
 * Detect format from raw PDF text.
 */
export function detectFormat(text: string): BalantaFormat {
  return text.includes("Solduri initiale") ? "ifp_10col" : "filato_8col";
}

/**
 * Detect company from PDF text.
 */
export function detectCompany(text: string): {
  companyId: CompanyId;
  companyName: string;
  companyCui: string;
} {
  if (text.includes("RO47181930") || text.includes("IFP FILATI PREGIATI")) {
    return {
      companyId: "ifp",
      companyName: "IFP FILATI PREGIATI S.R.L.",
      companyCui: "RO47181930",
    };
  }
  return {
    companyId: "filato",
    companyName: "FILATO A MODO TUO S.R.L.",
    companyCui: "RO48445070",
  };
}

function extractPeriod(text: string): {
  periodStart: string;
  periodEnd: string;
} {
  const datePattern = /(\d{2})\.(\d{2})\.(\d{4})/g;
  const dates: string[] = [];
  let match;
  while ((match = datePattern.exec(text)) !== null) {
    dates.push(`${match[3]}-${match[2]}-${match[1]}`);
  }
  return {
    periodStart: dates[0] || "2025-01-01",
    periodEnd: dates[1] || "2025-12-31",
  };
}

function makeRow(
  cont: string,
  denumire: string,
  numbers: number[],
  numCols: 8 | 10,
  flags: { isClassTotal?: boolean; isGrandTotal?: boolean } = {}
): NormalizedBalantaRow {
  const accountClass =
    cont.match(/^\d/) && !flags.isClassTotal && !flags.isGrandTotal
      ? parseInt(cont[0])
      : flags.isClassTotal
        ? parseInt(cont.replace(/\D/g, "") || "0")
        : null;

  if (numCols === 10) {
    // IMPORTANT: pdf-parse extracts IFP columns in non-visual order!
    // Visual order:  SolInit(D,C) | SumePrec(D,C) | Rulaje(D,C) | SumeTot(D,C) | SoldFin(D,C)
    // Text order:    SolInit(D,C) | Rulaje(D,C) | SumeTot(D,C) | SoldFin(D,C) | SumePrec(C,D) <-- reversed!
    return {
      cont,
      denumire,
      soldInitialD: numbers[0] ?? 0,
      soldInitialC: numbers[1] ?? 0,
      sumePrecedenteD: numbers[9] ?? 0,
      sumePrecedenteC: numbers[8] ?? 0,
      rulajePerioadaD: numbers[2] ?? 0,
      rulajePerioadaC: numbers[3] ?? 0,
      sumeTotaleD: numbers[4] ?? 0,
      sumeTotaleC: numbers[5] ?? 0,
      soldFinalD: numbers[6] ?? 0,
      soldFinalC: numbers[7] ?? 0,
      isClassTotal: flags.isClassTotal ?? false,
      isGrandTotal: flags.isGrandTotal ?? false,
      accountClass,
    };
  }
  // 8-col: no Solduri initiale
  return {
    cont,
    denumire,
    soldInitialD: 0,
    soldInitialC: 0,
    sumePrecedenteD: numbers[0] ?? 0,
    sumePrecedenteC: numbers[1] ?? 0,
    rulajePerioadaD: numbers[2] ?? 0,
    rulajePerioadaC: numbers[3] ?? 0,
    sumeTotaleD: numbers[4] ?? 0,
    sumeTotaleC: numbers[5] ?? 0,
    soldFinalD: numbers[6] ?? 0,
    soldFinalC: numbers[7] ?? 0,
    isClassTotal: flags.isClassTotal ?? false,
    isGrandTotal: flags.isGrandTotal ?? false,
    accountClass,
  };
}

/**
 * IFP format: account code prepended to name on same line, then 10 numbers.
 * Example line: "371MARFURI     3 840 691.19  0.00  ...  (10 numbers)"
 */
function parseIFPRows(text: string): NormalizedBalantaRow[] {
  const rows: NormalizedBalantaRow[] = [];
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let i = 0;
  // Skip to first data line (starts with account code)
  while (i < lines.length && !lines[i].match(/^\d{3,4}[A-Z]/)) {
    i++;
  }

  while (i < lines.length) {
    const line = lines[i];

    // Skip noise lines
    if (
      line.startsWith("Pagina") ||
      line.startsWith("Întocmit") ||
      line.startsWith("Conducatorul") ||
      line.startsWith("IFP FILATI") ||
      line.startsWith("PIATRA NEAMT") ||
      line.includes("Balanta de verificare") ||
      line.includes("Solduri initiale") ||
      line.includes("Sume precedente") ||
      line.includes("DebitoareCreditoare") ||
      line.match(/^\d{2}\.\d{2}\.\d{4}/) ||
      line === "--" ||
      line === "ContDenumirea contului"
    ) {
      i++;
      continue;
    }

    // Total sume clasa
    if (line.startsWith("Total sume clasa")) {
      const classMatch = line.match(/clasa\s*(\d)/);
      // Numbers might be on this line or the next
      let numbers = extractNumbers(line);
      if (numbers.length < 10 && i + 1 < lines.length) {
        numbers = numbers.concat(extractNumbers(lines[i + 1]));
        i++;
      }
      if (numbers.length >= 10) {
        rows.push(
          makeRow(
            `Total clasa ${classMatch?.[1] || "?"}`,
            line,
            numbers,
            10,
            { isClassTotal: true }
          )
        );
      }
      i++;
      continue;
    }

    // Grand total — IFP splits it: 8 numbers on one line, "Totaluri:" on next,
    // then 2 more numbers (SumePrec) on the line after
    if (line.includes("Totaluri:")) {
      // "Totaluri:" might have numbers on same line, or numbers were on previous line
      let numbers = extractNumbers(line);
      // Look ahead for remaining numbers
      if (numbers.length < 10 && i + 1 < lines.length) {
        numbers = numbers.concat(extractNumbers(lines[i + 1]));
        i++;
      }
      if (numbers.length >= 10) {
        rows.push(makeRow("TOTAL", "Totaluri", numbers, 10, { isGrandTotal: true }));
      }
      i++;
      continue;
    }
    // Handle case where grand total numbers come BEFORE "Totaluri:" label
    // (IFP: "5 557 343.70  ... 5 906 400.31\nTotaluri:\n21 539 008.75...")
    if (
      i + 1 < lines.length &&
      lines[i + 1].trim() === "Totaluri:" &&
      !line.match(/^\d{3,4}[A-Z]/) &&
      !line.startsWith("Total sume")
    ) {
      let numbers = extractNumbers(line);
      // Skip "Totaluri:" and get remaining numbers
      if (i + 2 < lines.length) {
        numbers = numbers.concat(extractNumbers(lines[i + 2]));
      }
      if (numbers.length >= 10) {
        rows.push(makeRow("TOTAL", "Totaluri", numbers, 10, { isGrandTotal: true }));
        i += 3;
        continue;
      }
    }

    // Account row: starts with 3-4 digit code followed by text
    const accountMatch = line.match(/^(\d{3,4})([A-Z].*)/);
    if (accountMatch) {
      const cont = accountMatch[1];
      const restOfLine = accountMatch[2];

      let numbers = extractNumbers(restOfLine);
      let fullName = restOfLine
        .replace(/-?(?:\d[\d\s]*\d|\d)\.\d{2}/g, "")
        .trim();

      // Collect continuation lines if we don't have enough numbers
      while (numbers.length < 10 && i + 1 < lines.length) {
        i++;
        const nextLine = lines[i];
        if (
          nextLine.match(/^\d{3,4}[A-Z]/) ||
          nextLine.startsWith("Total") ||
          nextLine.startsWith("Totaluri") ||
          nextLine.startsWith("Pagina") ||
          nextLine.startsWith("Întocmit") ||
          nextLine.startsWith("Conducatorul")
        ) {
          i--;
          break;
        }
        const moreNumbers = extractNumbers(nextLine);
        numbers = numbers.concat(moreNumbers);
        const nameText = nextLine
          .replace(/-?(?:\d[\d\s]*\d|\d)\.\d{2}/g, "")
          .trim();
        if (nameText && !nameText.match(/^[\s,.-]*$/)) {
          fullName += " " + nameText;
        }
      }

      if (numbers.length >= 10) {
        rows.push(makeRow(cont, fullName.trim(), numbers, 10));
      }
    }

    i++;
  }

  return rows;
}

/**
 * FILATO format: account name (1+ text lines), then 8 numbers, then account code.
 * Structure per account:
 *   ACCOUNT NAME          (text, may span 2 lines)
 *   1234.56   5678.90...  (8 numbers)
 *   1234                  (account code, 3-4 digits alone)
 *
 * Special: "Totaluri:" may be appended to the end of the last number line.
 * Special: Class totals have numbers on the NEXT line after "Total sume clasaX"
 */
function parseFILATORows(text: string): NormalizedBalantaRow[] {
  const rows: NormalizedBalantaRow[] = [];
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let i = 0;
  // Skip to first data (CAPITAL SUBSCRIS)
  while (i < lines.length && !lines[i].includes("CAPITAL SUBSCRIS")) {
    i++;
  }

  let pendingName = "";

  while (i < lines.length) {
    const line = lines[i];

    // Skip noise
    if (isNoiseLineFILATO(line)) {
      i++;
      continue;
    }

    // Grand total: numbers followed by "Totaluri:" on the same line
    if (line.includes("Totaluri:")) {
      const numbers = extractNumbers(line);
      if (numbers.length >= 8) {
        rows.push(makeRow("TOTAL", "Totaluri", numbers, 8, { isGrandTotal: true }));
      }
      i++;
      continue;
    }

    // Class total: "Total sume clasaX" then numbers on next line
    if (line.startsWith("Total sume clasa")) {
      const classMatch = line.match(/clasa\s*(\d)/);
      let numbers = extractNumbers(line);
      if (numbers.length < 8 && i + 1 < lines.length) {
        numbers = numbers.concat(extractNumbers(lines[i + 1]));
        i++;
      }
      if (numbers.length >= 8) {
        rows.push(
          makeRow(
            `Total clasa ${classMatch?.[1] || "?"}`,
            `Total sume clasa ${classMatch?.[1] || "?"}`,
            numbers,
            8,
            { isClassTotal: true }
          )
        );
      }
      pendingName = "";
      i++;
      continue;
    }

    // Check if this is a pure account code line (3-4 digits only)
    if (line.match(/^\d{3,4}$/) && !line.match(/^\d{2}\.\d{2}/)) {
      // Already handled when we found the number line — just skip
      i++;
      continue;
    }

    // Check if this is a number line (has 8+ numbers)
    const numbers = extractNumbers(line);
    if (numbers.length >= 8) {
      // Look ahead for account code
      let cont = "???";
      if (i + 1 < lines.length && lines[i + 1].trim().match(/^\d{3,4}$/)) {
        cont = lines[i + 1].trim();
        i++; // consume the code line
      }
      rows.push(makeRow(cont, pendingName.trim(), numbers, 8));
      pendingName = "";
      i++;
      continue;
    }

    // Otherwise it's a text line — part of account name
    if (line.length > 0 && numbers.length === 0) {
      pendingName = pendingName ? pendingName + " " + line : line;
    }

    i++;
  }

  return rows;
}

function isNoiseLineFILATO(line: string): boolean {
  return (
    line.startsWith("Pagina") ||
    line.startsWith("Întocmit") ||
    line.startsWith("Conducatorul") ||
    line.startsWith("FILATO A MODO") ||
    line.startsWith("PIATRA NEAMT") ||
    line.includes("Balanta de verificare") ||
    line.includes("Sume precedente") ||
    line.includes("Rulaje perioada") ||
    line.includes("Sume totale") ||
    line.includes("Solduri finale") ||
    line.includes("DebitoareCreditoare") ||
    line === "ContDenumirea contului" ||
    line.match(/^\d{2}\.\d{2}\.\d{4}/) !== null ||
    line === "--"
  );
}

/**
 * Main entry point: parse a Balanta de verificare PDF buffer.
 */
export async function parseBalanta(pdfBuffer: Buffer): Promise<ParsedBalanta> {
  // Import pdf-parse's core lib directly to avoid the test file loading issue
  // (pdf-parse/index.js tries to read a test PDF when module.parent is falsy)
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
  const data = await pdfParse(pdfBuffer);
  const text = data.text;

  const format = detectFormat(text);
  const company = detectCompany(text);
  const period = extractPeriod(text);

  const rows =
    format === "ifp_10col" ? parseIFPRows(text) : parseFILATORows(text);

  return {
    ...company,
    format,
    ...period,
    rows,
    totalRow: rows.find((r) => r.isGrandTotal) || null,
  };
}
