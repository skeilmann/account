/**
 * Script to parse 2024 CIEL Conta Balanta Analitica PDFs and generate preloaded JSON.
 * Run: node scripts/generate-2024.mjs
 *
 * CIEL format (8-col): Rulaj Precedent D/C, Rulaj Curent D/C, Total Sume D/C, Sold Final D/C
 * pdf-parse extracts numbers in a non-visual order for individual accounts:
 *   Before code: SoldFinalC, RulajPrecD, RulajPrecC, RulajCurentD
 *   After name:  RulajCurentC, TotalSumeD, TotalSumeC, SoldFinalD
 * But class totals have all 8 in normal order: RulajPrecD/C, RulajCurentD/C, TotalSumeD/C, SoldFinalD/C
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PROJECT_ROOT = join(ROOT, "..");

// ---- Parser utilities (CIEL-aware: commas as thousands) ----

function parseNumber(raw) {
  const cleaned = raw.replace(/[\s,]/g, "").trim();
  if (!cleaned || cleaned === "-" || cleaned === "") return 0;
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function extractNumbers(line) {
  const pattern = /-?(?:\d[\d,\s]*\d|\d)\.\d{2}/g;
  const matches = line.match(pattern) || [];
  return matches.map(parseNumber);
}

function isNoiseLine(line) {
  return (
    line === "" ||
    line.startsWith("DebitorCreditor") ||
    line.startsWith("Rulaj Precedent") ||
    line.startsWith("Rulaj Curent") ||
    line === "Creditor" ||
    line === "Debitor" ||
    line.startsWith("Sold Final") ||
    line.startsWith("Titlu Cont") ||
    line.startsWith("Balanta de verificare") ||
    line.startsWith("CIEL Conta") ||
    line.startsWith("Intocmit") ||
    line.startsWith("Conducatorul") ||
    line.startsWith("Director") ||
    line === "/" ||
    /^\d+$/.test(line) // standalone page numbers like "11"
  );
}

/**
 * Detect account code embedded at end of a number line.
 * CIEL concatenates: "1,928,451.72294,701.33121" → numbers + code "121"
 * After extracting all decimal numbers, the remaining suffix is the code.
 */
function extractCodeFromLine(line) {
  // Remove all decimal numbers from line
  const withoutNumbers = line.replace(/-?(?:\d[\d,\s]*\d|\d)\.\d{2}/g, "").trim();
  // Check if remaining is an account code (alphanumeric, 3+ chars, starts with digit)
  if (withoutNumbers && /^\d{3,4}/.test(withoutNumbers)) {
    return withoutNumbers;
  }
  return null;
}

function makeRow(cont, denumire, nums8) {
  // nums8 is in normal order: RulajPrecD, RulajPrecC, RulajCurentD, RulajCurentC, TotalSumeD, TotalSumeC, SoldFinalD, SoldFinalC
  const accountClass =
    cont.match(/^\d/) ? parseInt(cont[0]) : null;

  return {
    cont,
    denumire,
    soldInitialD: 0,
    soldInitialC: 0,
    sumePrecedenteD: nums8[0] ?? 0,
    sumePrecedenteC: nums8[1] ?? 0,
    rulajePerioadaD: nums8[2] ?? 0,
    rulajePerioadaC: nums8[3] ?? 0,
    sumeTotaleD: nums8[4] ?? 0,
    sumeTotaleC: nums8[5] ?? 0,
    soldFinalD: nums8[6] ?? 0,
    soldFinalC: nums8[7] ?? 0,
    isClassTotal: false,
    isGrandTotal: false,
    accountClass,
  };
}

