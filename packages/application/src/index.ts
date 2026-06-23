import type {
  DailyPlanItem,
  EffectiveGitIdentity,
  EnvironmentProfile,
  ExecutionContext,
  Repository,
  RepositoryContextSnapshot,
  RepositoryIdentity,
  RepositoryIdentityValidation,
  ValidationStatus,
  WorkItem,
  WorkItemDependency,
} from "@wcp/domain";

export interface TodaySummary {
  executableCount: number;
  blockedCount: number;
  doingCount: number;
}

export interface BacklogFilters {
  organizationId?: string;
  projectId?: string;
  repositoryId?: string;
  statuses?: WorkItem["status"][];
}

export interface RecoverableContextCandidate {
  workItemId: string;
  score: number;
  reasons: string[];
}

export function getTodaySummary(items: WorkItem[]): TodaySummary {
  return {
    executableCount: items.filter(isExecutable).length,
    blockedCount: items.filter((item) => item.status === "blocked").length,
    doingCount: items.filter((item) => item.status === "doing").length,
  };
}

export function filterBacklog(
  items: WorkItem[],
  filters: BacklogFilters,
): WorkItem[] {
  return items.filter((item) => {
    if (
      filters.organizationId &&
      item.organizationId !== filters.organizationId
    ) {
      return false;
    }

    if (filters.projectId && item.projectId !== filters.projectId) {
      return false;
    }

    if (
      filters.repositoryId &&
      item.primaryRepositoryId !== filters.repositoryId
    ) {
      return false;
    }

    if (
      filters.statuses &&
      filters.statuses.length > 0 &&
      !filters.statuses.includes(item.status)
    ) {
      return false;
    }

    return true;
  });
}

export function planToday(
  items: WorkItem[],
  dependencies: WorkItemDependency[],
  limit = 3,
): DailyPlanItem[] {
  const blockedIds = new Set(
    dependencies
      .filter((dependency) => dependency.dependencyType === "blocks")
      .map((dependency) => dependency.fromWorkItemId),
  );

  return items
    .filter((item) => !blockedIds.has(item.id))
    .filter(isExecutable)
    .sort((left, right) => left.priority - right.priority)
    .slice(0, limit)
    .map((item, index) => ({
      id: `dpi-${item.id}`,
      dailyPlanId: "generated-plan",
      workItemId: item.id,
      position: index + 1,
      isCommitted: index === 0,
    }));
}

