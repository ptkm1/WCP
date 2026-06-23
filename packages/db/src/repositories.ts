import type {
  EnvironmentProfile,
  Repository,
  RepositoryIdentity,
  WorkItem,
  WorkItemStatus,
} from "@wcp/domain";
import {
  formatSourceTypeLabel,
  getEntitySyncScope,
  type SyncEntityName,
  type SyncScope,
} from "@wcp/domain";
import { execute, queryJson } from "./client";

export {
  formatSourceTypeLabel,
  getEntitySyncScope,
  type SyncEntityName,
  type SyncScope,
};

export interface WorkItemRecord extends WorkItem {}
export interface RepositoryRecord extends Repository {}
export interface RepositoryIdentityRecord extends RepositoryIdentity {}
export interface EnvironmentProfileRecord extends EnvironmentProfile {}

export interface RepositoryIdentityBundle {
  repository: RepositoryRecord;
  identity: RepositoryIdentityRecord | null;
  profile: EnvironmentProfileRecord | null;
}

export interface ListWorkItemsOptions {
  organizationId?: string;
  projectId?: string;
  repositoryId?: string;
  statuses?: WorkItemStatus[];
}

export function listWorkItems(
  options: ListWorkItemsOptions = {},
): WorkItemRecord[] {
  const where = buildWhereClause([
    compare("organization_id", options.organizationId),
    compare("project_id", options.projectId),
    compare("primary_repository_id", options.repositoryId),
    options.statuses && options.statuses.length > 0
      ? `status IN (${options.statuses.map((status) => quote(status)).join(", ")})`
      : null,
  ]);

  return queryJson<WorkItemRow>(`
    SELECT
      id,
      workspace_id,
      organization_id,
      project_id,
      primary_repository_id,
      title,
      description,
      status,
      priority,
      urgency,
      effort,
      scheduled_for,
      started_at,
      completed_at,
      blocked_reason,
      resume_summary,
      source_type,
      created_at,
      updated_at
    FROM work_items
    ${where}
    ORDER BY priority ASC, updated_at DESC;
  `).map(mapWorkItem);
}

export function getWorkItemById(id: string): WorkItemRecord | null {
  const rows = queryJson<WorkItemRow>(`
    SELECT
      id,
      workspace_id,
      organization_id,
      project_id,
      primary_repository_id,
      title,
      description,
      status,
      priority,
      urgency,
      effort,
      scheduled_for,
      started_at,
      completed_at,
      blocked_reason,
      resume_summary,
      source_type,
      created_at,
      updated_at
    FROM work_items
    WHERE id = ${quote(id)}
    LIMIT 1;
  `);

  return rows[0] ? mapWorkItem(rows[0]) : null;
}

export function listRepositories(): RepositoryRecord[] {
  return queryJson<RepositoryRow>(`
    SELECT
      id,
      workspace_id,
      organization_id,
      project_id,
      name,
      local_path,
      provider_type,
      provider_host,
      remote_url,
      default_branch,
      is_active,
      created_at,
      updated_at
    FROM repositories
    ORDER BY name ASC;
  `).map(mapRepository);
}

export function resolveWorkspaceId(): string | null {
  const rows = queryJson<{ id: string }>(`
    SELECT id
    FROM workspaces
    ORDER BY created_at ASC
    LIMIT 1;
  `);

  return rows[0]?.id ?? null;
}

export function getDefaultEnvironmentProfile(
  organizationId: string,
): EnvironmentProfileRecord | null {
  const rows = queryJson<EnvironmentProfileRow>(`
    SELECT
      id,
      workspace_id,
      organization_id,
      name,
      provider_type,
      provider_host,
      ssh_host_alias,
      ssh_key_path_ref,
      git_user_name,
      git_user_email,
      branch_pattern,
      pr_convention,
      commit_convention,
      notes_json,
      is_default,
      created_at,
      updated_at
    FROM environment_profiles
    WHERE organization_id = ${quote(organizationId)}
    ORDER BY is_default DESC, name ASC
    LIMIT 1;
  `);

  return rows[0] ? mapEnvironmentProfile(rows[0]) : null;
}