function parseCIELBalanta(text) {
  const rows = [];
  const lines = text.split("\n").map((l) => l.trim());

  // Accumulate numbers and detect accounts
  let numberBuffer = []; // numbers collected before finding a code
  let pendingCode = null;
  let pendingName = "";

  let i = 0;
  // Skip to first data line
  while (i < lines.length) {
    const line = lines[i];
    if (line.includes("CAPITAL SUBSCRIS")) break;
    // But if we find a code line before that, also break
    if (extractCodeFromLine(line) && extractNumbers(line).length > 0) break;
    i++;
  }
  // Back up to find the numbers before the first code
  while (i > 0 && !isNoiseLine(lines[i - 1]) && !lines[i - 1].includes("temporare")) {
    i--;
  }

  while (i < lines.length) {
    const line = lines[i];

    // Skip noise lines
    if (isNoiseLine(line)) {
      i++;
      continue;
    }

    // TOTAL BALANTA (grand total)
    if (line.startsWith("TOTAL BALANTA")) {
      const nums = extractNumbers(line);
      if (nums.length >= 8) {
        const row = makeRow("TOTAL", "TOTAL BALANTA", nums);
        row.isGrandTotal = true;
        row.accountClass = null;
        rows.push(row);
      }
      i++;
      continue;
    }

    // TOTAL CLASA line
    if (line.startsWith("TOTAL CLASA")) {
      const nums = extractNumbers(line);
      const classMatch = line.match(/TOTAL CLASA(\d)/);
      if (nums.length >= 8 && classMatch) {
        const row = makeRow(
          `Total clasa ${classMatch[1]}`,
          line.split(/\d{1,3}(?:,\d{3})*\.\d{2}/)[0].trim() || `Total clasa ${classMatch[1]}`,
          nums
        );
        row.isClassTotal = true;
        row.accountClass = parseInt(classMatch[1]);
        rows.push(row);
      }
      // Reset buffer
      numberBuffer = [];
      pendingCode = null;
      pendingName = "";
      i++;
      continue;
    }

    // Total subclasa line — all 8 numbers in normal order
    if (line.includes("Total subclasa")) {
      const nums = extractNumbers(line);
      // Extract subclass code from pattern "XX - NAME...Total subclasa"
      const subMatch = line.match(/^(\d{2})\s*-\s*/);
      if (nums.length >= 8 && subMatch) {
        const row = makeRow(
          `Total subclasa ${subMatch[1]}`,
          line,
          nums
        );
        row.isClassTotal = true;
        // Account class from first digit of subclass
        row.accountClass = parseInt(subMatch[1][0]);
        rows.push(row);
      }
      // Reset buffer
      numberBuffer = [];
      pendingCode = null;
      pendingName = "";
      i++;
      continue;
    }

    // Check if this line has numbers and/or a code
    const lineNums = extractNumbers(line);
    const code = extractCodeFromLine(line);

    if (pendingCode !== null) {
      // We already found a code, now collecting the name and remaining numbers
      if (lineNums.length >= 4) {
        // This is the "after name" numbers line
        const afterNums = lineNums;
        // But first, append any text part as name
        const textPart = line.replace(/-?(?:\d[\d,\s]*\d|\d)\.\d{2}/g, "").trim();
        if (textPart && !textPart.match(/^\s*$/)) {
          pendingName = pendingName ? pendingName + " " + textPart : textPart;
        }

        // Reconstruct 8 numbers in normal order from before[4] + after[4]
        // Before code (last 4 of buffer): SoldFinalC, RulajPrecD, RulajPrecC, RulajCurentD
        // After name: RulajCurentC, TotalSumeD, TotalSumeC, SoldFinalD
        const beforeNums = numberBuffer.slice(-4);
        while (beforeNums.length < 4) beforeNums.unshift(0);

        const nums8 = [
          beforeNums[1], // RulajPrecD
          beforeNums[2], // RulajPrecC
          beforeNums[3], // RulajCurentD
          afterNums[0],  // RulajCurentC
          afterNums[1],  // TotalSumeD
          afterNums[2],  // TotalSumeC
          afterNums[3],  // SoldFinalD
          beforeNums[0], // SoldFinalC
        ];

        rows.push(makeRow(pendingCode, pendingName.trim(), nums8));

        // Reset
        numberBuffer = [];
        pendingCode = null;
        pendingName = "";
      } else if (lineNums.length > 0 && lineNums.length < 4) {
        // Partial numbers — could be continuation of after-name numbers
        // Or could be start of next account's before-code numbers
        // Check if next line might have the rest
        const textPart = line.replace(/-?(?:\d[\d,\s]*\d|\d)\.\d{2}/g, "").trim();
        if (textPart) {
          pendingName = pendingName ? pendingName + " " + textPart : textPart;
        }
        // Accumulate these numbers and check if we can complete
        const afterAccum = lineNums;
        // Peek ahead for more numbers
        if (i + 1 < lines.length) {
          const nextNums = extractNumbers(lines[i + 1]);
          const nextCode = extractCodeFromLine(lines[i + 1]);
          if (nextCode === null && nextNums.length > 0 && !lines[i + 1].includes("Total") && !lines[i + 1].startsWith("TOTAL")) {
            // More numbers on next line, combine
            afterAccum.push(...nextNums);
            i++;
          }
        }
        if (afterAccum.length >= 4) {
          const beforeNums = numberBuffer.slice(-4);
          while (beforeNums.length < 4) beforeNums.unshift(0);
          const nums8 = [
            beforeNums[1], beforeNums[2], beforeNums[3],
            afterAccum[0], afterAccum[1], afterAccum[2], afterAccum[3],
            beforeNums[0],
          ];
          rows.push(makeRow(pendingCode, pendingName.trim(), nums8));
          numberBuffer = [];
          pendingCode = null;
          pendingName = "";
        }
      } else {
        // Pure text line — accumulate as name
        if (line.length > 0) {
          pendingName = pendingName ? pendingName + " " + line : line;
        }
      }
    } else if (code) {
      // Found a code on this line
      pendingCode = code;
      // The numbers on this line go into buffer (they're before-code numbers)
      numberBuffer.push(...lineNums);
      pendingName = "";
    } else if (lineNums.length > 0) {
      // Just numbers, no code yet — accumulate in buffer
      numberBuffer.push(...lineNums);
    } else {
      // Pure text line — this is the account name following a code
      if (line.length > 0 && pendingCode !== null) {
        pendingName = pendingName ? pendingName + " " + line : line;
      } else if (line.length > 0) {
        // Text before we've found a code — might be name for next account
        pendingName = pendingName ? pendingName + " " + line : line;
      }
    }

    i++;
  }

  return rows;
}

