import fs from "fs";
import path from "path";

import { typeKey } from "./slug";
import type { TypeAliasGroup } from "./types";

const ALIASES_PATH = path.join(process.cwd(), "..", "data", "type-aliases.json");

function readGroups(): TypeAliasGroup[] {
  if (!fs.existsSync(ALIASES_PATH)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(ALIASES_PATH, "utf-8")) as TypeAliasGroup[];
}

function buildLookup(): Map<string, { canonical_key: string; display_name: string }> {
  const lookup = new Map<string, { canonical_key: string; display_name: string }>();
  for (const group of readGroups()) {
    const entry = { canonical_key: group.canonical_key, display_name: group.display_name };
    lookup.set(group.canonical_key, entry);
    lookup.set(typeKey(group.display_name), entry);
    for (const alias of group.alias_keys) {
      lookup.set(alias, entry);
    }
  }
  return lookup;
}

export function getTypeAliasGroups(): TypeAliasGroup[] {
  return readGroups();
}

export function resolveTypeKey(key: string): string {
  return buildLookup().get(key)?.canonical_key ?? key;
}

export function resolveEventType(rawType: string): string {
  const trimmed = rawType.trim();
  if (!trimmed) {
    return buildLookup().get("tom-typ")?.display_name ?? "Okänd typ";
  }
  return buildLookup().get(typeKey(trimmed))?.display_name ?? trimmed;
}

export function mergeTypeAliasGroups(
  existing: TypeAliasGroup[],
  selectedKeys: string[],
  canonicalKey: string,
  displayName: string,
): TypeAliasGroup[] {
  if (selectedKeys.length < 2) {
    throw new Error("Välj minst två typer att slå ihop.");
  }

  if (!selectedKeys.includes(canonicalKey)) {
    throw new Error("Den valda huvudtypen måste ingå i urvalet.");
  }

  const allKeys = new Set(selectedKeys);
  const toRemove = new Set<number>();

  existing.forEach((group, index) => {
    const touches =
      allKeys.has(group.canonical_key) || group.alias_keys.some((alias) => allKeys.has(alias));
    if (touches) {
      allKeys.add(group.canonical_key);
      for (const alias of group.alias_keys) {
        allKeys.add(alias);
      }
      toRemove.add(index);
    }
  });

  allKeys.delete(canonicalKey);
  const aliasKeys = [...allKeys].sort();

  const remaining = existing.filter((_, index) => !toRemove.has(index));
  remaining.push({
    canonical_key: canonicalKey,
    display_name: displayName.trim(),
    alias_keys: aliasKeys,
  });

  return remaining.sort((a, b) => a.display_name.localeCompare(b.display_name, "sv"));
}

export function removeTypeAliasGroup(existing: TypeAliasGroup[], canonicalKey: string): TypeAliasGroup[] {
  return existing.filter((group) => group.canonical_key !== canonicalKey);
}

export function writeTypeAliasGroupsLocal(groups: TypeAliasGroup[]): void {
  fs.writeFileSync(ALIASES_PATH, `${JSON.stringify(groups, null, 2)}\n`, "utf-8");
}