export function suggestRecoverableContext(
  current: WorkItem,
  candidates: WorkItem[],
): RecoverableContextCandidate[] {
  return candidates
    .filter((candidate) => candidate.id !== current.id)
    .map((candidate) => {
      let score = 0;
      const reasons: string[] = [];

      if (
        candidate.primaryRepositoryId &&
        candidate.primaryRepositoryId === current.primaryRepositoryId
      ) {
        score += 40;
        reasons.push("mesmo repositorio");
      }

      if (candidate.projectId && candidate.projectId === current.projectId) {
        score += 25;
        reasons.push("mesmo projeto");
      }

      if (
        candidate.organizationId &&
        candidate.organizationId === current.organizationId
      ) {
        score += 10;
        reasons.push("mesma empresa");
      }

      if (
        candidate.organizationId &&
        candidate.organizationId === current.organizationId &&
        candidate.primaryRepositoryId &&
        candidate.primaryRepositoryId === current.primaryRepositoryId
      ) {
        score += 15;
        reasons.push("mesmo contexto de execucao");
      }

      if (hasTextOverlap(current.title, candidate.title)) {
        score += 12;
        reasons.push("titulo semelhante");
      }

      if (
        candidate.resumeSummary &&
        current.resumeSummary &&
        hasTextOverlap(current.resumeSummary, candidate.resumeSummary)
      ) {
        score += 8;
        reasons.push("resumo de retomada semelhante");
      }

      return {
        workItemId: candidate.id,
        score,
        reasons,
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);
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

export function resolveExecutionContext(
  workItem: WorkItem,
  repository?: Repository | null,
  identity?: RepositoryIdentity | null,
  profile?: EnvironmentProfile | null,
): ExecutionContext {
  return {
    workspaceId: workItem.workspaceId,
    organizationId:
      workItem.organizationId ?? repository?.organizationId ?? null,
    projectId: workItem.projectId ?? repository?.projectId ?? null,
    repositoryId: workItem.primaryRepositoryId ?? repository?.id ?? null,
    effectiveIdentity: resolveEffectiveGitIdentity(
      identity,
      profile,
      repository,
    ),
  };
}

export function validateRepositoryIdentity(
  repository: RepositoryContextSnapshot,
  identity: RepositoryIdentity,
  profile?: EnvironmentProfile | null,
  repositoryRecord?: Repository | null,
): RepositoryIdentityValidation {
  const effective = resolveEffectiveGitIdentity(
    identity,
    profile,
    repositoryRecord,
  );
  const checks: RepositoryIdentityValidation["checks"] = [];

  checks.push(
    compareValue(
      "providerHost",
      effective.providerHost,
      repository.detectedProviderHost,
      "Host do provider",
    ),
    compareValue(
      "gitUserName",
      effective.gitUserName,
      repository.detectedGitUserName,
      "Git user.name",
    ),
    compareValue(
      "gitUserEmail",
      effective.gitUserEmail,
      repository.detectedGitUserEmail,
      "Git user.email",
    ),
    compareValue(
      "sshHostAlias",
      effective.sshHostAlias,
      repository.detectedSshHostAlias,
      "Alias SSH",
    ),
    compareBranchPattern(effective.branchPattern, repository.branchName),
  );

  return {
    status: aggregateStatus(checks.map((check) => check.status)),
    checks,
  };
}

function isExecutable(item: WorkItem): boolean {
  return item.status === "todo" || item.status === "doing";
}

function hasTextOverlap(left: string, right: string): boolean {
  const leftWords = normalize(left).split(" ");
  const rightWords = new Set(normalize(right).split(" "));
  return leftWords.some((word) => word.length > 3 && rightWords.has(word));
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
}

function compareValue(
  key: "providerHost" | "gitUserName" | "gitUserEmail" | "sshHostAlias",
  expected: string | null | undefined,
  actual: string | null | undefined,
  label: string,
): RepositoryIdentityValidation["checks"][number] {
  if (!expected && !actual) {
    return {
      key,
      status: "warning",
      expected: expected ?? null,
      actual: actual ?? null,
      message: `${label} nao configurado`,
    };
  }

  if (expected === actual) {
    return {
      key,
      status: "ok",
      expected: expected ?? null,
      actual: actual ?? null,
      message: `${label} consistente`,
    };
  }

  return {
    key,
    status: "mismatch",
    expected: expected ?? null,
    actual: actual ?? null,
    message: `${label} divergente`,
  };
}

function compareBranchPattern(
  pattern: string | null | undefined,
  branchName: string | null | undefined,
) {
  if (!pattern || !branchName) {
    return {
      key: "branchPattern" as const,
      status: "warning" as ValidationStatus,
      expected: pattern ?? null,
      actual: branchName ?? null,
      message: "Branch pattern nao pode ser validado",
    };
  }

  const matches = new RegExp(pattern).test(branchName);

  return {
    key: "branchPattern" as const,
    status: matches
      ? ("ok" as ValidationStatus)
      : ("warning" as ValidationStatus),
    expected: pattern,
    actual: branchName,
    message: matches
      ? "Branch segue o padrao esperado"
      : "Branch fora do padrao esperado",
  };
}

function aggregateStatus(statuses: ValidationStatus[]): ValidationStatus {
  if (statuses.includes("mismatch")) {
    return "mismatch";
  }

  if (statuses.includes("warning")) {
    return "warning";
  }

  return "ok";
}

export * from "./compose";
