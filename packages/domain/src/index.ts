/**
 * Local-first domain types.
 *
 * Sync-ready records carry workspaceId, sourceType, createdAt and updatedAt.
 * Device-local values (repository localPath, SSH key paths) must not replicate
 * literally between devices — resolve them per device at sync time.
 *
 * Derived views (today plan, recoverable context) are computed in memory and
 * are not persisted as source of truth.
 */
export type Id = string;
export type Timestamp = string;

export type SourceType = "manual" | "imported" | "inferred" | "captured";
export type OrganizationKind = "company" | "personal" | "community";
export type ProviderType =
  | "github"
  | "gitlab"
  | "bitbucket"
  | "gitea"
  | "azure"
  | "other";
export type WorkItemStatus =
  | "backlog"
  | "todo"
  | "doing"
  | "blocked"
  | "done"
  | "archived";
export type DependencyType =
  | "blocks"
  | "relates_to"
  | "duplicates"
  | "caused_by";
export type ArtifactType =
  | "pr"
  | "commit"
  | "ticket"
  | "doc"
  | "figma"
  | "endpoint"
  | "file"
  | "link"
  | "branch";
export type NoteType =
  | "decision"
  | "pattern"
  | "issue"
  | "command"
  | "checklist"
  | "summary";
export type EntityType =
  | "organization"
  | "project"
  | "repository"
  | "work_item"
  | "session_log"
  | "artifact";
export type ValidationStatus = "ok" | "warning" | "mismatch";

