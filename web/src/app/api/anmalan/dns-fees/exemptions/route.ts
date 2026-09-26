import { NextResponse } from "next/server";

import { isAnmalanAuthenticated } from "@/lib/anmalan-auth";
import { loadDnsFeeTracker, saveDnsFeeTracker } from "@/lib/dns-fee-store";
import { hasAnyEventWaiver } from "@/lib/dns-fee-types";

function parseEventIds(body: { eventId?: string; eventIds?: string[] }): string[] {
  const fromArray = Array.isArray(body.eventIds)
    ? body.eventIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  const single = String(body.eventId ?? "").trim();
  const ids = fromArray.length > 0 ? fromArray : single ? [single] : [];
  return [...new Set(ids.filter((id) => /^\d+$/.test(id)))];
}

export async function POST(request: Request) {
  if (!(await isAnmalanAuthenticated())) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      action?: "add" | "remove";
      /** exempt = waive ordinarie; removed = exclude event entirely */
      mode?: "exempt" | "removed";
      eventId?: string;
      eventIds?: string[];
    };
    const eventIds = parseEventIds(body);
    if (eventIds.length === 0) {
      return NextResponse.json({ error: "Ogiltigt tävlings-id." }, { status: 400 });
    }

    const mode = body.mode === "removed" ? "removed" : "exempt";
    const data = await loadDnsFeeTracker();
    const exempt = new Set(data.exemptEventIds.map(String));
    const removed = new Set((data.removedEventIds ?? []).map(String));
    let eventWaivers = [...(data.eventWaivers ?? [])];

    if (body.action === "remove") {
      for (const eventId of eventIds) {
        if (mode === "removed") {
          removed.delete(eventId);
        } else {
          exempt.delete(eventId);
          eventWaivers = eventWaivers.map((item) =>
            item.eventId === eventId ? { ...item, waiveAnmalan: false } : item,
          );
        }
      }
    } else if (mode === "removed") {
      for (const eventId of eventIds) {
        removed.add(eventId);
        exempt.delete(eventId);
      }
    } else {
      for (const eventId of eventIds) {
        exempt.add(eventId);
        removed.delete(eventId);
        const existing = eventWaivers.find((item) => item.eventId === eventId);
        if (existing) {
          eventWaivers = eventWaivers.map((item) =>
            item.eventId === eventId ? { ...item, waiveAnmalan: true } : item,
          );
        } else {
          eventWaivers.push({
            eventId,
            waiveAnmalan: true,
            waiveLate: false,
            waiveOther: false,
            waiveDns: false,
          });
        }
      }
    }

    data.exemptEventIds = [...exempt].sort((a, b) => a.localeCompare(b, "sv"));
    data.removedEventIds = [...removed].sort((a, b) => a.localeCompare(b, "sv"));
    data.eventWaivers = eventWaivers
      .filter((item) =>
        hasAnyEventWaiver({
          waiveAnmalan: item.waiveAnmalan,
          waiveLate: item.waiveLate,
          waiveOther: item.waiveOther,
          waiveDns: item.waiveDns,
        }),
      )
      .sort((a, b) => a.eventId.localeCompare(b.eventId, "sv"));

    await saveDnsFeeTracker(data);
    return NextResponse.json({
      ok: true,
      exemptEventIds: data.exemptEventIds,
      removedEventIds: data.removedEventIds,
      eventWaivers: data.eventWaivers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunde inte spara undantag.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
