import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/config/auth";
import { getInstrumentDailyHistorySeries } from "@/lib/firebase/firestore-analysis-history-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isSignedIn(request: NextRequest) {
  return request.cookies.has(AUTH_COOKIE_NAME);
}

export async function GET(request: NextRequest, context: { params: Promise<{ ticker: string }> }) {
  if (!isSignedIn(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { ticker } = await context.params;
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 30);
  const safeLimit = Number.isFinite(limit) ? Math.max(7, Math.min(90, Math.floor(limit))) : 30;

  try {
    const history = await getInstrumentDailyHistorySeries(ticker.toUpperCase(), safeLimit);
    return NextResponse.json({ ok: true, ticker: ticker.toUpperCase(), history });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown-error" },
      { status: 500 },
    );
  }
}
