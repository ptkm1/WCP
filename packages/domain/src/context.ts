import type {
  EffectiveGitIdentity,
  EnvironmentProfile,
  Id,
  Repository,
  RepositoryIdentity,
  SourceType,
} from "./index";

/**
 * Resolved runtime context — not persisted as source of truth.
 *
 * Link inference (org from project/repo) is derived at read/validate time.
 * Provenance of persisted records uses SourceType (manual / inferred / captured / imported).
 */
export type GitIdentitySource = "profile" | "override" | "repository";

export interface WorkContextLinksInput {
  organizationId?: Id | null;
  projectId?: Id | null;
  repositoryId?: Id | null;
}

export interface WorkContextEntityRefs {
  projects: Map<
    Id,
    { organizationId?: Id | null; name?: string | null; isActive?: boolean }
  >;
  repositories: Map<
    Id,
    {
      organizationId?: Id | null;
      projectId?: Id | null;
      name?: string | null;
      isActive?: boolean;
    }
  >;
  organizations?: Map<Id, { name?: string | null; isActive?: boolean }>;
}

export interface ResolvedWorkContext {
  organizationId?: Id | null;
  organizationName?: string | null;
  projectId?: Id | null;
  projectName?: string | null;
  repositoryId?: Id | null;
  repositoryName?: string | null;
  inferredOrganizationFrom?: "project" | "repository" | null;
}

export interface ContextValidationIssue {
  code: string;
  message: string;
}

export interface GitContextGroup {
  key: string;
  environmentProfileId?: Id | null;
  gitUserName?: string | null;
  gitUserEmail?: string | null;
  repositoryIds: Id[];
}

function trimId(value?: Id | null): Id | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function coalesceString(
  ...values: Array<string | null | undefined>
): string | null {
  for (const value of values) {
    if (value != null && value !== "") {
      return value;
    }
  }
  return null;
}

export function buildWorkContextEntityRefs(input: {
  projects?: Array<{
    id: Id;
    organizationId?: Id | null;
    name?: string | null;
    isActive?: boolean;
  }>;
  repositories?: Array<{
    id: Id;
    organizationId?: Id | null;
    projectId?: Id | null;
    name?: string | null;
    isActive?: boolean;
  }>;
  organizations?: Array<{ id: Id; name?: string | null; isActive?: boolean }>;
}): WorkContextEntityRefs {
  const projects = new Map<
    Id,
    { organizationId?: Id | null; name?: string | null; isActive?: boolean }
  >();
  for (const project of input.projects ?? []) {
    projects.set(project.id, {
      organizationId: project.organizationId ?? null,
      name: project.name ?? null,
      isActive: project.isActive ?? true,
    });
  }

  const repositories = new Map<
    Id,
    {
      organizationId?: Id | null;
      projectId?: Id | null;
      name?: string | null;
      isActive?: boolean;
    }
  >();
  for (const repository of input.repositories ?? []) {
    repositories.set(repository.id, {
      organizationId: repository.organizationId ?? null,
      projectId: repository.projectId ?? null,
      name: repository.name ?? null,
      isActive: repository.isActive ?? true,
    });
  }

  const organizations = new Map<
    Id,
    { name?: string | null; isActive?: boolean }
  >();
  for (const organization of input.organizations ?? []) {
    organizations.set(organization.id, {
      name: organization.name ?? null,
      isActive: organization.isActive ?? true,
    });
  }

  return { projects, repositories, organizations };
}

