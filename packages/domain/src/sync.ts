import type { SourceType } from "./index";

export type SyncScope = "syncable" | "deviceLocal" | "derived" | "appendOnly";

export type SyncEntityName =
  | "workspace"
  | "organization"
  | "project"
  | "repository"
  | "environmentProfile"
  | "repositoryIdentity"
  | "workItem"
  | "workItemRepository"
  | "workItemDependency"
  | "sessionLog"
  | "knowledgeNote"
  | "artifact"
  | "entityLink"
  | "dailyPlan"
  | "dailyPlanItem"
  | "activityEvent"
  | "integrationConnection";

export const ENTITY_SYNC_PROFILE: Record<SyncEntityName, SyncScope> = {
  workspace: "syncable",
  organization: "syncable",
  project: "syncable",
  repository: "syncable",
  environmentProfile: "syncable",
  repositoryIdentity: "syncable",
  workItem: "syncable",
  workItemRepository: "syncable",
  workItemDependency: "syncable",
  sessionLog: "syncable",
  knowledgeNote: "syncable",
  artifact: "syncable",
  entityLink: "syncable",
  dailyPlan: "syncable",
  dailyPlanItem: "syncable",
  activityEvent: "appendOnly",
  integrationConnection: "syncable",
};

export const DEVICE_LOCAL_FIELDS = [
  "repositories.localPath",
  "environmentProfiles.sshKeyPathRef",
] as const;

export const DERIVED_RUNTIME_VIEWS = [
  "buildTodayPlan",
  "buildRecoverableContext",
  "buildTodayFocus",
] as const;

export interface SyncProvenance {
  workspaceId: string;
  sourceType: SourceType;
  createdAt: string;
  updatedAt: string;
}

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  manual: "Manual",
  imported: "Importado",
  inferred: "Inferido",
  captured: "Capturado",
};

export function getEntitySyncScope(entity: SyncEntityName): SyncScope {
  return ENTITY_SYNC_PROFILE[entity];
}

export function formatSourceTypeLabel(sourceType: string): string {
  if (sourceType in SOURCE_TYPE_LABELS) {
    return SOURCE_TYPE_LABELS[sourceType as SourceType];
  }

  return sourceType;
}
