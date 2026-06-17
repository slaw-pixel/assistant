import { NextRequest, NextResponse } from "next/server";
import { fetchSectorBetas } from "@/lib/datum";
import { UNIVERSE } from "@/lib/universe";

const VALID_PERIODS = [
  "3 months",
  "6 months",
  "12 months",
  "2 weeks (no sector filter)",
  "1 month (no sector filter)",
];

export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period") ?? "3 months";
  if (!VALID_PERIODS.includes(period)) {
    return NextResponse.json({ error: `Invalid period: ${period}` }, { status: 400 });
  }

  // Fetch all sectors in parallel; skip a sector if it fails
  const results = await Promise.allSettled(
    Object.entries(UNIVERSE).map(([etf, stocks]) =>
      fetchSectorBetas(stocks, etf, period)
    )
  );

  const rows = results.flatMap((r) =>
    r.status === "fulfilled" ? r.value : []
  );

  return NextResponse.json({ rows, period, fetchedAt: new Date().toISOString() });
}
