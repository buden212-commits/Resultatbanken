import type { Event, PersonAliasGroup, ResultRow, TypeAliasGroup } from "./types";

type GitHubConfig = {
  token: string;
  owner: string;
  repo: string;
  branch: string;
};

type GitHubRef = {
  object: { sha: string };
};

type GitHubCommit = {
  sha: string;
  tree: { sha: string };
};

type GitHubBlob = {
  sha: string;
};

type GitHubTree = {
  sha: string;
};

type GitHubContent = {
  content: string;
  encoding: string;
};

type CommitFile = {
  path: string;
  content: string | Buffer;
};

function getGitHubConfig(): GitHubConfig | null {
  const token = process.env.GITHUB_TOKEN?.trim();
  const repo = process.env.GITHUB_REPO?.trim();
  if (!token || !repo) {
    return null;
  }

  const [owner, repoName] = repo.split("/");
  if (!owner || !repoName) {
    return null;
  }

  return {
    token,
    owner,
    repo: repoName,
    branch: process.env.GITHUB_BRANCH?.trim() || "main",
  };
}

export function isGitDeployConfigured(): boolean {
  return getGitHubConfig() !== null;
}

async function githubRequest<T>(config: GitHubConfig, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API (${response.status}): ${body}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function decodeContent(content: GitHubContent): string {
  if (content.encoding === "none" || !content.content) {
    throw new Error(
      "GitHub returnerade tom filinnehåll (filer över 1 MB kräver raw-läge).",
    );
  }
  if (content.encoding === "base64") {
    return Buffer.from(content.content.replace(/\n/g, ""), "base64").toString("utf-8");
  }
  return content.content;
}

async function fetchRawFileFromGitHub(config: GitHubConfig, filePath: string): Promise<string> {
  const response = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${filePath}?ref=${encodeURIComponent(config.branch)}`,
    {
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/vnd.github.raw+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API (${response.status}): ${body}`);
  }

  return response.text();
}

export async function fetchManifestFromGitHub(): Promise<Event[]> {
  const config = getGitHubConfig();
  if (!config) {
    throw new Error("Git-deploy är inte konfigurerat.");
  }

  const file = await githubRequest<GitHubContent>(
    config,
    `/contents/data/manifest.json?ref=${encodeURIComponent(config.branch)}`,
  );

  return JSON.parse(decodeContent(file)) as Event[];
}

