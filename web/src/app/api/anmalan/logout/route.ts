import { NextResponse } from "next/server";

import { ANMALAN_COOKIE } from "@/lib/anmalan-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ANMALAN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
