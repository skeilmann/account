import type {
  DetailedAccountEntry,
  ParsedBalantaDetaliata,
} from "@/types/balanta-detaliata";
import {
  extractNumbers,
  detectCompany,
} from "./balanta-parser";

/**
 * Check if a line is noise/header that should be skipped.
 */
function isNoiseLine(line: string): boolean {
  return (
    line.startsWith("Pagina") ||
    line.startsWith("Întocmit") ||
    line.startsWith("Conducatorul") ||
    line.startsWith("IFP FILATI") ||
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
 * Extract period dates from PDF text.
 */
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

/**
 * Match a dotted sub-account code on its own line.
 * Examples: "401.00001", "214.1", "2813.2", "462.15"
 */
const SUB_ACCOUNT_LINE_REGEX = /^(\d{3,4})\.(\d+)$/;

/**
 * Parse detailed trial balance text.
 *
 * The SAGA C detailed PDF extracts as (FILATO-style layout):
 *   NAME LINE 1           (text, may span multiple lines)
 *   NAME LINE 2           (continuation of name)
 *   1234.56  5678.90 ...  (8 numbers on one line)
 *   401.00001              (dotted sub-account code on its own line)
 *
 * We accumulate text as pendingName, detect number lines (8+ numbers),
 * then look ahead for the dotted code line.
 */
function parseDetailedEntries(text: string): DetailedAccountEntry[] {
  const entries: DetailedAccountEntry[] = [];
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let i = 0;
  let pendingName = "";

  while (i < lines.length) {
    const line = lines[i];

    // Skip noise
    if (isNoiseLine(line)) {
      i++;
      continue;
    }

    // Skip class totals and grand totals
    if (line.startsWith("Total sume clasa") || line.includes("Totaluri:")) {
      pendingName = "";
      i++;
      continue;
    }

    // If this line is a standalone dotted code (already consumed by look-ahead), skip
    if (SUB_ACCOUNT_LINE_REGEX.test(line)) {
      i++;
      continue;
    }

    // If this line is a standalone parent code (3-4 digits only), skip
    if (line.match(/^\d{3,4}$/) && !line.match(/^\d{2}\.\d{2}/)) {
      pendingName = "";
      i++;
      continue;
    }

    // Check if this is a number line (has 8+ numbers)
    const numbers = extractNumbers(line);
    if (numbers.length >= 8) {
      // Look ahead for dotted sub-account code
      if (i + 1 < lines.length && SUB_ACCOUNT_LINE_REGEX.test(lines[i + 1].trim())) {
        const codeLine = lines[i + 1].trim();
        const codeMatch = codeLine.match(SUB_ACCOUNT_LINE_REGEX)!;
        const fullCode = codeLine; // e.g. "401.00001"
        const parentCont = codeMatch[1]; // e.g. "401"

        entries.push({
          cont: fullCode,
          parentCont,
          denumire: pendingName.trim(),
          sumePrecedenteD: numbers[0] ?? 0,
          sumePrecedenteC: numbers[1] ?? 0,
          rulajePerioadaD: numbers[2] ?? 0,
          rulajePerioadaC: numbers[3] ?? 0,
          sumeTotaleD: numbers[4] ?? 0,
          sumeTotaleC: numbers[5] ?? 0,
          soldFinalD: numbers[6] ?? 0,
          soldFinalC: numbers[7] ?? 0,
        });

        i += 2; // skip number line + code line
        pendingName = "";
        continue;
      }

      // Number line without a dotted code after it = parent account row, skip
      pendingName = "";
      i++;
      continue;
    }

    // Otherwise it's a text line — part of the account name
    if (numbers.length === 0 && line.length > 0) {
      pendingName = pendingName ? pendingName + " " + line : line;
    }

    i++;
  }

  return entries;
}

/**
 * Build the byParent lookup map from entries.
 */
function groupByParent(
  entries: DetailedAccountEntry[]
): Record<string, DetailedAccountEntry[]> {
  const map: Record<string, DetailedAccountEntry[]> = {};
  for (const entry of entries) {
    if (!map[entry.parentCont]) {
      map[entry.parentCont] = [];
    }
    map[entry.parentCont].push(entry);
  }
  return map;
}

/**
 * Detect if a PDF text represents a detailed trial balance.
 * Detailed PDFs have dotted sub-account codes (e.g., "401.00001") on standalone lines.
 */
export function isDetailedBalanta(text: string): boolean {
  const lines = text.split("\n");
  let subAccountCount = 0;
  for (const line of lines) {
    if (SUB_ACCOUNT_LINE_REGEX.test(line.trim())) {
      subAccountCount++;
      if (subAccountCount >= 3) return true;
    }
  }
  return false;
}

/**
 * Main entry point: parse a detailed Balanta de verificare PDF buffer.
 */
export async function parseBalantaDetaliata(
  pdfBuffer: Buffer
): Promise<ParsedBalantaDetaliata> {
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
  const data = await pdfParse(pdfBuffer);
  const text = data.text;

  const company = detectCompany(text);
  const period = extractPeriod(text);
  const entries = parseDetailedEntries(text);

  return {
    companyId: company.companyId,
    companyName: company.companyName,
    ...period,
    entries,
    byParent: groupByParent(entries),
  };
}