export function getRepositoryIdentityBundle(
  repositoryId: string,
): RepositoryIdentityBundle | null {
  const rows = queryJson<RepositoryBundleRow>(`
    SELECT
      r.id AS repository_id,
      r.workspace_id,
      r.organization_id,
      r.project_id,
      r.name,
      r.local_path,
      r.provider_type,
      r.provider_host,
      r.remote_url,
      r.default_branch,
      r.is_active,
      r.created_at,
      r.updated_at,
      ri.id AS identity_id,
      ri.environment_profile_id,
      ri.git_user_name,
      ri.git_user_email,
      ri.ssh_host_alias,
      ri.ssh_key_fingerprint,
      ri.provider_username,
      ri.provider_account_label,
      ri.enforce_pre_push_check,
      ri.last_validated_at,
      ri.created_at AS identity_created_at,
      ri.updated_at AS identity_updated_at,
      ep.id AS profile_id,
      ep.workspace_id AS profile_workspace_id,
      ep.organization_id AS profile_organization_id,
      ep.name AS profile_name,
      ep.provider_type AS profile_provider_type,
      ep.provider_host AS profile_provider_host,
      ep.ssh_host_alias AS profile_ssh_host_alias,
      ep.ssh_key_path_ref AS profile_ssh_key_path_ref,
      ep.git_user_name AS profile_git_user_name,
      ep.git_user_email AS profile_git_user_email,
      ep.branch_pattern AS profile_branch_pattern,
      ep.pr_convention AS profile_pr_convention,
      ep.commit_convention AS profile_commit_convention,
      ep.notes_json AS profile_notes_json,
      ep.is_default AS profile_is_default,
      ep.created_at AS profile_created_at,
      ep.updated_at AS profile_updated_at
    FROM repositories r
    LEFT JOIN repository_identities ri ON ri.repository_id = r.id
    LEFT JOIN environment_profiles ep ON ep.id = ri.environment_profile_id
    WHERE r.id = ${quote(repositoryId)}
    LIMIT 1;
  `);

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    repository: mapRepository({
      id: row.repository_id,
      workspace_id: row.workspace_id,
      organization_id: row.organization_id,
      project_id: row.project_id,
      name: row.name,
      local_path: row.local_path,
      provider_type: row.provider_type,
      provider_host: row.provider_host,
      remote_url: row.remote_url,
      default_branch: row.default_branch,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }),
    identity: row.identity_id
      ? {
          id: row.identity_id,
          repositoryId: row.repository_id,
          environmentProfileId: row.environment_profile_id,
          gitUserName: nullableString(row.git_user_name),
          gitUserEmail: nullableString(row.git_user_email),
          sshHostAlias: nullableString(row.ssh_host_alias),
          sshKeyFingerprint: nullableString(row.ssh_key_fingerprint),
          providerUsername: nullableString(row.provider_username),
          providerAccountLabel: nullableString(row.provider_account_label),
          enforcePrePushCheck: toBoolean(row.enforce_pre_push_check),
          lastValidatedAt: nullableString(row.last_validated_at),
          createdAt: String(row.identity_created_at),
          updatedAt: String(row.identity_updated_at),
        }
      : null,
    profile: row.profile_id
      ? mapEnvironmentProfile({
          id: row.profile_id,
          workspace_id: row.profile_workspace_id!,
          organization_id: row.profile_organization_id,
          name: row.profile_name!,
          provider_type: row.profile_provider_type,
          provider_host: row.profile_provider_host,
          ssh_host_alias: row.profile_ssh_host_alias,
          ssh_key_path_ref: row.profile_ssh_key_path_ref,
          git_user_name: row.profile_git_user_name,
          git_user_email: row.profile_git_user_email,
          branch_pattern: row.profile_branch_pattern,
          pr_convention: row.profile_pr_convention,
          commit_convention: row.profile_commit_convention,
          notes_json: row.profile_notes_json,
          is_default: row.profile_is_default,
          created_at: row.profile_created_at!,
          updated_at: row.profile_updated_at!,
        })
      : null,
  };
}

