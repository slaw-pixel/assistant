import { NextRequest, NextResponse } from "next/server";
import { fetchSectorBetas } from "@/lib/datum";
import { UNIVERSE } from "@/lib/universe";

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  const period = req.nextUrl.searchParams.get("period") ?? "3 months";
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  const results = await Promise.allSettled(
    Object.keys(UNIVERSE).map(async (etf) => {
      const rows = await fetchSectorBetas([ticker], etf, period);
      const row = rows[0];
      return { etf, corr: row?.corr ?? null, beta: row?.beta ?? null };
    })
  );

  const suggestions = results
    .filter((r): r is PromiseFulfilledResult<{ etf: string; corr: number; beta: number }> =>
      r.status === "fulfilled" && r.value.corr != null
    )
    .map((r) => r.value)
    .sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr));

  return NextResponse.json({ ticker, suggestions });
}
