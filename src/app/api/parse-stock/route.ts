import { NextResponse } from "next/server";
import { parseStock } from "@/lib/parsers/stock-parser";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (
      !file.name.toLowerCase().endsWith(".xls") &&
      !file.name.toLowerCase().endsWith(".xlsx")
    ) {
      return NextResponse.json(
        { error: "File must be an Excel file (.xls or .xlsx)" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = parseStock(arrayBuffer);

    return NextResponse.json({
      success: true,
      data: result,
      summary: {
        company: result.companyName,
        period: `${result.periodStart} — ${result.periodEnd}`,
        totalProducts: result.rows.length,
        totalStockValue: result.totalValSoldFinal,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown parsing error";
    return NextResponse.json(
      { error: `Failed to parse stock file: ${message}` },
      { status: 500 }
    );
  }
}
