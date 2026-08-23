import { NextResponse } from "next/server";

import { verifyAdminToken } from "@/lib/admin-auth";
import { deletePersonAliasGroup, savePersonAliasMerge } from "@/lib/person-alias-data";

export async function POST(request: Request) {
  const token = request.cookies.get("admin_session")?.value;
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      selected_keys?: string[];
      canonical_key?: string;
      display_name?: string;
    };

    const selectedKeys = body.selected_keys ?? [];
    const canonicalKey = body.canonical_key?.trim() ?? "";
    const displayName = body.display_name?.trim() ?? "";

    if (!canonicalKey || !displayName) {
      return NextResponse.json({ error: "Välj vilket namn som ska gälla." }, { status: 400 });
    }

    const result = await savePersonAliasMerge(selectedKeys, canonicalKey, displayName);

    return NextResponse.json({
      ok: true,
      group_count: result.groups.length,
      deploy: result.deploy,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunde inte spara namnkoppling.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const token = request.cookies.get("admin_session")?.value;
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { canonical_key?: string };
    const canonicalKey = body.canonical_key?.trim() ?? "";

    if (!canonicalKey) {
      return NextResponse.json({ error: "Saknar canonical_key." }, { status: 400 });
    }

    const result = await deletePersonAliasGroup(canonicalKey);

    return NextResponse.json({
      ok: true,
      group_count: result.groups.length,
      deploy: result.deploy,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunde inte ta bort namnkoppling.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
