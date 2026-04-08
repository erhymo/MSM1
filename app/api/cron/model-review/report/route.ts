import { NextRequest, NextResponse } from "next/server";

import { runModelReviewReport } from "@/lib/model-review/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

function getUnauthorizedMessage() {
  if (!process.env.CRON_SECRET && process.env.NODE_ENV === "production") {
    return "CRON_SECRET is not configured";
  }

  return "Unauthorized";
}

async function handleRun(request: NextRequest, trigger: "cron" | "manual") {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: getUnauthorizedMessage() }, { status: 401 });
  }

  try {
    const dryRun = ["1", "true", "yes"].includes(request.nextUrl.searchParams.get("dryRun")?.toLowerCase() ?? "");
    const result = await runModelReviewReport(trigger, dryRun);
    return NextResponse.json({ ok: true, trigger, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, trigger, error: error instanceof Error ? error.message : "unknown-error" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handleRun(request, "cron");
}

export async function POST(request: NextRequest) {
  return handleRun(request, "manual");
}
