import {
  fetchTypeAliasesFromGitHub,
  isGitDeployConfigured,
  publishTypeAliasesToGitHub,
} from "./github-deploy";
import { isDbEnabled } from "./db/config";
import { writeDocumentToDb } from "./db/store";
import {
  getTypeAliasGroups,
  mergeTypeAliasGroups,
  removeTypeAliasGroup,
  writeTypeAliasGroupsLocal,
} from "./type-aliases";
import type { TypeAliasGroup } from "./types";

export type SaveTypeAliasResult = {
  groups: TypeAliasGroup[];
  deploy: { mode: "local" | "git" | "db"; ok: boolean; message: string };
};

async function persistTypeAliasGroups(
  groups: TypeAliasGroup[],
  message: string,
): Promise<SaveTypeAliasResult> {
  if (isDbEnabled()) {
    await writeDocumentToDb("type-aliases", groups);
    writeTypeAliasGroupsLocal(groups);
    return {
      groups,
      deploy: { mode: "db", ok: true, message: "Typkoppling sparad i databasen." },
    };
  }

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
  const existing =
    !isDbEnabled() && isGitDeployConfigured()
      ? await fetchTypeAliasesFromGitHub()
      : getTypeAliasGroups();
  const groups = mergeTypeAliasGroups(existing, selectedKeys, canonicalKey, displayName);
  return persistTypeAliasGroups(groups, `Koppla typ: ${displayName}`);
}

export async function deleteTypeAliasGroup(canonicalKey: string): Promise<SaveTypeAliasResult> {
  const existing =
    !isDbEnabled() && isGitDeployConfigured()
      ? await fetchTypeAliasesFromGitHub()
      : getTypeAliasGroups();
  const groups = removeTypeAliasGroup(existing, canonicalKey);
  return persistTypeAliasGroups(groups, `Ta bort typkoppling: ${canonicalKey}`);
}

export function getTypeAliasGroupsForAdmin(): TypeAliasGroup[] {
  return getTypeAliasGroups();
}