function detectCompany(text) {
  if (text.includes("47181930") || text.includes("IFP FILATI")) {
    return { companyId: "ifp", companyName: "IFP FILATI PREGIATI S.R.L.", companyCui: "RO47181930" };
  }
  return { companyId: "filato", companyName: "FILATO A MODO TUO S.R.L.", companyCui: "RO48445070" };
}

function extractPeriod(text) {
  // CIEL uses DD.MM.YY format: "01.12.24  la  31.12.24"
  const pattern2d = /(\d{2})\.(\d{2})\.(\d{2})\s+la\s+(\d{2})\.(\d{2})\.(\d{2})/;
  const m2 = text.match(pattern2d);
  if (m2) {
    const y1 = parseInt(m2[3]) + 2000;
    const y2 = parseInt(m2[6]) + 2000;
    return {
      periodStart: `${y1}-${m2[2]}-${m2[1]}`,
      periodEnd: `${y2}-${m2[5]}-${m2[4]}`,
    };
  }
  // Fallback: DD.MM.YYYY
  const pattern4d = /(\d{2})\.(\d{2})\.(\d{4})/g;
  const dates = [];
  let match;
  while ((match = pattern4d.exec(text)) !== null) {
    dates.push(`${match[3]}-${match[2]}-${match[1]}`);
  }
  return { periodStart: dates[0] || "2024-01-01", periodEnd: dates[1] || "2024-12-31" };
}