async function createBlob(config: GitHubConfig, file: CommitFile): Promise<string> {
  const isBinary = Buffer.isBuffer(file.content);
  const payload = isBinary
    ? { content: file.content.toString("base64"), encoding: "base64" as const }
    : { content: file.content, encoding: "utf-8" as const };

  const blob = await githubRequest<GitHubBlob>(config, "/git/blobs", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return blob.sha;
}

export async function commitFilesToGitHub(
  files: CommitFile[],
  message: string,
): Promise<{ commitSha: string; branch: string }> {
  const config = getGitHubConfig();
  if (!config) {
    throw new Error("Git-deploy är inte konfigurerat.");
  }

  const ref = await githubRequest<GitHubRef>(config, `/git/ref/heads/${config.branch}`);
  const latestCommitSha = ref.object.sha;
  const latestCommit = await githubRequest<GitHubCommit>(config, `/git/commits/${latestCommitSha}`);

  const treeItems = await Promise.all(
    files.map(async (file) => ({
      path: file.path,
      mode: "100644" as const,
      type: "blob" as const,
      sha: await createBlob(config, file),
    })),
  );

  const tree = await githubRequest<GitHubTree>(config, "/git/trees", {
    method: "POST",
    body: JSON.stringify({
      base_tree: latestCommit.tree.sha,
      tree: treeItems,
    }),
  });

  const commit = await githubRequest<GitHubCommit>(config, "/git/commits", {
    method: "POST",
    body: JSON.stringify({
      message,
      tree: tree.sha,
      parents: [latestCommitSha],
    }),
  });

  await githubRequest(config, `/git/refs/heads/${config.branch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha }),
  });

  return { commitSha: commit.sha, branch: config.branch };
}

export async function triggerProductionDeploy(): Promise<{ ok: boolean; message: string }> {
  const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL?.trim();
  if (!hookUrl) {
    return {
      ok: true,
      message: "Commit pushad till GitHub. Vercel bygger om automatiskt om repot är kopplat.",
    };
  }

  const response = await fetch(hookUrl, { method: "POST" });
  if (!response.ok) {
    const body = await response.text();
    return {
      ok: false,
      message: `Commit sparad, men Vercel deploy hook misslyckades (${response.status}): ${body}`,
    };
  }

  return {
    ok: true,
    message: "Commit pushad och Vercel-deploy startad. Sidan uppdateras om några minuter.",
  };
}

export async function publishManifestToGitHub(
  events: Event[],
  message: string,
): Promise<{ ok: boolean; message: string; commitSha?: string }> {
  const content = `${JSON.stringify(events, null, 2)}\n`;
  const { commitSha, branch } = await commitFilesToGitHub(
    [{ path: "data/manifest.json", content }],
    message,
  );

  const build = await triggerProductionDeploy();

  return {
    ok: build.ok,
    message: `${build.message} (commit ${commitSha.slice(0, 7)} på ${branch})`,
    commitSha,
  };
}

export async function publishEventToGitHub(
  event: Event,
  file: { buffer: Buffer; storedName: string },
): Promise<{ ok: boolean; message: string; commitSha?: string }> {
  const manifest = await fetchManifestFromGitHub();
  const updatedManifest = [...manifest, event];
  const manifestContent = `${JSON.stringify(updatedManifest, null, 2)}\n`;

  const { commitSha, branch } = await commitFilesToGitHub(
    [
      { path: "data/manifest.json", content: manifestContent },
      { path: `data/content/${file.storedName}`, content: file.buffer },
    ],
    `Lägg till resultat: ${event.name} (${event.date})`,
  );

  const build = await triggerProductionDeploy();

  return {
    ok: build.ok,
    message: `${build.message} (commit ${commitSha.slice(0, 7)} på ${branch})`,
    commitSha,
  };
}

export async function fetchResultsIndexFromGitHub(): Promise<ResultRow[]> {
  const config = getGitHubConfig();
  if (!config) {
    throw new Error("Git-deploy är inte konfigurerat.");
  }

  const raw = await fetchRawFileFromGitHub(config, "data/results-index.json");
  return JSON.parse(raw) as ResultRow[];
}

export async function publishResultsDataToGitHub(
  results: ResultRow[],
  peopleJson: string,
  message: string,
): Promise<{ ok: boolean; message: string; commitSha?: string }> {
  const resultsContent = `${JSON.stringify(results, null, 2)}\n`;
  const { commitSha, branch } = await commitFilesToGitHub(
    [
      { path: "data/results-index.json", content: resultsContent },
      { path: "data/people-index.json", content: peopleJson },
    ],
    message,
  );

  const build = await triggerProductionDeploy();

  return {
    ok: build.ok,
    message: `${build.message} (commit ${commitSha.slice(0, 7)} på ${branch})`,
    commitSha,
  };
}

export async function fetchPersonAliasesFromGitHub(): Promise<PersonAliasGroup[]> {
  const config = getGitHubConfig();
  if (!config) {
    throw new Error("Git-deploy är inte konfigurerat.");
  }

  try {
    const file = await githubRequest<GitHubContent>(
      config,
      `/contents/data/person-aliases.json?ref=${encodeURIComponent(config.branch)}`,
    );
    return JSON.parse(decodeContent(file)) as PersonAliasGroup[];
  } catch {
    return [];
  }
}

export async function publishPersonAliasesToGitHub(
  groups: PersonAliasGroup[],
  message: string,
): Promise<{ ok: boolean; message: string; commitSha?: string }> {
  const content = `${JSON.stringify(groups, null, 2)}\n`;
  const { commitSha, branch } = await commitFilesToGitHub(
    [{ path: "data/person-aliases.json", content }],
    message,
  );

  const build = await triggerProductionDeploy();

  return {
    ok: build.ok,
    message: `${build.message} (commit ${commitSha.slice(0, 7)} på ${branch})`,
    commitSha,
  };
}

export async function fetchStatsExclusionsFromGitHub(): Promise<number[]> {
  const config = getGitHubConfig();
  if (!config) {
    throw new Error("Git-deploy är inte konfigurerat.");
  }

  try {
    const file = await githubRequest<GitHubContent>(
      config,
      `/contents/data/stats-exclusions.json?ref=${encodeURIComponent(config.branch)}`,
    );
    const parsed = JSON.parse(decodeContent(file)) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((id): id is number => typeof id === "number" && Number.isInteger(id));
  } catch {
    return [];
  }
}

export async function publishStatsExclusionsToGitHub(
  eventIds: number[],
  message: string,
): Promise<{ ok: boolean; message: string; commitSha?: string }> {
  const content = `${JSON.stringify(eventIds, null, 2)}\n`;
  const { commitSha, branch } = await commitFilesToGitHub(
    [{ path: "data/stats-exclusions.json", content }],
    message,
  );

  const build = await triggerProductionDeploy();

  return {
    ok: build.ok,
    message: `${build.message} (commit ${commitSha.slice(0, 7)} på ${branch})`,
    commitSha,
  };
}

export async function fetchTypeAliasesFromGitHub(): Promise<TypeAliasGroup[]> {
  const config = getGitHubConfig();
  if (!config) {
    throw new Error("Git-deploy är inte konfigurerat.");
  }

  try {
    const file = await githubRequest<GitHubContent>(
      config,
      `/contents/data/type-aliases.json?ref=${encodeURIComponent(config.branch)}`,
    );
    return JSON.parse(decodeContent(file)) as TypeAliasGroup[];
  } catch {
    return [];
  }
}

export async function publishTypeAliasesToGitHub(
  groups: TypeAliasGroup[],
  message: string,
): Promise<{ ok: boolean; message: string; commitSha?: string }> {
  const content = `${JSON.stringify(groups, null, 2)}\n`;
  const { commitSha, branch } = await commitFilesToGitHub(
    [{ path: "data/type-aliases.json", content }],
    message,
  );

  const build = await triggerProductionDeploy();

  return {
    ok: build.ok,
    message: `${build.message} (commit ${commitSha.slice(0, 7)} på ${branch})`,
    commitSha,
  };
}
