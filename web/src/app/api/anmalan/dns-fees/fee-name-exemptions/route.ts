import { NextResponse } from "next/server";

import { isAnmalanAuthenticated } from "@/lib/anmalan-auth";
import { loadDnsFeeTracker, saveDnsFeeTracker } from "@/lib/dns-fee-store";

function parseFeeNames(body: { feeName?: string; feeNames?: string[] }): string[] {
  const fromArray = Array.isArray(body.feeNames)
    ? body.feeNames.map((name) => String(name).trim()).filter(Boolean)
    : [];
  const single = String(body.feeName ?? "").trim();
  const names = fromArray.length > 0 ? fromArray : single ? [single] : [];
  return [...new Set(names)];
}

export async function POST(request: Request) {
  if (!(await isAnmalanAuthenticated())) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      action?: "add" | "remove";
      feeName?: string;
      feeNames?: string[];
    };
    const feeNames = parseFeeNames(body);
    if (feeNames.length === 0) {
      return NextResponse.json({ error: "Ogiltigt avgiftsnamn." }, { status: 400 });
    }

    const data = await loadDnsFeeTracker();
    const set = new Set((data.exemptFeeNames ?? []).map(String));
    if (body.action === "remove") {
      for (const name of feeNames) set.delete(name);
    } else {
      for (const name of feeNames) set.add(name);
    }
    data.exemptFeeNames = [...set].sort((a, b) => a.localeCompare(b, "sv"));
    await saveDnsFeeTracker(data);
    return NextResponse.json({ ok: true, exemptFeeNames: data.exemptFeeNames });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunde inte spara avgiftsundantag.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
