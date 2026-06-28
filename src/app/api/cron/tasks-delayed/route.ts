import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db/client";
import { todayInTimeZone } from "@/lib/datetime";
import { runDelayedTaskScan } from "@/modules/projects/tasks/delayed-job";
import { getSettings } from "@/modules/settings/queries";

// Vercel Cron: the nightly task-delay scan (docs/17 §10.7). Vercel calls this on the
// vercel.json schedule with `Authorization: Bearer $CRON_SECRET`. Dynamic by nature
// (reads the auth header); runs on the default Node runtime (postgres-js txns).
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = todayInTimeZone((await getSettings()).timezone);
    const result = await runDelayedTaskScan(db, today);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron:tasks-delayed] scan failed", err);
    return NextResponse.json({ ok: false, error: "Scan failed" }, { status: 500 });
  }
}
