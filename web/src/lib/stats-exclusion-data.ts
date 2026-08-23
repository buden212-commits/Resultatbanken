import {
  fetchStatsExclusionsFromGitHub,
  isGitDeployConfigured,
  publishStatsExclusionsToGitHub,
} from "./github-deploy";
import {
  getStatsExcludedEventIds,
  setStatsExcludedEventIds,
} from "./stats-exclusions";

export type SaveStatsExclusionResult = {
  excluded_event_ids: number[];
  deploy: { mode: "local" | "git"; ok: boolean; message: string };
};

async function persistExclusions(
  eventIds: number[],
  message: string,
): Promise<SaveStatsExclusionResult> {
  if (isGitDeployConfigured()) {
    const result = await publishStatsExclusionsToGitHub(eventIds, message);
    return {
      excluded_event_ids: eventIds,
      deploy: { mode: "git", ok: result.ok, message: result.message },
    };
  }

  setStatsExcludedEventIds(eventIds);
  return {
    excluded_event_ids: eventIds,
    deploy: { mode: "local", ok: true, message: "Inställning sparad." },
  };
}

export async function saveEventStatsExclusion(
  eventId: number,
  excluded: boolean,
  eventName: string,
): Promise<SaveStatsExclusionResult> {
  const existing = isGitDeployConfigured()
    ? await fetchStatsExclusionsFromGitHub()
    : getStatsExcludedEventIds();

  const next = new Set(existing);
  if (excluded) {
    next.add(eventId);
  } else {
    next.delete(eventId);
  }

  const eventIds = [...next].sort((a, b) => a - b);
  const action = excluded ? "Exkludera från statistik" : "Inkludera i statistik";
  return persistExclusions(eventIds, `${action}: ${eventName} (${eventId})`);
}

export function getStatsExcludedEventIdsForDisplay(): number[] {
  return getStatsExcludedEventIds();
}