export function upsertRepositoryIdentity(
  identity: RepositoryIdentityRecord,
  repositoryId = identity.repositoryId,
): void {
  execute(`
    INSERT OR REPLACE INTO repository_identities (
      id,
      repository_id,
      environment_profile_id,
      git_user_name,
      git_user_email,
      ssh_host_alias,
      ssh_key_fingerprint,
      provider_username,
      provider_account_label,
      enforce_pre_push_check,
      last_validated_at,
      created_at,
      updated_at
    ) VALUES (
      ${quote(identity.id)},
      ${quote(repositoryId)},
      ${nullable(identity.environmentProfileId)},
      ${nullable(identity.gitUserName)},
      ${nullable(identity.gitUserEmail)},
      ${nullable(identity.sshHostAlias)},
      ${nullable(identity.sshKeyFingerprint)},
      ${nullable(identity.providerUsername)},
      ${nullable(identity.providerAccountLabel)},
      ${identity.enforcePrePushCheck ? 1 : 0},
      ${nullable(identity.lastValidatedAt)},
      ${quote(identity.createdAt)},
      ${quote(identity.updatedAt)}
    );
  `);
}

interface WorkItemRow {
  id: string;
  workspace_id: string;
  organization_id: string | null;
  project_id: string | null;
  primary_repository_id: string | null;
  title: string;
  description: string | null;
  status: WorkItemStatus;
  priority: number | string;
  urgency: number | string | null;
  effort: number | string | null;
  scheduled_for: string | null;
  started_at: string | null;
  completed_at: string | null;
  blocked_reason: string | null;
  resume_summary: string | null;
  source_type: WorkItem["sourceType"];
  created_at: string;
  updated_at: string;
}

interface RepositoryRow {
  id: string;
  workspace_id: string;
  organization_id: string | null;
  project_id: string | null;
  name: string;
  local_path: string | null;
  provider_type: Repository["providerType"] | null;
  provider_host: string | null;
  remote_url: string | null;
  default_branch: string | null;
  is_active: number | string;
  created_at: string;
  updated_at: string;
}

interface RepositoryBundleRow extends RepositoryRow {
  repository_id: string;
  identity_id: string | null;
  environment_profile_id: string | null;
  git_user_name: string | null;
  git_user_email: string | null;
  ssh_host_alias: string | null;
  ssh_key_fingerprint: string | null;
  provider_username: string | null;
  provider_account_label: string | null;
  enforce_pre_push_check: number | string | null;
  last_validated_at: string | null;
  identity_created_at: string | null;
  identity_updated_at: string | null;
  profile_id: string | null;
  profile_workspace_id: string | null;
  profile_organization_id: string | null;
  profile_name: string | null;
  profile_provider_type: EnvironmentProfile["providerType"] | null;
  profile_provider_host: string | null;
  profile_ssh_host_alias: string | null;
  profile_ssh_key_path_ref: string | null;
  profile_git_user_name: string | null;
  profile_git_user_email: string | null;
  profile_branch_pattern: string | null;
  profile_pr_convention: string | null;
  profile_commit_convention: string | null;
  profile_notes_json: string | null;
  profile_is_default: number | string | null;
  profile_created_at: string | null;
  profile_updated_at: string | null;
}

interface EnvironmentProfileRow {
  id: string;
  workspace_id: string;
  organization_id: string | null;
  name: string;
  provider_type: EnvironmentProfile["providerType"] | null;
  provider_host: string | null;
  ssh_host_alias: string | null;
  ssh_key_path_ref: string | null;
  git_user_name: string | null;
  git_user_email: string | null;
  branch_pattern: string | null;
  pr_convention: string | null;
  commit_convention: string | null;
  notes_json: string | null;
  is_default: number | string | null;
  created_at: string;
  updated_at: string;
}

