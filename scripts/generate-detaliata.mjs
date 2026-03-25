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

const SUB_ACCOUNT_REGEX = /^(\d{3,4})\.(\d+)/;
const PARENT_ACCOUNT_REGEX = /^(\d{3,4})([A-Z]|$)/;

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

function parseDetailed(text) {
  const entries = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (isNoiseLine(line) || line.startsWith("Total sume clasa") || line.includes("Totaluri:")) {
      i++;
      continue;
    }

    const subMatch = line.match(SUB_ACCOUNT_REGEX);
    if (subMatch) {
      const fullCode = subMatch[0];
      const parentCont = subMatch[1];
      const restOfLine = line.slice(fullCode.length);

      let numbers = extractNumbers(restOfLine);
      let nameText = restOfLine.replace(/-?(?:\d[\d\s]*\d|\d)\.\d{2}/g, "").trim();

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
        numbers = numbers.concat(extractNumbers(nextLine));
        const moreText = nextLine.replace(/-?(?:\d[\d\s]*\d|\d)\.\d{2}/g, "").trim();
        if (moreText && !/^[\s,.-]*$/.test(moreText)) {
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

    i++;
  }

  return entries;
}

function groupByParent(entries) {
  const map = {};
  for (const entry of entries) {
    if (!map[entry.parentCont]) {
      map[entry.parentCont] = [];
    }
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
  const ifpEntries = parseDetailed(ifpText);

  console.log(`IFP: parsed ${ifpEntries.length} sub-account entries`);

  // Show parent grouping stats
  const ifpByParent = groupByParent(ifpEntries);
  for (const [parent, children] of Object.entries(ifpByParent)) {
    console.log(`  ${parent}: ${children.length} sub-accounts`);
  }

  // Parse FILATO detailed
  const filatoPath = join(PROJECT_ROOT, "balanta_de_verificare_DET-FILATO.pdf");
  const filatoBuffer = readFileSync(filatoPath);
  const filatoData = await pdfParse(filatoBuffer);
  const filatoText = filatoData.text;
  const filatoEntries = parseDetailed(filatoText);

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
