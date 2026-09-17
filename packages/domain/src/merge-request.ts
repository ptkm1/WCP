export type MergeRequestProvider =
  | "github"
  | "gitlab"
  | "bitbucket"
  | "azure"
  | "other";

export type MergeRequestRole = "front" | "back";

export interface ParsedMergeRequest {
  provider: MergeRequestProvider;
  host: string;
  projectPath: string;
  repo: string;
  number: string;
  refSymbol: "#" | "!";
}

export interface MergeRequestMetadata {
  kind: "merge_request";
  provider: MergeRequestProvider;
  host: string;
  projectPath: string;
  repo: string;
  number: string;
  role?: string | null;
}

const ROLE_ALIASES: Record<string, MergeRequestRole> = {
  front: "front",
  frontend: "front",
  "mr front": "front",
  back: "back",
  backend: "back",
  "mr back": "back",
};

export function normalizeMergeRequestRole(
  value?: string | null,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return ROLE_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

export function formatMergeRequestRoleLabel(
  role?: string | null,
): string | null {
  const normalized = normalizeMergeRequestRole(role);
  if (!normalized) {
    return null;
  }
  if (normalized === "front") {
    return "Front";
  }
  if (normalized === "back") {
    return "Back";
  }
  return normalized;
}

export function parseMergeRequestUrl(
  raw?: string | null,
): ParsedMergeRequest | null {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
  const path = parsed.pathname.replace(/\/+$/, "");

  const gitlab = path.match(/^(.*)\/(?:-\/)?merge_requests\/(\d+)/i);
  if (gitlab) {
    const projectPath = gitlab[1].replace(/^\//, "");
    const repo = lastPathSegment(projectPath);
    return {
      provider: inferProvider(host, "gitlab"),
      host,
      projectPath,
      repo,
      number: gitlab[2],
      refSymbol: "!",
    };
  }

  const github = path.match(/^\/([^/]+)\/([^/]+)\/pulls?\/(\d+)/i);
  if (github) {
    return {
      provider: inferProvider(host, "github"),
      host,
      projectPath: `${github[1]}/${github[2]}`,
      repo: github[2],
      number: github[3],
      refSymbol: "#",
    };
  }

  const bitbucket = path.match(
    /^\/([^/]+)\/([^/]+)\/(?:pull-requests|pullrequest)\/(\d+)/i,
  );
  if (bitbucket) {
    return {
      provider: inferProvider(host, "bitbucket"),
      host,
      projectPath: `${bitbucket[1]}/${bitbucket[2]}`,
      repo: bitbucket[2],
      number: bitbucket[3],
      refSymbol: "#",
    };
  }

  const azure = path.match(/\/_git\/([^/]+)\/pullrequest\/(\d+)/i);
  if (azure) {
    return {
      provider: inferProvider(host, "azure"),
      host,
      projectPath: azure[1],
      repo: azure[1],
      number: azure[2],
      refSymbol: "#",
    };
  }

  return null;
}

export function isMergeRequestUrl(raw?: string | null): boolean {
  return parseMergeRequestUrl(raw) !== null;
}

export function formatMergeRequestTitle(
  parsed: ParsedMergeRequest,
  role?: string | null,
): string {
  const base = `${parsed.repo} ${parsed.refSymbol}${parsed.number}`;
  const roleLabel = formatMergeRequestRoleLabel(role);
  return roleLabel ? `${roleLabel} · ${base}` : base;
}

export function formatMergeRequestProviderLabel(provider: string): string {
  switch (provider) {
    case "github":
      return "GitHub";
    case "gitlab":
      return "GitLab";
    case "bitbucket":
      return "Bitbucket";
    case "azure":
      return "Azure DevOps";
    default:
      return "Git";
  }
}

export function parseMergeRequestMetadata(
  raw?: string | null,
): MergeRequestMetadata | null {
  if (!raw?.trim()) {
    return null;
  }
  try {
    const value = JSON.parse(raw) as Partial<MergeRequestMetadata>;
    if (value.kind !== "merge_request" || !value.repo || !value.number) {
      return null;
    }
    return {
      kind: "merge_request",
      provider: (value.provider as MergeRequestProvider) ?? "other",
      host: value.host ?? "",
      projectPath: value.projectPath ?? value.repo,
      repo: value.repo,
      number: String(value.number),
      role: value.role ?? null,
    };
  } catch {
    return null;
  }
}

export function describeMergeRequest(input: {
  title?: string | null;
  url?: string | null;
  artifactType?: string | null;
  metadataJson?: string | null;
}): {
  title: string;
  provider: string;
  providerLabel: string;
  repo: string;
  number: string;
  ref: string;
  role: string | null;
  roleLabel: string | null;
  url: string | null;
  hostPath: string | null;
} | null {
  const parsed = parseMergeRequestUrl(input.url);
  const metadata = parseMergeRequestMetadata(input.metadataJson);
  if (!parsed && !metadata && input.artifactType !== "pr") {
    return null;
  }

  const provider = metadata?.provider ?? parsed?.provider ?? "other";
  const repo = metadata?.repo ?? parsed?.repo ?? "";
  const number = metadata?.number ?? parsed?.number ?? "";
  const refSymbol = parsed?.refSymbol ?? (provider === "gitlab" ? "!" : "#");
  const role = metadata?.role ?? null;
  let title = input.title?.trim();
  if (!title && parsed) {
    title = formatMergeRequestTitle(parsed, role);
  } else if (!title && repo && number) {
    title = `${repo} ${refSymbol}${number}`;
  } else if (!title) {
    title = "Merge request";
  }

  let hostPath: string | null = null;
  if (parsed) {
    hostPath = `${parsed.host}/${parsed.projectPath}`;
  } else if (metadata?.host) {
    hostPath = `${metadata.host}/${metadata.projectPath}`;
  }

  return {
    title,
    provider,
    providerLabel: formatMergeRequestProviderLabel(provider),
    repo,
    number,
    ref: number ? `${refSymbol}${number}` : "",
    role,
    roleLabel: formatMergeRequestRoleLabel(role),
    url: input.url ?? null,
    hostPath,
  };
}

function lastPathSegment(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts.at(-1) ?? path;
}

function inferProvider(
  host: string,
  fallback: MergeRequestProvider,
): MergeRequestProvider {
  if (host.includes("github")) {
    return "github";
  }
  if (host.includes("gitlab")) {
    return "gitlab";
  }
  if (host.includes("bitbucket")) {
    return "bitbucket";
  }
  if (host.includes("azure") || host.includes("visualstudio")) {
    return "azure";
  }
  return fallback;
}
