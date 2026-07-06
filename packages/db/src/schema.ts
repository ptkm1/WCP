/**
 * Context hierarchy (local-first, mono or multi-company within one workspace):
 *
 * workspace
 *   └── organization (company / personal / community)
 *         ├── environment_profiles (default Git/SSH identity per org; isDefault)
 *         ├── projects (logical grouping)
 *         └── repositories (Git checkout)
 *               └── repository_identities (1:1; optional overrides + link to profile)
 *
 * work_items link optionally to organization, project, and primary_repository_id.
 *
 * Product questions answered by FKs:
 * - organization_id on projects/repositories/work_items → qual empresa
 * - project_id on repositories/work_items → qual projeto agrupa o repo/tarefa
 * - repository_identities.environment_profile_id → qual perfil Git da empresa
 * - repository_identities overrides → identidade Git efetiva por repo
 * - project.organizationId must match work_item.organizationId when both set
 * - repository.organizationId must match work_item.organizationId when both set
 * - repository.projectId may be null or must match work_item.projectId when both set
 * - repository_identities.environmentProfileId should belong to the same org as the repo
 *
 * Sync classification (future multi-device):
 * - syncable: work_items, knowledge_notes, session_logs, artifacts, entity_links, org/project/repo
 * - deviceLocal: repositories.local_path, environment_profiles.ssh_key_path_ref (resolve per device)
 * - derived: today plan / recoverable context (computed in app memory, not source of truth)
 * - appendOnly: activity_events
 */
import {
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ...timestamps,
});

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  /** Absolute path to logo file in app storage (not a remote URL). */
  logoPath: text("logo_path"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  organizationId: text("organization_id").references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const repositories = sqliteTable("repositories", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  organizationId: text("organization_id").references(() => organizations.id),
  projectId: text("project_id").references(() => projects.id),
  name: text("name").notNull(),
  localPath: text("local_path"),
  providerType: text("provider_type"),
  providerHost: text("provider_host"),
  remoteUrl: text("remote_url"),
  defaultBranch: text("default_branch"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const environmentProfiles = sqliteTable("environment_profiles", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  organizationId: text("organization_id").references(() => organizations.id),
  name: text("name").notNull(),
  providerType: text("provider_type"),
  providerHost: text("provider_host"),
  sshHostAlias: text("ssh_host_alias"),
  sshKeyPathRef: text("ssh_key_path_ref"),
  gitUserName: text("git_user_name"),
  gitUserEmail: text("git_user_email"),
  branchPattern: text("branch_pattern"),
  prConvention: text("pr_convention"),
  commitConvention: text("commit_convention"),
  notesJson: text("notes_json"),
  isDefault: integer("is_default", { mode: "boolean" })
    .notNull()
    .default(false),
  ...timestamps,
});

export const repositoryIdentities = sqliteTable(
  "repository_identities",
  {
    id: text("id").primaryKey(),
    repositoryId: text("repository_id")
      .notNull()
      .references(() => repositories.id),
    environmentProfileId: text("environment_profile_id").references(
      () => environmentProfiles.id,
    ),
    gitUserName: text("git_user_name"),
    gitUserEmail: text("git_user_email"),
    sshHostAlias: text("ssh_host_alias"),
    sshKeyFingerprint: text("ssh_key_fingerprint"),
    providerUsername: text("provider_username"),
    providerAccountLabel: text("provider_account_label"),
    enforcePrePushCheck: integer("enforce_pre_push_check", { mode: "boolean" })
      .notNull()
      .default(true),
    lastValidatedAt: text("last_validated_at"),
    ...timestamps,
  },
  (table) => ({
    repositoryIdUnique: uniqueIndex(
      "repository_identities_repository_id_unique",
    ).on(table.repositoryId),
  }),
);

export const workItems = sqliteTable("work_items", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  organizationId: text("organization_id").references(() => organizations.id),
  projectId: text("project_id").references(() => projects.id),
  primaryRepositoryId: text("primary_repository_id").references(
    () => repositories.id,
  ),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull(),
  priority: integer("priority").notNull().default(3),
  urgency: integer("urgency"),
  effort: integer("effort"),
  scheduledFor: text("scheduled_for"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  blockedReason: text("blocked_reason"),
  resumeSummary: text("resume_summary"),
  sourceType: text("source_type").notNull(),
  externalProvider: text("external_provider"),
  externalId: text("external_id"),
  externalKey: text("external_key"),
  externalUrl: text("external_url"),
  ...timestamps,
});

export const integrationConnections = sqliteTable(
  "integration_connections",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    provider: text("provider").notNull(),
    displayName: text("display_name"),
    configJson: text("config_json").notNull(),
    credentialKey: text("credential_key").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    syncEnabled: integer("sync_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    lastSyncAt: text("last_sync_at"),
    lastSyncError: text("last_sync_error"),
    syncFilterJson: text("sync_filter_json"),
    ...timestamps,
  },
  (table) => ({
    orgProviderUnique: uniqueIndex("integration_connections_org_provider").on(
      table.organizationId,
      table.provider,
    ),
  }),
);

export const workItemRepositories = sqliteTable(
  "work_item_repositories",
  {
    workItemId: text("work_item_id")
      .notNull()
      .references(() => workItems.id),
    repositoryId: text("repository_id")
      .notNull()
      .references(() => repositories.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.workItemId, table.repositoryId] }),
  }),
);

