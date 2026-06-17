import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const FILE = join(process.cwd(), "data", "stacks.json");

function read(): string[] {
  const data = JSON.parse(readFileSync(FILE, "utf-8"));
  return Array.isArray(data) ? data : (data.tickers ?? []);
}

function write(tickers: string[]) {
  writeFileSync(FILE, JSON.stringify({ tickers }, null, 2), "utf-8");
}

export async function GET() {
  return NextResponse.json({ tickers: read() });
}

export async function PUT(req: NextRequest) {
  const { tickers } = await req.json();
  const cleaned: string[] = [...new Set(
    (tickers as string[]).map((t) => t.trim().toUpperCase()).filter(Boolean)
  )];
  write(cleaned);
  return NextResponse.json({ ok: true, count: cleaned.length });
}
