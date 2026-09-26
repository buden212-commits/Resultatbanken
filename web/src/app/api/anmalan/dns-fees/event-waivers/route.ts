import { NextResponse } from "next/server";

import { isAnmalanAuthenticated } from "@/lib/anmalan-auth";
import { loadDnsFeeTracker, saveDnsFeeTracker } from "@/lib/dns-fee-store";
import {
  EMPTY_MANUAL_WAIVER_FLAGS,
  hasAnyEventWaiver,
  type DnsFeeManualWaiverFlags,
} from "@/lib/dns-fee-types";

function parseFlags(body: Record<string, unknown>): DnsFeeManualWaiverFlags {
  return {
    waiveAnmalan:
      typeof body.waiveAnmalan === "boolean"
        ? body.waiveAnmalan
        : EMPTY_MANUAL_WAIVER_FLAGS.waiveAnmalan,
    waiveLate:
      typeof body.waiveLate === "boolean" ? body.waiveLate : EMPTY_MANUAL_WAIVER_FLAGS.waiveLate,
    waiveOther:
      typeof body.waiveOther === "boolean" ? body.waiveOther : EMPTY_MANUAL_WAIVER_FLAGS.waiveOther,
    waiveDns:
      typeof body.waiveDns === "boolean" ? body.waiveDns : EMPTY_MANUAL_WAIVER_FLAGS.waiveDns,
  };
}

export async function POST(request: Request) {
  if (!(await isAnmalanAuthenticated())) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown> & {
      eventId?: string;
      action?: "set";
    };
    const eventId = String(body.eventId ?? "").trim();
    if (!/^\d+$/.test(eventId)) {
      return NextResponse.json({ error: "Ogiltigt tävlings-id." }, { status: 400 });
    }

    const data = await loadDnsFeeTracker();
    const existing = (data.eventWaivers ?? []).find((item) => item.eventId === eventId);
    const current: DnsFeeManualWaiverFlags = existing
      ? {
          waiveAnmalan: existing.waiveAnmalan,
          waiveLate: existing.waiveLate,
          waiveOther: existing.waiveOther,
          waiveDns: existing.waiveDns,
        }
      : { ...EMPTY_MANUAL_WAIVER_FLAGS };

    const next: DnsFeeManualWaiverFlags = { ...current };
    for (const key of ["waiveAnmalan", "waiveLate", "waiveOther", "waiveDns"] as const) {
      if (typeof body[key] === "boolean") {
        next[key] = body[key] as boolean;
      }
    }

    // Keep legacy exemptEventIds in sync with whole-event Anmälan waiver.
    const exempt = new Set(data.exemptEventIds.map(String));
    if (next.waiveAnmalan) exempt.add(eventId);
    else exempt.delete(eventId);
    data.exemptEventIds = [...exempt].sort((a, b) => a.localeCompare(b, "sv"));

    const others = (data.eventWaivers ?? []).filter((item) => item.eventId !== eventId);
    if (hasAnyEventWaiver(next)) {
      data.eventWaivers = [...others, { eventId, ...next }].sort((a, b) =>
        a.eventId.localeCompare(b.eventId, "sv"),
      );
    } else {
      data.eventWaivers = others;
    }

    await saveDnsFeeTracker(data);
    return NextResponse.json({
      ok: true,
      eventWaivers: data.eventWaivers,
      exemptEventIds: data.exemptEventIds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunde inte spara tävlingsundantag.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