// ---- Main ----
async function main() {
  const pdfParse = (await import("pdf-parse")).default;

  // Parse IFP 2024
  const ifpPath = join(PROJECT_ROOT, "BALANTA IFP 31.12.2024.pdf");
  const ifpBuffer = readFileSync(ifpPath);
  const ifpData = await pdfParse(ifpBuffer);
  const ifpText = ifpData.text;
  const ifpCompany = detectCompany(ifpText);
  const ifpPeriod = extractPeriod(ifpText);
  const ifpRows = parseCIELBalanta(ifpText);

  console.log(`IFP 2024: parsed ${ifpRows.length} rows`);
  console.log(`  Period: ${ifpPeriod.periodStart} to ${ifpPeriod.periodEnd}`);

  // Validate with known values from Bilant F10
  const ifp121 = ifpRows.find((r) => r.cont === "121");
  const ifp371 = ifpRows.find((r) => r.cont === "371");
  const ifp5121 = ifpRows.find((r) => r.cont === "5121BT");
  const ifp5124 = ifpRows.find((r) => r.cont === "5124BT");
  const ifp5311 = ifpRows.find((r) => r.cont === "5311");
  const ifpClass6 = ifpRows.find((r) => r.isClassTotal && r.cont === "Total clasa 6");
  const ifpClass7 = ifpRows.find((r) => r.isClassTotal && r.cont === "Total clasa 7");

  console.log(`  ct.121 Profit: SoldFinalC=${ifp121?.soldFinalC} (expected ~553,497.83)`);
  console.log(`  ct.371 Stock:  SoldFinalD=${ifp371?.soldFinalD}`);
  console.log(`  ct.5121 Bank:  SoldFinalD=${ifp5121?.soldFinalD}`);
  console.log(`  ct.5124 EUR:   SoldFinalD=${ifp5124?.soldFinalD}`);
  console.log(`  ct.5311 Cash:  SoldFinalD=${ifp5311?.soldFinalD}`);
  console.log(`  Class 6 Total: SumeTotaleD=${ifpClass6?.sumeTotaleD} (expenses)`);
  console.log(`  Class 7 Total: SumeTotaleC=${ifpClass7?.sumeTotaleC} (revenue)`);

  // Parse FILATO 2024
  const filatoPath = join(PROJECT_ROOT, "BALANTA FILATO 31.12.2024.pdf");
  const filatoBuffer = readFileSync(filatoPath);
  const filatoData = await pdfParse(filatoBuffer);
  const filatoText = filatoData.text;
  const filatoCompany = detectCompany(filatoText);
  const filatoPeriod = extractPeriod(filatoText);
  const filatoRows = parseCIELBalanta(filatoText);

  console.log(`\nFILATO 2024: parsed ${filatoRows.length} rows`);
  console.log(`  Period: ${filatoPeriod.periodStart} to ${filatoPeriod.periodEnd}`);

  const filato121 = filatoRows.find((r) => r.cont === "121");
  const filato371 = filatoRows.find((r) => r.cont === "371");
  const filatoClass6 = filatoRows.find((r) => r.isClassTotal && r.cont === "Total clasa 6");
  const filatoClass7 = filatoRows.find((r) => r.isClassTotal && r.cont === "Total clasa 7");

  console.log(`  ct.121 Profit: SoldFinalC=${filato121?.soldFinalC} (expected ~1,248,651.60)`);
  console.log(`  ct.371 Stock:  SoldFinalD=${filato371?.soldFinalD} (expected ~948,820.64)`);
  console.log(`  Class 6 Total: SumeTotaleD=${filatoClass6?.sumeTotaleD} (expenses)`);
  console.log(`  Class 7 Total: SumeTotaleC=${filatoClass7?.sumeTotaleC} (revenue)`);

  // Build output matching preloaded.json structure
  const result = {
    balanta: {
      ifp: {
        ...ifpCompany,
        format: "ciel_8col",
        ...ifpPeriod,
        rows: ifpRows,
        totalRow: ifpRows.find((r) => r.isGrandTotal) || null,
      },
      filato: {
        ...filatoCompany,
        format: "ciel_8col",
        ...filatoPeriod,
        rows: filatoRows,
        totalRow: filatoRows.find((r) => r.isGrandTotal) || null,
      },
    },
  };

  const outPath = join(ROOT, "src/data/preloaded-2024.json");
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\nWritten to ${outPath}`);
}

main().catch(console.error);
