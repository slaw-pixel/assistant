import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import * as XLSX from "xlsx";

const FILE = join(process.cwd(), "data", "stacks.json");

export async function GET() {
  const data = JSON.parse(readFileSync(FILE, "utf-8"));
  const tickers: string[] = Array.isArray(data) ? data : (data.tickers ?? []);

  const ws = XLSX.utils.aoa_to_sheet([["Ticker"], ...tickers.map((t) => [t])]);
  ws["!cols"] = [{ wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Стаки");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="stacks.xlsx"`,
    },
  });
}
