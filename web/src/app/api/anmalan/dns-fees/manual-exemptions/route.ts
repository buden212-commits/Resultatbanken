import { NextResponse } from "next/server";

import { isAnmalanAuthenticated } from "@/lib/anmalan-auth";
import { loadDnsFeeTracker, saveDnsFeeTracker } from "@/lib/dns-fee-store";
import {
  EMPTY_MANUAL_WAIVER_FLAGS,
  hasAnyManualWaiver,
  manualExemptionKey,
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
      action?: "add" | "remove" | "set";
      personId?: string;
      eventId?: string;
    };
    const personId = String(body.personId ?? "").trim();
    const eventId = String(body.eventId ?? "").trim();
    if (!personId || !/^\d+$/.test(eventId)) {
      return NextResponse.json({ error: "Ogiltigt person- eller tävlings-id." }, { status: 400 });
    }

    const data = await loadDnsFeeTracker();
    const list = [...(data.manualExemptions ?? [])];
    const key = manualExemptionKey(personId, eventId);
    const index = list.findIndex(
      (item) => manualExemptionKey(item.personId, item.eventId) === key,
    );

    if (body.action === "remove") {
      if (index >= 0) list.splice(index, 1);
    } else {
      const current = index >= 0 ? list[index] : null;
      const incoming = parseFlags(body);
      // Support partial updates: only overwrite flags present in the body.
      const flags: DnsFeeManualWaiverFlags = {
        waiveAnmalan:
          typeof body.waiveAnmalan === "boolean"
            ? body.waiveAnmalan
            : (current?.waiveAnmalan ?? incoming.waiveAnmalan),
        waiveLate:
          typeof body.waiveLate === "boolean"
            ? body.waiveLate
            : (current?.waiveLate ?? incoming.waiveLate),
        waiveOther:
          typeof body.waiveOther === "boolean"
            ? body.waiveOther
            : (current?.waiveOther ?? incoming.waiveOther),
        waiveDns:
          typeof body.waiveDns === "boolean"
            ? body.waiveDns
            : (current?.waiveDns ?? incoming.waiveDns),
      };

      // Legacy "add" without flags → previous full waiver (not late).
      if (
        body.action === "add" &&
        typeof body.waiveAnmalan !== "boolean" &&
        typeof body.waiveLate !== "boolean" &&
        typeof body.waiveOther !== "boolean" &&
        typeof body.waiveDns !== "boolean"
      ) {
        flags.waiveAnmalan = true;
        flags.waiveLate = false;
        flags.waiveOther = true;
        flags.waiveDns = true;
      }

      if (!hasAnyManualWaiver(flags)) {
        if (index >= 0) list.splice(index, 1);
      } else if (index >= 0) {
        list[index] = {
          ...list[index],
          ...flags,
          createdAt: new Date().toISOString(),
        };
      } else {
        list.push({
          personId,
          eventId,
          createdAt: new Date().toISOString(),
          ...flags,
        });
      }
    }

    data.manualExemptions = list.sort((a, b) => {
      const personCmp = a.personId.localeCompare(b.personId, "sv");
      if (personCmp !== 0) return personCmp;
      return a.eventId.localeCompare(b.eventId, "sv");
    });
    await saveDnsFeeTracker(data);
    return NextResponse.json({ ok: true, manualExemptions: data.manualExemptions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunde inte spara manuellt undantag.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