export function resolveWorkContextLinks(
  input: WorkContextLinksInput,
  refs: WorkContextEntityRefs,
): ResolvedWorkContext {
  const organizationId = trimId(input.organizationId);
  const projectId = trimId(input.projectId);
  const repositoryId = trimId(input.repositoryId);

  let resolvedOrganizationId = organizationId;
  let inferredOrganizationFrom: ResolvedWorkContext["inferredOrganizationFrom"] =
    null;
  let projectName: string | null = null;
  let repositoryName: string | null = null;

  if (projectId) {
    const project = refs.projects.get(projectId);
    projectName = project?.name ?? null;
    if (
      !resolvedOrganizationId &&
      project?.organizationId &&
      (project.isActive ?? true)
    ) {
      resolvedOrganizationId = project.organizationId;
      inferredOrganizationFrom = "project";
    }
  }

  if (repositoryId) {
    const repository = refs.repositories.get(repositoryId);
    repositoryName = repository?.name ?? null;
    if (
      !resolvedOrganizationId &&
      repository?.organizationId &&
      (repository.isActive ?? true)
    ) {
      resolvedOrganizationId = repository.organizationId;
      inferredOrganizationFrom = "repository";
    }
  }

  const organizationName =
    resolvedOrganizationId != null
      ? (refs.organizations?.get(resolvedOrganizationId)?.name ?? null)
      : null;

  return {
    organizationId: resolvedOrganizationId,
    organizationName,
    projectId,
    projectName,
    repositoryId,
    repositoryName,
    inferredOrganizationFrom,
  };
}

export function validateWorkContextLinks(
  input: WorkContextLinksInput,
  refs: WorkContextEntityRefs,
): ContextValidationIssue[] {
  const issues: ContextValidationIssue[] = [];
  const organizationId = trimId(input.organizationId);
  const projectId = trimId(input.projectId);
  const repositoryId = trimId(input.repositoryId);
  let resolvedOrganizationId = organizationId;

  if (projectId) {
    const project = refs.projects.get(projectId);
    if (!project || project.isActive === false) {
      issues.push({ code: "project_not_found", message: "Projeto nao encontrado." });
    } else {
      if (
        resolvedOrganizationId &&
        project.organizationId &&
        project.organizationId !== resolvedOrganizationId
      ) {
        issues.push({
          code: "project_org_mismatch",
          message: "O projeto selecionado pertence a outra empresa.",
        });
      } else if (!resolvedOrganizationId && project.organizationId) {
        resolvedOrganizationId = project.organizationId;
      }
    }
  }

  if (repositoryId) {
    const repository = refs.repositories.get(repositoryId);
    if (!repository || repository.isActive === false) {
      issues.push({
        code: "repository_not_found",
        message: "Repositorio nao encontrado.",
      });
    } else {
      if (
        resolvedOrganizationId &&
        repository.organizationId &&
        repository.organizationId !== resolvedOrganizationId
      ) {
        issues.push({
          code: "repository_org_mismatch",
          message: "Repositorio pertence a outra empresa.",
        });
      } else if (!resolvedOrganizationId && repository.organizationId) {
        resolvedOrganizationId = repository.organizationId;
      }

      if (
        projectId &&
        repository.projectId &&
        repository.projectId !== projectId
      ) {
        issues.push({
          code: "repository_project_mismatch",
          message: "Repositorio nao esta vinculado ao projeto selecionado.",
        });
      }
    }
  }

  return issues;
}

export function resolveEffectiveGitIdentity(
  identity: RepositoryIdentity | null | undefined,
  profile: EnvironmentProfile | null | undefined,
  repository?: Repository | null,
): EffectiveGitIdentity {
  return {
    environmentProfileId: identity?.environmentProfileId ?? profile?.id ?? null,
    environmentName: profile?.name ?? null,
    providerHost: coalesceString(
      profile?.providerHost,
      repository?.providerHost,
    ),
    gitUserName: coalesceString(identity?.gitUserName, profile?.gitUserName),
    gitUserEmail: coalesceString(identity?.gitUserEmail, profile?.gitUserEmail),
    sshHostAlias: coalesceString(identity?.sshHostAlias, profile?.sshHostAlias),
    branchPattern: profile?.branchPattern ?? null,
    providerUsername: coalesceString(identity?.providerUsername),
    providerAccountLabel: coalesceString(identity?.providerAccountLabel),
  };
}

