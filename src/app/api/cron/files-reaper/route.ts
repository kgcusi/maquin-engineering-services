import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db/client";
import { runFileReaper } from "@/modules/files/reaper";

// Vercel Cron: sweep abandoned PENDING uploads (orphaned R2 objects + rows).
// `Authorization: Bearer $CRON_SECRET`-guarded; default Node runtime.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runFileReaper(db);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron:files-reaper] sweep failed", err);
    return NextResponse.json({ ok: false, error: "Sweep failed" }, { status: 500 });
  }
}
