import type {
  EnvironmentProfile,
  Repository,
  RepositoryContextSnapshot,
  RepositoryIdentity,
  RepositoryIdentityValidation,
  WorkItem,
  WorkItemDependency,
} from "@wcp/domain";
import {
  getTodaySummary,
  planToday,
  suggestRecoverableContext,
  validateRepositoryIdentity,
} from "./index";

export interface DashboardData {
  summary: ReturnType<typeof getTodaySummary>;
  todayPlan: ReturnType<typeof planToday>;
  recoverableContext: ReturnType<typeof suggestRecoverableContext>;
  identityValidation: RepositoryIdentityValidation | null;
}

export function buildDashboardData(input: {
  workItems: WorkItem[];
  dependencies: WorkItemDependency[];
  currentTask: WorkItem;
  repositorySnapshot?: RepositoryContextSnapshot | null;
  repositoryIdentity?: RepositoryIdentity | null;
  environmentProfile?: EnvironmentProfile | null;
  repository?: Repository | null;
}): DashboardData {
  return {
    summary: getTodaySummary(input.workItems),
    todayPlan: planToday(input.workItems, input.dependencies, 3),
    recoverableContext: suggestRecoverableContext(
      input.currentTask,
      input.workItems,
    ).slice(0, 3),
    identityValidation:
      input.repositorySnapshot && input.repositoryIdentity
        ? validateRepositoryIdentity(
            input.repositorySnapshot,
            input.repositoryIdentity,
            input.environmentProfile,
            input.repository,
          )
        : null,
  };
}
