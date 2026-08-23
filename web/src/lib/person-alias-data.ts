import {
  fetchPersonAliasesFromGitHub,
  isGitDeployConfigured,
  publishPersonAliasesToGitHub,
} from "./github-deploy";
import {
  getAliasGroups,
  mergeAliasGroups,
  removeAliasGroup,
  writeAliasGroupsLocal,
} from "./person-aliases";
import type { PersonAliasGroup } from "./types";

export type SaveAliasResult = {
  groups: PersonAliasGroup[];
  deploy: { mode: "local" | "git"; ok: boolean; message: string };
};

async function persistAliasGroups(groups: PersonAliasGroup[], message: string): Promise<SaveAliasResult> {
  if (isGitDeployConfigured()) {
    const result = await publishPersonAliasesToGitHub(groups, message);
    return {
      groups,
      deploy: { mode: "git", ok: result.ok, message: result.message },
    };
  }

  writeAliasGroupsLocal(groups);
  return {
    groups,
    deploy: { mode: "local", ok: true, message: "Namnkoppling sparad." },
  };
}

export async function savePersonAliasMerge(
  selectedKeys: string[],
  canonicalKey: string,
  displayName: string,
): Promise<SaveAliasResult> {
  const existing = isGitDeployConfigured() ? await fetchPersonAliasesFromGitHub() : getAliasGroups();
  const groups = mergeAliasGroups(existing, selectedKeys, canonicalKey, displayName);
  return persistAliasGroups(groups, `Koppla namn: ${displayName}`);
}

export async function deletePersonAliasGroup(canonicalKey: string): Promise<SaveAliasResult> {
  const existing = isGitDeployConfigured() ? await fetchPersonAliasesFromGitHub() : getAliasGroups();
  const groups = removeAliasGroup(existing, canonicalKey);
  return persistAliasGroups(groups, `Ta bort namnkoppling: ${canonicalKey}`);
}

export function getPersonAliasGroupsForAdmin(): PersonAliasGroup[] {
  return getAliasGroups();
}
