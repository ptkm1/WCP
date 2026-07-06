import type {
  ExternalTaskSnapshot,
  PmProvider,
  WorkItemStatus,
} from "@wcp/domain";

export interface JiraIssueFields {
  summary?: string;
  description?: unknown;
  status?: { name?: string };
  duedate?: string | null;
  priority?: { name?: string; id?: string };
}

export interface JiraIssuePayload {
  id: string;
  key: string;
  self?: string;
  fields?: JiraIssueFields;
}

export interface ClickUpTaskPayload {
  id: string;
  name?: string;
  description?: string | null;
  status?: { status?: string; type?: string };
  due_date?: string | null;
  priority?: { priority?: string } | null;
  url?: string;
}

export function normalizePmStatus(
  provider: PmProvider,
  statusLabel: string,
): WorkItemStatus {
  const normalized = statusLabel.trim().toLowerCase();

  if (provider === "clickup") {
    if (normalized.includes("closed") || normalized.includes("complete")) {
      return "done";
    }
    if (normalized.includes("progress")) {
      return "doing";
    }
    if (normalized.includes("block")) {
      return "blocked";
    }
    if (normalized.includes("open") || normalized.includes("to do")) {
      return "todo";
    }
    return "backlog";
  }

  if (
    normalized.includes("done") ||
    normalized.includes("closed") ||
    normalized.includes("resolved")
  ) {
    return "done";
  }
  if (normalized.includes("progress") || normalized.includes("doing")) {
    return "doing";
  }
  if (normalized.includes("block")) {
    return "blocked";
  }
  if (
    normalized.includes("to do") ||
    normalized === "todo" ||
    normalized === "open"
  ) {
    return "todo";
  }
  return "backlog";
}

export function mapJiraIssueToWorkItemPatch(issue: JiraIssuePayload) {
  const fields = issue.fields ?? {};
  const statusLabel = fields.status?.name ?? "Unknown";
  const siteUrl = issue.self?.split("/rest/")[0];
  const externalUrl =
    siteUrl && issue.key
      ? `${siteUrl}/browse/${issue.key}`
      : (issue.self ?? null);

  return {
    externalProvider: "jira" as const,
    externalId: issue.id,
    externalKey: issue.key,
    externalUrl,
    title: fields.summary ?? issue.key,
    description: extractJiraDescription(fields.description),
    status: normalizePmStatus("jira", statusLabel),
    scheduledFor: fields.duedate ?? null,
    priority: mapJiraPriority(fields.priority?.id),
    sourceType: "imported" as const,
  };
}

export function mapClickUpTaskToWorkItemPatch(task: ClickUpTaskPayload) {
  const statusLabel = task.status?.status ?? task.status?.type ?? "Unknown";

  return {
    externalProvider: "clickup" as const,
    externalId: task.id,
    externalKey: task.id,
    externalUrl: task.url ?? null,
    title: task.name ?? task.id,
    description: task.description ?? null,
    status: normalizePmStatus("clickup", statusLabel),
    scheduledFor: clickUpDueDateToIso(task.due_date),
    priority: mapClickUpPriority(task.priority?.priority),
    sourceType: "imported" as const,
  };
}

function extractJiraDescription(description: unknown): string | null {
  if (typeof description === "string") {
    return description.trim() || null;
  }
  return null;
}

function mapJiraPriority(priorityId?: string): number {
  switch (priorityId) {
    case "1":
      return 1;
    case "2":
      return 2;
    case "3":
      return 3;
    case "4":
      return 4;
    case "5":
      return 5;
    default:
      return 3;
  }
}

function mapClickUpPriority(priority?: string): number {
  switch (priority) {
    case "urgent":
      return 1;
    case "high":
      return 2;
    case "normal":
      return 3;
    case "low":
      return 4;
    default:
      return 3;
  }
}

function clickUpDueDateToIso(dueDate?: string | null): string | null {
  if (!dueDate) {
    return null;
  }
  const parsed = Number(dueDate);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return new Date(parsed).toISOString().slice(0, 10);
}

export type DeadlineAlertKind = "overdue" | "due_today" | "due_soon";

export interface DeadlineAlertItem {
  workItemId: string;
  title: string;
  scheduledFor: string;
  externalProvider?: string | null;
  externalUrl?: string | null;
  kind: DeadlineAlertKind;
  hoursUntilDue: number;
}

export interface DeadlineAlertsResult {
  overdue: DeadlineAlertItem[];
  dueToday: DeadlineAlertItem[];
  dueSoon: DeadlineAlertItem[];
  items: DeadlineAlertItem[];
}

export interface WorkItemDeadlineInput {
  id: string;
  title: string;
  status: string;
  scheduledFor?: string | null;
  sourceType?: string | null;
  externalProvider?: string | null;
  externalUrl?: string | null;
}

export function buildDeadlineAlerts(
  workItems: WorkItemDeadlineInput[],
  options?: {
    thresholdsHours?: number[];
    now?: Date;
  },
): DeadlineAlertsResult {
  const now = options?.now ?? new Date();
  const thresholds = options?.thresholdsHours ?? [24, 48, 168];
  const maxThreshold = Math.max(...thresholds, 24);

  const overdue: DeadlineAlertItem[] = [];
  const dueToday: DeadlineAlertItem[] = [];
  const dueSoon: DeadlineAlertItem[] = [];

  for (const item of workItems) {
    if (!item.scheduledFor?.trim()) {
      continue;
    }
    if (item.status === "done" || item.status === "archived") {
      continue;
    }

    const due = parseScheduledDate(item.scheduledFor);
    if (!due) {
      continue;
    }

    const hoursUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
    const alertBase = {
      workItemId: item.id,
      title: item.title,
      scheduledFor: item.scheduledFor,
      externalProvider: item.externalProvider ?? null,
      externalUrl: item.externalUrl ?? null,
      hoursUntilDue,
    };

    if (hoursUntilDue < 0) {
      overdue.push({ ...alertBase, kind: "overdue" });
      continue;
    }

    const isSameDay =
      due.getFullYear() === now.getFullYear() &&
      due.getMonth() === now.getMonth() &&
      due.getDate() === now.getDate();

    if (isSameDay) {
      dueToday.push({ ...alertBase, kind: "due_today" });
      continue;
    }

    if (hoursUntilDue <= maxThreshold) {
      dueSoon.push({ ...alertBase, kind: "due_soon" });
    }
  }

  const sortByDue = (a: DeadlineAlertItem, b: DeadlineAlertItem) =>
    a.scheduledFor.localeCompare(b.scheduledFor);

  overdue.sort(sortByDue);
  dueToday.sort(sortByDue);
  dueSoon.sort(sortByDue);

  return {
    overdue,
    dueToday,
    dueSoon,
    items: [...overdue, ...dueToday, ...dueSoon],
  };
}

function parseScheduledDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T23:59:59`);
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function externalTaskToSnapshot(
  provider: PmProvider,
  patch: ReturnType<typeof mapJiraIssueToWorkItemPatch>,
): ExternalTaskSnapshot {
  return {
    externalId: patch.externalId,
    externalKey: patch.externalKey,
    externalUrl: patch.externalUrl,
    title: patch.title,
    description: patch.description,
    statusLabel: patch.status,
    dueAt: patch.scheduledFor,
    priority: patch.priority,
  };
}
