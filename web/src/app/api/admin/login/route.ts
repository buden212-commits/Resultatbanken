import { NextResponse } from "next/server";

import { ADMIN_COOKIE, createAdminToken, isAdminConfigured, verifyPassword } from "@/lib/admin-auth";

export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Admin är inte konfigurerat. Sätt ADMIN_PASSWORD i miljövariabler." },
      { status: 503 },
    );
  }

  const body = (await request.json()) as { password?: string };
  const password = body.password?.trim() ?? "";

  if (!verifyPassword(password)) {
    return NextResponse.json({ error: "Fel lösenord." }, { status: 401 });
  }

  const token = createAdminToken();
  if (!token) {
    return NextResponse.json({ error: "Kunde inte skapa session." }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