export const workItemDependencies = sqliteTable("work_item_dependencies", {
  id: text("id").primaryKey(),
  fromWorkItemId: text("from_work_item_id")
    .notNull()
    .references(() => workItems.id),
  toWorkItemId: text("to_work_item_id")
    .notNull()
    .references(() => workItems.id),
  dependencyType: text("dependency_type").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const sessionLogs = sqliteTable("session_logs", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  workItemId: text("work_item_id").references(() => workItems.id),
  organizationId: text("organization_id").references(() => organizations.id),
  projectId: text("project_id").references(() => projects.id),
  repositoryId: text("repository_id").references(() => repositories.id),
  branchName: text("branch_name"),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at"),
  goal: text("goal"),
  decisions: text("decisions"),
  result: text("result"),
  linksJson: text("links_json"),
  sourceType: text("source_type").notNull().default("captured"),
  ...timestamps,
});

export const knowledgeNotes = sqliteTable("knowledge_notes", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  noteType: text("note_type").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  sourceType: text("source_type").notNull(),
  ...timestamps,
});

export const artifacts = sqliteTable("artifacts", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  repositoryId: text("repository_id").references(() => repositories.id),
  type: text("type").notNull(),
  title: text("title"),
  externalId: text("external_id"),
  url: text("url"),
  metadataJson: text("metadata_json"),
  sourceType: text("source_type").notNull().default("manual"),
  ...timestamps,
});

export const entityLinks = sqliteTable("entity_links", {
  id: text("id").primaryKey(),
  fromEntityType: text("from_entity_type").notNull(),
  fromEntityId: text("from_entity_id").notNull(),
  toEntityType: text("to_entity_type").notNull(),
  toEntityId: text("to_entity_id").notNull(),
  linkType: text("link_type").notNull(),
  score: real("score"),
  sourceType: text("source_type").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const dailyPlans = sqliteTable("daily_plans", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  planDate: text("plan_date").notNull(),
  summary: text("summary"),
  ...timestamps,
});

export const dailyPlanItems = sqliteTable("daily_plan_items", {
  id: text("id").primaryKey(),
  dailyPlanId: text("daily_plan_id")
    .notNull()
    .references(() => dailyPlans.id),
  workItemId: text("work_item_id")
    .notNull()
    .references(() => workItems.id),
  position: integer("position").notNull(),
  isCommitted: integer("is_committed", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const activityEvents = sqliteTable("activity_events", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  eventType: text("event_type").notNull(),
  payloadJson: text("payload_json"),
  createdAt: text("created_at").notNull(),
});
