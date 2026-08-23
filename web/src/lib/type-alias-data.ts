import {
  fetchTypeAliasesFromGitHub,
  isGitDeployConfigured,
  publishTypeAliasesToGitHub,
} from "./github-deploy";
import {
  getTypeAliasGroups,
  mergeTypeAliasGroups,
  removeTypeAliasGroup,
  writeTypeAliasGroupsLocal,
} from "./type-aliases";
import type { TypeAliasGroup } from "./types";

export type SaveTypeAliasResult = {
  groups: TypeAliasGroup[];
  deploy: { mode: "local" | "git"; ok: boolean; message: string };
};

async function persistTypeAliasGroups(
  groups: TypeAliasGroup[],
  message: string,
): Promise<SaveTypeAliasResult> {
  if (isGitDeployConfigured()) {
    const result = await publishTypeAliasesToGitHub(groups, message);
    return {
      groups,
      deploy: { mode: "git", ok: result.ok, message: result.message },
    };
  }

  writeTypeAliasGroupsLocal(groups);
  return {
    groups,
    deploy: { mode: "local", ok: true, message: "Typkoppling sparad." },
  };
}

export async function saveTypeAliasMerge(
  selectedKeys: string[],
  canonicalKey: string,
  displayName: string,
): Promise<SaveTypeAliasResult> {
  const existing = isGitDeployConfigured() ? await fetchTypeAliasesFromGitHub() : getTypeAliasGroups();
  const groups = mergeTypeAliasGroups(existing, selectedKeys, canonicalKey, displayName);
  return persistTypeAliasGroups(groups, `Koppla typ: ${displayName}`);
}

export async function deleteTypeAliasGroup(canonicalKey: string): Promise<SaveTypeAliasResult> {
  const existing = isGitDeployConfigured() ? await fetchTypeAliasesFromGitHub() : getTypeAliasGroups();
  const groups = removeTypeAliasGroup(existing, canonicalKey);
  return persistTypeAliasGroups(groups, `Ta bort typkoppling: ${canonicalKey}`);
}

export function getTypeAliasGroupsForAdmin(): TypeAliasGroup[] {
  return getTypeAliasGroups();
}
