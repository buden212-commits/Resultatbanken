import { NextRequest, NextResponse } from "next/server";

import { searchPeople } from "@/lib/data";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const trimmed = q.trim();

  if (trimmed.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const results = searchPeople(trimmed)
    .slice(0, 8)
    .map((person) => ({
      person_key: person.person_key,
      display_name: person.display_name,
      result_count: person.result_count,
    }));

  return NextResponse.json({ results });
}
