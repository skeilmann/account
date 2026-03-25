/**
 * Script to parse detailed trial balance PDFs and generate preloaded JSON.
 * Run: node scripts/generate-detaliata.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PROJECT_ROOT = join(ROOT, "..");

// ---- Inline parser utilities (avoid TS import issues) ----

function parseRomanianNumber(raw) {
  const cleaned = raw.replace(/\s/g, "").trim();
  if (!cleaned || cleaned === "-" || cleaned === "") return 0;
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function extractNumbers(line) {
  const pattern = /-?(?:\d[\d\s]*\d|\d)\.\d{2}/g;
  const matches = line.match(pattern) || [];
  return matches.map(parseRomanianNumber);
}

const SUB_ACCOUNT_LINE_REGEX = /^(\d{3,4})\.(\d+)$/;

function isNoiseLine(line) {
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
    /^\d{2}\.\d{2}\.\d{4}/.test(line) ||
    line === "--"
  );
}

/**
 * Parse detailed entries using FILATO-style layout:
 *   NAME (text, may span lines)
 *   NUMBERS (8 values on one line)
 *   CODE (dotted sub-account code on its own line, e.g., "401.00001")
 */
function parseDetailedEntries(text) {
  const entries = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  let i = 0;
  let pendingName = "";

  while (i < lines.length) {
    const line = lines[i];

    if (isNoiseLine(line)) { i++; continue; }
    if (line.startsWith("Total sume clasa") || line.includes("Totaluri:")) {
      pendingName = "";
      i++;
      continue;
    }

    // Skip standalone dotted codes (already consumed by look-ahead)
    if (SUB_ACCOUNT_LINE_REGEX.test(line)) { i++; continue; }

    // Skip standalone parent codes
    if (/^\d{3,4}$/.test(line) && !/^\d{2}\.\d{2}/.test(line)) {
      pendingName = "";
      i++;
      continue;
    }

    const numbers = extractNumbers(line);
    if (numbers.length >= 8) {
      // Look ahead for dotted sub-account code
      if (i + 1 < lines.length && SUB_ACCOUNT_LINE_REGEX.test(lines[i + 1].trim())) {
        const codeLine = lines[i + 1].trim();
        const codeMatch = codeLine.match(SUB_ACCOUNT_LINE_REGEX);
        const parentCont = codeMatch[1];

        entries.push({
          cont: codeLine,
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

        i += 2;
        pendingName = "";
        continue;
      }

      // Parent account number line, skip
      pendingName = "";
      i++;
      continue;
    }

    // Text line — accumulate as name
    if (numbers.length === 0 && line.length > 0) {
      pendingName = pendingName ? pendingName + " " + line : line;
    }

    i++;
  }

  return entries;
}

function groupByParent(entries) {
  const map = {};
  for (const entry of entries) {
    if (!map[entry.parentCont]) map[entry.parentCont] = [];
    map[entry.parentCont].push(entry);
  }
  return map;
}

function extractPeriod(text) {
  const datePattern = /(\d{2})\.(\d{2})\.(\d{4})/g;
  const dates = [];
  let match;
  while ((match = datePattern.exec(text)) !== null) {
    dates.push(`${match[3]}-${match[2]}-${match[1]}`);
  }
  return {
    periodStart: dates[0] || "2025-01-01",
    periodEnd: dates[1] || "2025-12-31",
  };
}

// ---- Main ----
async function main() {
  const pdfParse = (await import("pdf-parse")).default;

  // Parse IFP detailed
  const ifpPath = join(PROJECT_ROOT, "balanta_de_verificare_DET-IFP.pdf");
  const ifpBuffer = readFileSync(ifpPath);
  const ifpData = await pdfParse(ifpBuffer);
  const ifpText = ifpData.text;
  const ifpPeriod = extractPeriod(ifpText);
  const ifpEntries = parseDetailedEntries(ifpText);
  const ifpByParent = groupByParent(ifpEntries);

  console.log(`IFP: parsed ${ifpEntries.length} sub-account entries`);
  for (const [parent, children] of Object.entries(ifpByParent)) {
    console.log(`  ${parent}: ${children.length} sub-accounts`);
  }

  // Parse FILATO detailed
  const filatoPath = join(PROJECT_ROOT, "balanta_de_verificare_DET-FILATO.pdf");
  const filatoBuffer = readFileSync(filatoPath);
  const filatoData = await pdfParse(filatoBuffer);
  const filatoText = filatoData.text;
  const filatoEntries = parseDetailedEntries(filatoText);

  console.log(`FILATO: parsed ${filatoEntries.length} sub-account entries`);

  const result = {
    ifp: {
      companyId: "ifp",
      companyName: "IFP FILATI PREGIATI S.R.L.",
      ...ifpPeriod,
      entries: ifpEntries,
      byParent: ifpByParent,
    },
    filato: filatoEntries.length > 0
      ? {
          companyId: "filato",
          companyName: "FILATO A MODO TUO S.R.L.",
          ...extractPeriod(filatoText),
          entries: filatoEntries,
          byParent: groupByParent(filatoEntries),
        }
      : null,
  };

  const outPath = join(ROOT, "src/data/preloaded-detaliata.json");
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\nWritten to ${outPath}`);
}

main().catch(console.error);
