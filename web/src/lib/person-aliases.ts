import fs from "fs";
import path from "path";

import type { PersonAliasGroup } from "./types";

const ALIASES_PATH = path.join(process.cwd(), "..", "data", "person-aliases.json");

function readGroups(): PersonAliasGroup[] {
  if (!fs.existsSync(ALIASES_PATH)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(ALIASES_PATH, "utf-8")) as PersonAliasGroup[];
}

function buildLookup(): Map<string, { canonical_key: string; display_name: string }> {
  const lookup = new Map<string, { canonical_key: string; display_name: string }>();
  for (const group of readGroups()) {
    const entry = { canonical_key: group.canonical_key, display_name: group.display_name };
    lookup.set(group.canonical_key, entry);
    for (const alias of group.alias_keys) {
      lookup.set(alias, entry);
    }
  }
  return lookup;
}

export function getAliasGroups(): PersonAliasGroup[] {
  return readGroups();
}

export function resolvePersonKey(key: string): string {
  return buildLookup().get(key)?.canonical_key ?? key;
}

export function resolveDisplayName(key: string, fallback: string): string {
  return buildLookup().get(key)?.display_name ?? fallback;
}

/** Count unique people after merging alias groups. */
export function countUniquePeople(keys: Iterable<string>): number {
  const unique = new Set<string>();
  for (const key of keys) {
    unique.add(resolvePersonKey(key));
  }
  return unique.size;
}

export function getKeysForGroup(key: string): string[] {
  const canonicalKey = resolvePersonKey(key);
  const group = readGroups().find((item) => item.canonical_key === canonicalKey);
  if (!group) {
    return [canonicalKey];
  }
  return [group.canonical_key, ...group.alias_keys];
}

export function mergeAliasGroups(
  existing: PersonAliasGroup[],
  selectedKeys: string[],
  canonicalKey: string,
  displayName: string,
): PersonAliasGroup[] {
  if (selectedKeys.length < 2) {
    throw new Error("Välj minst två namn att slå ihop.");
  }

  if (!selectedKeys.includes(canonicalKey)) {
    throw new Error("Det valda huvudnamnet måste ingå i urvalet.");
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

export function removeAliasGroup(existing: PersonAliasGroup[], canonicalKey: string): PersonAliasGroup[] {
  return existing.filter((group) => group.canonical_key !== canonicalKey);
}

export function writeAliasGroupsLocal(groups: PersonAliasGroup[]): void {
  fs.writeFileSync(ALIASES_PATH, `${JSON.stringify(groups, null, 2)}\n`, "utf-8");
}