function mapWorkItem(row: WorkItemRow): WorkItemRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    organizationId: nullableString(row.organization_id),
    projectId: nullableString(row.project_id),
    primaryRepositoryId: nullableString(row.primary_repository_id),
    title: row.title,
    description: nullableString(row.description),
    status: row.status,
    priority: toNumber(row.priority),
    urgency: nullableNumber(row.urgency),
    effort: nullableNumber(row.effort),
    scheduledFor: nullableString(row.scheduled_for),
    startedAt: nullableString(row.started_at),
    completedAt: nullableString(row.completed_at),
    blockedReason: nullableString(row.blocked_reason),
    resumeSummary: nullableString(row.resume_summary),
    sourceType: row.source_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRepository(row: RepositoryRow): RepositoryRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    organizationId: nullableString(row.organization_id),
    projectId: nullableString(row.project_id),
    name: row.name,
    localPath: nullableString(row.local_path),
    providerType: row.provider_type,
    providerHost: nullableString(row.provider_host),
    remoteUrl: nullableString(row.remote_url),
    defaultBranch: nullableString(row.default_branch),
    isActive: toBoolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEnvironmentProfile(
  row: EnvironmentProfileRow,
): EnvironmentProfileRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    organizationId: nullableString(row.organization_id),
    name: row.name,
    providerType: row.provider_type,
    providerHost: nullableString(row.provider_host),
    sshHostAlias: nullableString(row.ssh_host_alias),
    sshKeyPathRef: nullableString(row.ssh_key_path_ref),
    gitUserName: nullableString(row.git_user_name),
    gitUserEmail: nullableString(row.git_user_email),
    branchPattern: nullableString(row.branch_pattern),
    prConvention: nullableString(row.pr_convention),
    commitConvention: nullableString(row.commit_convention),
    notesJson: nullableString(row.notes_json),
    isDefault: toBoolean(row.is_default),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildWhereClause(fragments: Array<string | null>): string {
  const clauses = fragments.filter(Boolean);
  return clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
}

function compare(column: string, value?: string | null): string | null {
  return value ? `${column} = ${quote(value)}` : null;
}

function quote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function nullable(value: string | null | undefined): string {
  return value ? quote(value) : "NULL";
}

function toNumber(value: string | number): number {
  return typeof value === "number" ? value : Number(value);
}

function nullableNumber(value: string | number | null): number | null {
  return value === null ? null : toNumber(value);
}

function nullableString(value: string | null): string | null {
  return value ?? null;
}

export interface WorkItemContextLinkInput {
  organizationId?: string | null;
  projectId?: string | null;
  primaryRepositoryId?: string | null;
}

export interface WorkItemContextEntityRefs {
  projects: Map<string, { organizationId?: string | null }>;
  repositories: Map<
    string,
    { organizationId?: string | null; projectId?: string | null }
  >;
}

export function validateWorkItemContextLinks(
  input: WorkItemContextLinkInput,
  refs: WorkItemContextEntityRefs,
): string[] {
  const errors: string[] = [];
  const organizationId = input.organizationId?.trim() || null;
  const projectId = input.projectId?.trim() || null;
  const repositoryId = input.primaryRepositoryId?.trim() || null;
  let resolvedOrganizationId = organizationId;

  if (projectId) {
    const project = refs.projects.get(projectId);
    if (!project) {
      errors.push("Projeto nao encontrado.");
    } else if (
      resolvedOrganizationId &&
      project.organizationId &&
      project.organizationId !== resolvedOrganizationId
    ) {
      errors.push("O projeto selecionado pertence a outra empresa.");
    } else if (!resolvedOrganizationId && project.organizationId) {
      resolvedOrganizationId = project.organizationId;
    }
  }

  if (repositoryId) {
    const repository = refs.repositories.get(repositoryId);
    if (!repository) {
      errors.push("Repositorio nao encontrado.");
    } else {
      if (
        resolvedOrganizationId &&
        repository.organizationId &&
        repository.organizationId !== resolvedOrganizationId
      ) {
        errors.push("Repositorio pertence a outra empresa.");
      }

      if (
        projectId &&
        repository.projectId &&
        repository.projectId !== projectId
      ) {
        errors.push("Repositorio nao esta vinculado ao projeto selecionado.");
      }
    }
  }

  return errors;
}

function toBoolean(value: string | number | null): boolean {
  return value === 1 || value === "1";
}
