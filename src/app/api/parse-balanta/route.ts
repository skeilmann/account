import { NextResponse } from "next/server";
import { parseBalanta } from "@/lib/parsers/balanta-parser";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "File must be a PDF" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const result = await parseBalanta(buffer);

    return NextResponse.json({
      success: true,
      data: result,
      summary: {
        company: result.companyName,
        format: result.format,
        period: `${result.periodStart} — ${result.periodEnd}`,
        totalAccounts: result.rows.filter(
          (r) => !r.isClassTotal && !r.isGrandTotal
        ).length,
        balanced:
          result.totalRow !== null &&
          Math.abs(result.totalRow.soldFinalD - result.totalRow.soldFinalC) <
            0.01,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown parsing error";
    return NextResponse.json(
      { error: `Failed to parse Balanta: ${message}` },
      { status: 500 }
    );
  }
}
