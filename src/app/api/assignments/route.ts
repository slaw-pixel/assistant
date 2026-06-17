import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const FILE = join(process.cwd(), "data", "assignments.json");

function read(): Record<string, string> {
  try { return JSON.parse(readFileSync(FILE, "utf-8")); } catch { return {}; }
}

export async function GET() {
  return NextResponse.json(read());
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  writeFileSync(FILE, JSON.stringify(body, null, 2), "utf-8");
  return NextResponse.json({ ok: true });
}
