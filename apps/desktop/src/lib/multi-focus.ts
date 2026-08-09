import type {
  MultiFocusGroupDto,
  MultiFocusTaskDto,
} from "@/components/today/MultiFocusPromptDialog";

const SNOOZE_PREFIX = "wcp.multiFocus.snooze";

type MultiFocusBacklogTask = {
  id: string;
  title: string;
  status: string;
  externalKey?: string | null;
  organizationId?: string | null;
  projectId?: string | null;
  primaryRepositoryId?: string | null;
  wcpDismissedAt?: string | null;
  wcpInboxAt?: string | null;
};

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function multiFocusSnoozeStorageKey(
  groupKey: string,
  date = new Date(),
): string {
  return `${SNOOZE_PREFIX}.${groupKey}.${localDateKey(date)}`;
}

export function isMultiFocusGroupSnoozed(groupKey: string): boolean {
  try {
    return localStorage.getItem(multiFocusSnoozeStorageKey(groupKey)) === "1";
  } catch {
    return false;
  }
}

export function snoozeMultiFocusGroup(groupKey: string): void {
  try {
    localStorage.setItem(multiFocusSnoozeStorageKey(groupKey), "1");
  } catch {
    // ignore quota / private mode
  }
}

export function firstUnsnoozedMultiFocusGroup(
  groups: MultiFocusGroupDto[] | null | undefined,
): MultiFocusGroupDto | null {
  if (!groups?.length) {
    return null;
  }
  return (
    groups.find((group) => !isMultiFocusGroupSnoozed(group.groupKey)) ?? null
  );
}

export function multiFocusGroupKeyForTask(task: {
  projectId?: string | null;
  primaryRepositoryId?: string | null;
}): string | null {
  const projectId = task.projectId?.trim();
  if (projectId) {
    return `project:${projectId}`;
  }
  const repositoryId = task.primaryRepositoryId?.trim();
  if (repositoryId) {
    return `repository:${repositoryId}`;
  }
  return null;
}

export function buildMultiFocusGroupForTask(
  backlog: MultiFocusBacklogTask[],
  task: MultiFocusBacklogTask,
  meta?: {
    organizationName?: string | null;
    projectName?: string | null;
    repositoryName?: string | null;
  },
): MultiFocusGroupDto | null {
  const groupKey = multiFocusGroupKeyForTask(task);
  if (!groupKey) {
    return null;
  }

  const members = backlog.filter((item) => {
    if (item.wcpDismissedAt || item.wcpInboxAt || item.status === "archived") {
      return false;
    }
    if (item.id === task.id) {
      return true;
    }
    if (item.status !== "doing") {
      return false;
    }
    return multiFocusGroupKeyForTask(item) === groupKey;
  });

  if (members.length < 2) {
    return null;
  }

  const tasks: MultiFocusTaskDto[] = members
    .map((item) => ({
      id: item.id,
      title: item.title,
      externalKey: item.externalKey,
    }))
    .sort((left, right) => left.title.localeCompare(right.title));

  return {
    groupKey,
    organizationId: task.organizationId,
    organizationName: meta?.organizationName ?? null,
    projectId: task.projectId,
    projectName: meta?.projectName ?? null,
    repositoryId: task.primaryRepositoryId,
    repositoryName: meta?.repositoryName ?? null,
    tasks,
  };
}

export function findMultiFocusGroupForTask(
  groups: MultiFocusGroupDto[] | null | undefined,
  task: {
    id: string;
    projectId?: string | null;
    primaryRepositoryId?: string | null;
  },
): MultiFocusGroupDto | null {
  if (!groups?.length) {
    return null;
  }

  const groupKey = multiFocusGroupKeyForTask(task);
  if (groupKey) {
    const byKey = groups.find((group) => group.groupKey === groupKey);
    if (byKey) {
      return byKey;
    }
  }

  return (
    groups.find((group) => group.tasks.some((entry) => entry.id === task.id)) ??
    null
  );
}
