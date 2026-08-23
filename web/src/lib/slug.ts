export function toSlug(value: string): string {
  const normalized = value.trim().toLowerCase().normalize("NFD");
  const withoutMarks = normalized.replace(/\p{M}/gu, "");
  return withoutMarks.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function typeKey(rawType: string): string {
  const trimmed = rawType.trim();
  if (!trimmed) {
    return "tom-typ";
  }
  return toSlug(trimmed) || "tom-typ";
}