export function resolveGitIdentitySource(
  identity: RepositoryIdentity | null | undefined,
  profile: EnvironmentProfile | null | undefined,
): GitIdentitySource {
  const hasOverride =
    Boolean(identity?.gitUserName?.trim()) ||
    Boolean(identity?.gitUserEmail?.trim()) ||
    Boolean(identity?.sshHostAlias?.trim());

  if (hasOverride) {
    return "override";
  }

  if (profile?.id) {
    return "profile";
  }

  return "repository";
}

export function buildContextChainLabel(input: {
  organizationName?: string | null;
  environmentName?: string | null;
  repositoryName?: string | null;
  effectiveIdentity?: EffectiveGitIdentity | null;
  identitySource?: GitIdentitySource | null;
}): string | null {
  const orgLabel = input.organizationName ?? "Empresa";
  const profileLabel = input.environmentName ?? "Perfil";
  const repoLabel = input.repositoryName ?? "Repositorio";
  const gitName = input.effectiveIdentity?.gitUserName;
  const gitEmail = input.effectiveIdentity?.gitUserEmail;
  const gitLabel =
    gitName && gitEmail
      ? `${gitName} <${gitEmail}>`
      : (gitName ?? gitEmail ?? "identidade nao configurada");
  const sourceLabel =
    input.identitySource === "override"
      ? "override local"
      : input.identitySource === "profile"
        ? "via perfil"
        : null;

  return [
    orgLabel,
    profileLabel,
    repoLabel,
    `git: ${gitLabel}${sourceLabel ? ` (${sourceLabel})` : ""}`,
  ].join(" → ");
}

export function listOrganizationContextGaps(
  profile: Pick<
    EnvironmentProfile,
    "gitUserName" | "gitUserEmail" | "branchPattern" | "providerHost"
  > | null,
): string[] {
  if (!profile) {
    return [
      "Sem git user.name",
      "Sem git user.email",
      "Sem padrao de branch",
      "Sem provider host",
    ];
  }

  const gaps: string[] = [];
  if (!profile.gitUserName?.trim()) {
    gaps.push("Sem git user.name");
  }
  if (!profile.gitUserEmail?.trim()) {
    gaps.push("Sem git user.email");
  }
  if (!profile.branchPattern?.trim()) {
    gaps.push("Sem padrao de branch");
  }
  if (!profile.providerHost?.trim()) {
    gaps.push("Sem provider host");
  }
  return gaps;
}

export function groupRepositoriesByGitContext(input: {
  repositories: Array<Pick<Repository, "id">>;
  identities: Map<Id, RepositoryIdentity>;
  profiles: Map<Id, EnvironmentProfile>;
}): GitContextGroup[] {
  const groups = new Map<string, GitContextGroup>();

  for (const repository of input.repositories) {
    const identity = input.identities.get(repository.id) ?? null;
    const profile =
      identity?.environmentProfileId != null
        ? (input.profiles.get(identity.environmentProfileId) ?? null)
        : null;
    const effective = resolveEffectiveGitIdentity(identity, profile, null);
    const key = [
      effective.environmentProfileId ?? "none",
      effective.gitUserName ?? "",
      effective.gitUserEmail ?? "",
      effective.sshHostAlias ?? "",
    ].join("|");

    const existing = groups.get(key);
    if (existing) {
      existing.repositoryIds.push(repository.id);
      continue;
    }

    groups.set(key, {
      key,
      environmentProfileId: effective.environmentProfileId ?? null,
      gitUserName: effective.gitUserName ?? null,
      gitUserEmail: effective.gitUserEmail ?? null,
      repositoryIds: [repository.id],
    });
  }

  return [...groups.values()];
}

export function describeContextProvenance(sourceType: SourceType): string {
  switch (sourceType) {
    case "manual":
      return "Manual";
    case "inferred":
      return "Inferido";
    case "captured":
      return "Capturado";
    case "imported":
      return "Importado";
    default:
      return sourceType;
  }
}
