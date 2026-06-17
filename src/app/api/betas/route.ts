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

  console.log(`[betas] fetching period="${period}" for ${Object.keys(UNIVERSE).length} sectors`);

  const results = await Promise.allSettled(
    Object.entries(UNIVERSE).map(async ([etf, stocks]) => {
      console.log(`[betas] → ${etf} (${stocks.length} stocks)`);
      try {
        const rows = await fetchSectorBetas(stocks, etf, period);
        console.log(`[betas] ✓ ${etf}: ${rows.length} rows`);
        return rows;
      } catch (e) {
        console.error(`[betas] ✗ ${etf}: ${e}`);
        throw e;
      }
    })
  );

  const rows = results.flatMap((r) =>
    r.status === "fulfilled" ? r.value : []
  );

  console.log(`[betas] done — ${rows.length} total rows`);
  return NextResponse.json({ rows, period, fetchedAt: new Date().toISOString() });
}
