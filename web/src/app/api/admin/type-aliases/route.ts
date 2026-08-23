import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { deleteTypeAliasGroup, saveTypeAliasMerge } from "@/lib/type-alias-data";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
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
      return NextResponse.json({ error: "Välj vilken typ som ska gälla." }, { status: 400 });
    }

    const result = await saveTypeAliasMerge(selectedKeys, canonicalKey, displayName);

    return NextResponse.json({
      ok: true,
      group_count: result.groups.length,
      deploy: result.deploy,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunde inte spara typkoppling.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { canonical_key?: string };
    const canonicalKey = body.canonical_key?.trim() ?? "";

    if (!canonicalKey) {
      return NextResponse.json({ error: "Saknar canonical_key." }, { status: 400 });
    }

    const result = await deleteTypeAliasGroup(canonicalKey);

    return NextResponse.json({
      ok: true,
      group_count: result.groups.length,
      deploy: result.deploy,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunde inte ta bort typkoppling.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
