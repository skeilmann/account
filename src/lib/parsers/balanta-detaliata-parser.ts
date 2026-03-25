import type { CompanyId } from "@/types/company";
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
 * Match a dotted sub-account code at the start of a line.
 * Examples: "401.00001", "214.1", "2813.2", "462.15"
 * Does NOT match pure parent accounts like "401" or "4111".
 */
const SUB_ACCOUNT_REGEX = /^(\d{3,4})\.(\d+)/;

/**
 * Match a parent account code (3-4 digits optionally followed by uppercase text).
 */
const PARENT_ACCOUNT_REGEX = /^(\d{3,4})([A-Z]|$)/;

/**
 * Parse the IFP detailed PDF (8-column format with dotted sub-accounts).
 * The IFP detailed format has lines like:
 *   "401.00001CAZACU A. GHEORGHE... 77 125.00  77 125.00  ..."
 * or multi-line where name wraps.
 */
function parseIFPDetailed(text: string): DetailedAccountEntry[] {
  const entries: DetailedAccountEntry[] = [];
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (isNoiseLine(line)) {
      i++;
      continue;
    }

    // Skip class totals, grand totals
    if (line.startsWith("Total sume clasa") || line.includes("Totaluri:")) {
      i++;
      continue;
    }

    // Try to match a dotted sub-account code
    const subMatch = line.match(SUB_ACCOUNT_REGEX);
    if (subMatch) {
      const fullCode = subMatch[0]; // e.g. "401.00001"
      const parentCont = subMatch[1]; // e.g. "401"
      const restOfLine = line.slice(fullCode.length);

      let numbers = extractNumbers(restOfLine);
      let nameText = restOfLine
        .replace(/-?(?:\d[\d\s]*\d|\d)\.\d{2}/g, "")
        .trim();

      // Collect continuation lines if we don't have 8 numbers
      while (numbers.length < 8 && i + 1 < lines.length) {
        i++;
        const nextLine = lines[i];
        if (
          nextLine.match(SUB_ACCOUNT_REGEX) ||
          nextLine.match(PARENT_ACCOUNT_REGEX) ||
          nextLine.startsWith("Total") ||
          nextLine.includes("Totaluri:") ||
          isNoiseLine(nextLine)
        ) {
          i--;
          break;
        }
        const moreNumbers = extractNumbers(nextLine);
        numbers = numbers.concat(moreNumbers);
        const moreText = nextLine
          .replace(/-?(?:\d[\d\s]*\d|\d)\.\d{2}/g, "")
          .trim();
        if (moreText && !moreText.match(/^[\s,.-]*$/)) {
          nameText += " " + moreText;
        }
      }

      if (numbers.length >= 8) {
        entries.push({
          cont: fullCode,
          parentCont,
          denumire: nameText.trim(),
          sumePrecedenteD: numbers[0] ?? 0,
          sumePrecedenteC: numbers[1] ?? 0,
          rulajePerioadaD: numbers[2] ?? 0,
          rulajePerioadaC: numbers[3] ?? 0,
          sumeTotaleD: numbers[4] ?? 0,
          sumeTotaleC: numbers[5] ?? 0,
          soldFinalD: numbers[6] ?? 0,
          soldFinalC: numbers[7] ?? 0,
        });
      }

      i++;
      continue;
    }

    // Skip parent account lines and other text
    i++;
  }

  return entries;
}

/**
 * Parse the FILATO detailed PDF.
 * FILATO's "detailed" PDF has the same structure as its summary — no sub-accounts.
 * Returns empty entries array.
 */
function parseFILATODetailed(text: string): DetailedAccountEntry[] {
  // Check if there are any dotted sub-accounts
  const lines = text.split("\n");
  const hasSubAccounts = lines.some((l) => SUB_ACCOUNT_REGEX.test(l.trim()));

  if (!hasSubAccounts) {
    return [];
  }

  // If FILATO ever gets sub-accounts, parse them the same way
  return parseIFPDetailed(text);
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
 * Detailed PDFs have dotted sub-account codes (e.g., "401.00001").
 */
export function isDetailedBalanta(text: string): boolean {
  const lines = text.split("\n");
  let subAccountCount = 0;
  for (const line of lines) {
    if (SUB_ACCOUNT_REGEX.test(line.trim())) {
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

  const entries =
    company.companyId === "ifp"
      ? parseIFPDetailed(text)
      : parseFILATODetailed(text);

  return {
    companyId: company.companyId,
    companyName: company.companyName,
    ...period,
    entries,
    byParent: groupByParent(entries),
  };
}
