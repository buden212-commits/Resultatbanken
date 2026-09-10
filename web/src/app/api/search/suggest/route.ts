import { NextRequest, NextResponse } from "next/server";

import { getSearchSuggestions } from "@/lib/search-suggest";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const trimmed = q.trim();

  if (trimmed.length < 2) {
    return NextResponse.json({ people: [], events: [], results: [] });
  }

  return NextResponse.json(getSearchSuggestions(trimmed));
}
