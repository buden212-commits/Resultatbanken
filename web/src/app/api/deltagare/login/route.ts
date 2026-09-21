import { NextResponse } from "next/server";

import {
  createDeltagareToken,
  DELTAGARE_COOKIE,
  findDeltagareByEmail,
  findDeltagareByName,
  findDeltagareByPersonId,
  verifyDeltagarePassword,
} from "@/lib/deltagare-auth";
import { loadDnsFeeTracker } from "@/lib/dns-fee-store";

function setSessionCookie(response: NextResponse, personId: string) {
  response.cookies.set(DELTAGARE_COOKIE, createDeltagareToken(personId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    password?: string;
    email?: string;
    name?: string;
    personId?: string;
  };

  const password = body.password?.trim() ?? "";
  if (!verifyDeltagarePassword(password)) {
    return NextResponse.json({ error: "Fel lösenord." }, { status: 401 });
  }

  const data = await loadDnsFeeTracker();

  if (body.personId?.trim()) {
    const person = findDeltagareByPersonId(data, body.personId.trim());
    if (!person) {
      return NextResponse.json({ error: "Deltagaren hittades inte." }, { status: 404 });
    }
    const response = NextResponse.json({ ok: true, person });
    setSessionCookie(response, person.personId);
    return response;
  }

  const email = body.email?.trim() ?? "";
  if (email) {
    const person = findDeltagareByEmail(data, email);
    if (person) {
      const response = NextResponse.json({ ok: true, person });
      setSessionCookie(response, person.personId);
      return response;
    }
    return NextResponse.json(
      {
        needName: true,
        error: "Ingen deltagare med den e-postadressen. Ange namn i stället.",
      },
      { status: 404 },
    );
  }

  const name = body.name?.trim() ?? "";
  if (name) {
    const candidates = findDeltagareByName(data, name);
    if (candidates.length === 0) {
      return NextResponse.json({ error: "Ingen deltagare med det namnet." }, { status: 404 });
    }
    if (candidates.length === 1) {
      const person = candidates[0];
      const response = NextResponse.json({ ok: true, person });
      setSessionCookie(response, person.personId);
      return response;
    }
    return NextResponse.json({ needPick: true, candidates });
  }

  return NextResponse.json({ error: "Ange e-post eller namn." }, { status: 400 });
}
