import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db/client";
import { deliverQueued, dispatchOutbox } from "@/modules/notifications/service";

// Vercel Cron drain (docs/16 §6, docs/17 §3 — cron is one of the few real HTTP
// routes). Vercel calls this on the schedule in vercel.json with an
// `Authorization: Bearer $CRON_SECRET` header. It runs on the default Node runtime
// (it renders React Email + uses the postgres-js transaction client) and is dynamic
// by nature (reads the auth header), so no route-segment config is needed — Cache
// Components rejects `runtime`/`dynamic` exports anyway.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const dispatched = await dispatchOutbox(db);
    const delivered = await deliverQueued(db);
    return NextResponse.json({ ok: true, dispatched, delivered });
  } catch (err) {
    console.error("[cron:notifications] drain failed", err);
    return NextResponse.json({ ok: false, error: "Drain failed" }, { status: 500 });
  }
}
