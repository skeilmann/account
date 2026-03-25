import { NextResponse } from "next/server";
import { parseBalanta } from "@/lib/parsers/balanta-parser";
import {
  parseBalantaDetaliata,
  isDetailedBalanta,
} from "@/lib/parsers/balanta-detaliata-parser";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Quick text extraction to detect format
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
    const pdfData = await pdfParse(buffer);
    const isDetailed = isDetailedBalanta(pdfData.text);

    if (isDetailed) {
      const data = await parseBalantaDetaliata(buffer);
      return NextResponse.json({
        success: true,
        type: "detailed",
        data,
        summary: {
          company: data.companyName,
          totalEntries: data.entries.length,
        },
      });
    } else {
      const data = await parseBalanta(buffer);
      return NextResponse.json({
        success: true,
        type: "summary",
        data,
        summary: {
          company: data.companyName,
          totalAccounts: data.rows.filter(
            (r) => !r.isClassTotal && !r.isGrandTotal
          ).length,
        },
      });
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Parse error",
      },
      { status: 500 }
    );
  }
}
