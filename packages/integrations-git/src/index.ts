import { execFileSync } from "node:child_process";
import type { ProviderType, RepositoryContextSnapshot } from "@wcp/domain";

export interface ParsedRemote {
  providerType: ProviderType;
  providerHost: string;
  owner?: string;
  repositoryName?: string;
  sshHostAlias?: string;
}

export interface GitIdentitySnapshot extends RepositoryContextSnapshot {
  remoteUrl?: string | null;
  detectedProviderType?: ProviderType | null;
}

export function getGitIdentitySnapshot(repositoryPath: string): GitIdentitySnapshot {
  const remoteUrl = safeGit(repositoryPath, ["config", "--get", "remote.origin.url"]);
  const userName = safeGit(repositoryPath, ["config", "--local", "--get", "user.name"]);
  const userEmail = safeGit(repositoryPath, ["config", "--local", "--get", "user.email"]);
  const branchName = safeGit(repositoryPath, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const parsedRemote = remoteUrl ? parseRemoteUrl(remoteUrl) : null;

  return {
    repositoryId: repositoryPath,
    repositoryName: repositoryPath.split("/").at(-1) ?? repositoryPath,
    branchName,
    remoteUrl,
    detectedProviderType: parsedRemote?.providerType ?? null,
    detectedProviderHost: parsedRemote?.providerHost ?? null,
    detectedSshHostAlias: parsedRemote?.sshHostAlias ?? null,
    detectedGitUserName: userName,
    detectedGitUserEmail: userEmail
  };
}

export function parseRemoteUrl(remoteUrl: string): ParsedRemote {
  if (remoteUrl.startsWith("git@")) {
    const [hostAndAlias, pathPart] = remoteUrl.replace("git@", "").split(":");
    const [owner, repoWithSuffix] = pathPart?.split("/") ?? [];
    return {
      providerType: inferProviderType(hostAndAlias),
      providerHost: hostAndAlias,
      sshHostAlias: hostAndAlias,
      owner,
      repositoryName: stripGitSuffix(repoWithSuffix)
    };
  }

  if (remoteUrl.startsWith("https://") || remoteUrl.startsWith("http://")) {
    const url = new URL(remoteUrl);
    const [owner, repoWithSuffix] = url.pathname.replace(/^\//, "").split("/");
    return {
      providerType: inferProviderType(url.hostname),
      providerHost: url.hostname,
      owner,
      repositoryName: stripGitSuffix(repoWithSuffix)
    };
  }

  return {
    providerType: "other",
    providerHost: remoteUrl
  };
}

function safeGit(repositoryPath: string, args: string[]): string | null {
  try {
    const output = execFileSync("git", args, {
      cwd: repositoryPath,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    return output.length > 0 ? output : null;
  } catch {
    return null;
  }
}

function inferProviderType(host: string): ProviderType {
  if (host.includes("github")) {
    return "github";
  }

  if (host.includes("gitlab")) {
    return "gitlab";
  }

  if (host.includes("bitbucket")) {
    return "bitbucket";
  }

  if (host.includes("azure")) {
    return "azure";
  }

  if (host.includes("gitea")) {
    return "gitea";
  }

  return "other";
}

function stripGitSuffix(value?: string) {
  return value?.replace(/\.git$/, "");
}