export interface Workspace {
  id: Id;
  name: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Organization {
  id: Id;
  workspaceId: Id;
  name: string;
  kind: OrganizationKind;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Project {
  id: Id;
  workspaceId: Id;
  organizationId?: Id | null;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Repository {
  id: Id;
  workspaceId: Id;
  organizationId?: Id | null;
  projectId?: Id | null;
  name: string;
  localPath?: string | null;
  providerType?: ProviderType | null;
  providerHost?: string | null;
  remoteUrl?: string | null;
  defaultBranch?: string | null;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface EnvironmentProfile {
  id: Id;
  workspaceId: Id;
  organizationId?: Id | null;
  name: string;
  providerType?: ProviderType | null;
  providerHost?: string | null;
  sshHostAlias?: string | null;
  sshKeyPathRef?: string | null;
  gitUserName?: string | null;
  gitUserEmail?: string | null;
  branchPattern?: string | null;
  prConvention?: string | null;
  commitConvention?: string | null;
  notesJson?: string | null;
  isDefault?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface RepositoryIdentity {
  id: Id;
  repositoryId: Id;
  environmentProfileId?: Id | null;
  gitUserName?: string | null;
  gitUserEmail?: string | null;
  sshHostAlias?: string | null;
  sshKeyFingerprint?: string | null;
  providerUsername?: string | null;
  providerAccountLabel?: string | null;
  enforcePrePushCheck: boolean;
  lastValidatedAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface WorkItem {
  id: Id;
  workspaceId: Id;
  organizationId?: Id | null;
  projectId?: Id | null;
  primaryRepositoryId?: Id | null;
  title: string;
  description?: string | null;
  status: WorkItemStatus;
  priority: number;
  urgency?: number | null;
  effort?: number | null;
  scheduledFor?: string | null;
  startedAt?: Timestamp | null;
  completedAt?: Timestamp | null;
  blockedReason?: string | null;
  resumeSummary?: string | null;
  sourceType: SourceType;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface WorkItemDependency {
  id: Id;
  fromWorkItemId: Id;
  toWorkItemId: Id;
  dependencyType: DependencyType;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SessionLog {
  id: Id;
  workspaceId: Id;
  workItemId?: Id | null;
  organizationId?: Id | null;
  projectId?: Id | null;
  repositoryId?: Id | null;
  branchName?: string | null;
  startedAt: Timestamp;
  endedAt?: Timestamp | null;
  goal?: string | null;
  decisions?: string | null;
  result?: string | null;
  linksJson?: string | null;
  sourceType: SourceType;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface KnowledgeNote {
  id: Id;
  workspaceId: Id;
  entityType: EntityType;
  entityId: Id;
  noteType: NoteType;
  title: string;
  content: string;
  sourceType: SourceType;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Artifact {
  id: Id;
  workspaceId: Id;
  repositoryId?: Id | null;
  type: ArtifactType;
  title?: string | null;
  externalId?: string | null;
  url?: string | null;
  metadataJson?: string | null;
  sourceType: SourceType;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface EntityLink {
  id: Id;
  fromEntityType: EntityType;
  fromEntityId: Id;
  toEntityType: EntityType;
  toEntityId: Id;
  linkType:
    | "related"
    | "references"
    | "implements"
    | "blocked_by"
    | "learned_from";
  score?: number | null;
  sourceType: SourceType;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DailyPlan {
  id: Id;
  workspaceId: Id;
  planDate: string;
  summary?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DailyPlanItem {
  id: Id;
  dailyPlanId: Id;
  workItemId: Id;
  position: number;
  isCommitted: boolean;
}

export interface RepositoryContextSnapshot {
  repositoryId: Id;
  repositoryName: string;
  branchName?: string | null;
  detectedProviderHost?: string | null;
  detectedGitUserName?: string | null;
  detectedGitUserEmail?: string | null;
  detectedSshHostAlias?: string | null;
}

export interface RepositoryIdentityValidation {
  status: ValidationStatus;
  checks: Array<{
    key:
      | "providerHost"
      | "gitUserName"
      | "gitUserEmail"
      | "sshHostAlias"
      | "branchPattern";
    status: ValidationStatus;
    expected?: string | null;
    actual?: string | null;
    message: string;
  }>;
}

export interface EffectiveGitIdentity {
  environmentProfileId?: Id | null;
  environmentName?: string | null;
  providerHost?: string | null;
  gitUserName?: string | null;
  gitUserEmail?: string | null;
  sshHostAlias?: string | null;
  branchPattern?: string | null;
  providerUsername?: string | null;
  providerAccountLabel?: string | null;
}

export interface ExecutionContext {
  workspaceId: Id;
  organizationId?: Id | null;
  projectId?: Id | null;
  repositoryId?: Id | null;
  effectiveIdentity?: EffectiveGitIdentity | null;
}

const now = "2026-06-22T21:50:00.000Z";

export const sampleRepositories: Repository[] = [
  {
    id: "repo-auth-api",
    workspaceId: "ws-1",
    organizationId: "org-a",
    projectId: "proj-iam",
    name: "auth-api",
    localPath: "/Users/goker/Code/auth-api",
    providerType: "github",
    providerHost: "github.empresa-a.com",
    remoteUrl: "git@empresaA-github:iam/auth-api.git",
    defaultBranch: "main",
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "repo-web-app",
    workspaceId: "ws-1",
    organizationId: "org-b",
    projectId: "proj-web",
    name: "web-app",
    localPath: "/Users/goker/Code/web-app",
    providerType: "github",
    providerHost: "github.com",
    remoteUrl: "git@github.com:empresa-b/web-app.git",
    defaultBranch: "main",
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
];

export const sampleWorkItems: WorkItem[] = [
  {
    id: "wi-1",
    workspaceId: "ws-1",
    title: "Corrigir login SSO",
    description: "Race condition no refresh token sob alta concorrencia.",
    status: "doing",
    priority: 1,
    organizationId: "org-a",
    projectId: "proj-iam",
    primaryRepositoryId: "repo-auth-api",
    resumeSummary:
      "Ultima sessao reproduziu a falha e isolou a ordem incorreta de invalidacao.",
    sourceType: "manual",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "wi-2",
    workspaceId: "ws-1",
    title: "Revisar PR de onboarding",
    description: "Revisar branch de fluxo inicial do app web.",
    status: "todo",
    priority: 2,
    organizationId: "org-b",
    projectId: "proj-web",
    primaryRepositoryId: "repo-web-app",
    sourceType: "imported",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "wi-3",
    workspaceId: "ws-1",
    title: "Refatorar billing worker",
    description: "Separar pipeline de cobranca em jobs menores.",
    status: "blocked",
    priority: 1,
    organizationId: "org-a",
    blockedReason: "Aguardando definicao da task #128.",
    sourceType: "manual",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "wi-4",
    workspaceId: "ws-1",
    title: "Atualizar script de deploy",
    description: "Ajustar shell script para novo host.",
    status: "backlog",
    priority: 3,
    organizationId: "org-a",
    primaryRepositoryId: "repo-auth-api",
    sourceType: "captured",
    createdAt: now,
    updatedAt: now,
  },
];

export const sampleWorkItemDependencies: WorkItemDependency[] = [
  {
    id: "dep-1",
    fromWorkItemId: "wi-3",
    toWorkItemId: "wi-1",
    dependencyType: "blocks",
    createdAt: now,
  },
];

export const sampleEnvironmentProfiles: EnvironmentProfile[] = [
  {
    id: "env-1",
    workspaceId: "ws-1",
    organizationId: "org-a",
    name: "Empresa A",
    providerType: "github",
    providerHost: "github.empresa-a.com",
    sshHostAlias: "empresaA-github",
    gitUserName: "ptkm1",
    gitUserEmail: "dev@empresa-a.com",
    branchPattern: "^(feat|fix|chore)/.+$",
    prConvention: "PR com ticket no titulo",
    commitConvention: "conventional commits",
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "env-2",
    workspaceId: "ws-1",
    organizationId: "org-b",
    name: "Empresa B",
    providerType: "github",
    providerHost: "github.com",
    sshHostAlias: "github.com",
    gitUserName: "goker-b",
    gitUserEmail: "dev@empresa-b.com",
    branchPattern: "^(feat|fix|chore)/.+$",
    prConvention: "PR com review obrigatorio",
    commitConvention: "conventional commits",
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
];

export const sampleRepositoryIdentities: RepositoryIdentity[] = [
  {
    id: "rid-1",
    repositoryId: "repo-auth-api",
    environmentProfileId: "env-1",
    gitUserName: "ptkm1",
    gitUserEmail: "dev@empresa-a.com",
    sshHostAlias: "empresaA-github",
    providerUsername: "ptkm1",
    providerAccountLabel: "empresa-a",
    enforcePrePushCheck: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "rid-2",
    repositoryId: "repo-web-app",
    environmentProfileId: "env-2",
    gitUserName: "goker-b",
    gitUserEmail: "dev@empresa-b.com",
    sshHostAlias: "github.com",
    providerUsername: "goker-b",
    providerAccountLabel: "empresa-b",
    enforcePrePushCheck: true,
    createdAt: now,
    updatedAt: now,
  },
];

export * from "./sync";
