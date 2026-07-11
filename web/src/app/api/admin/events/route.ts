import { NextResponse } from "next/server";

import { verifyAdminToken } from "@/lib/admin-auth";
import { createEvent } from "@/lib/admin-data";

export async function POST(request: Request) {
  const token = request.cookies.get("admin_session")?.value;
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  try {
    const formData = await request.formData();

    const name = String(formData.get("name") ?? "");
    const type = String(formData.get("type") ?? "");
    const date = String(formData.get("date") ?? "");
    const organizer = String(formData.get("organizer") ?? "");
    const location = String(formData.get("location") ?? "");
    const free_text = String(formData.get("free_text") ?? "");
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Resultatfil krävs." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await createEvent(
      { name, type, date, organizer, location, free_text },
      { buffer, filename: file.name },
    );

    return NextResponse.json({
      id: result.event.id,
      url: `/resultat/${result.event.id}`,
      deploy: result.deploy,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunde inte spara resultatet.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
