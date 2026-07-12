import { OrganizationBadge, StatusBadge } from "@/components/app-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
const TASK_PREVIEW_MAX = 64;

export type TaskListItemData = {
  id: string;
  title: string;
  status: string;
  priority?: number | null;
  resumeSummary?: string | null;
  description?: string | null;
  scheduledFor?: string | null;
  sourceType?: string;
  externalProvider?: string | null;
  externalKey?: string | null;
  organizationId?: string | null;
  wcpDismissedAt?: string | null;
};

export function truncateText(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function buildTaskListPreview(
  task: TaskListItemData,
  formatDateTime: (value: string) => string,
): string | undefined {
  const parts: string[] = [];

  if (task.resumeSummary?.trim()) {
    parts.push(truncateText(task.resumeSummary, TASK_PREVIEW_MAX));
  } else if (task.description?.trim()) {
    parts.push(truncateText(task.description, TASK_PREVIEW_MAX));
  }

  if (task.scheduledFor) {
    parts.push(`Prazo ${formatDateTime(task.scheduledFor)}`);
  }

  if (parts.length === 0) {
    return undefined;
  }

  return truncateText(parts.join(" · "), TASK_PREVIEW_MAX + 24);
}

type TaskListChip = {
  key: string;
  node: ReactNode;
};

const TASK_TITLE_MAX = 72;

export function TaskListItem({
  task,
  active,
  linked,
  organizationName,
  organizationId,
  organizationKind,
  organizationLogoUrl,
  isRelated,
  onClick,
  formatTaskStatus,
  formatPmProviderLabel,
  formatDateTime,
}: {
  task: TaskListItemData;
  active?: boolean;
  linked?: boolean;
  organizationName?: string | null;
  organizationId?: string | null;
  organizationKind?: string | null;
  organizationLogoUrl?: string | null;
  isRelated?: boolean;
  onClick: () => void;
  formatTaskStatus: (status: string) => string;
  formatPmProviderLabel: (provider: string) => string;
  formatDateTime: (value: string) => string;
}) {
  const preview = buildTaskListPreview(task, formatDateTime);
  const chips = buildTaskListChips({
    task,
    organizationName,
    organizationId,
    organizationKind,
    organizationLogoUrl,
    isRelated,
    formatPmProviderLabel,
    formatDateTime,
  });

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "task-list-item h-auto w-full min-w-0 flex-col items-stretch gap-2 rounded-xl border px-3 py-2.5 text-left font-normal hover:bg-accent/40",
        active &&
          "border-primary/45 bg-primary/10 shadow-glow hover:bg-primary/10",
        linked && !active && "border-dashed border-primary/25",
      )}
      onClick={onClick}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          className={cn(
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground",
            active && "border-primary/30 bg-primary/15 text-primary",
          )}
          aria-hidden
        >
          {task.priority ?? 3}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="line-clamp-1 text-sm font-semibold leading-snug text-foreground"
            title={task.title}
          >
            {truncateText(task.title, TASK_TITLE_MAX)}
          </p>
          {preview ? (
            <p
              className="mt-0.5 line-clamp-1 text-xs leading-snug text-muted-foreground"
              title={preview}
            >
              {preview}
            </p>
          ) : null}
        </div>
        <TaskStatusPill
          status={task.status}
          formatTaskStatus={formatTaskStatus}
        />
      </div>

      {chips.length > 0 ? (
        <div className="flex min-w-0 flex-wrap items-center gap-1 pl-8">
          {chips.map((chip) => (
            <span key={chip.key}>{chip.node}</span>
          ))}
        </div>
      ) : null}
    </Button>
  );
}

function TaskStatusPill({
  status,
  formatTaskStatus,
}: {
  status: string;
  formatTaskStatus: (status: string) => string;
}) {
  if (status === "blocked") {
    return (
      <StatusBadge variant="blocked" className="shrink-0 px-2 py-0 text-[10px]">
        Bloq.
      </StatusBadge>
    );
  }
  if (status === "doing") {
    return (
      <StatusBadge variant="live" className="shrink-0 px-2 py-0 text-[10px]">
        Foco
      </StatusBadge>
    );
  }
  if (status === "archived" || status === "done") {
    return (
      <Badge variant="secondary" className="shrink-0 px-2 py-0 text-[10px]">
        {formatTaskStatus(status)}
      </Badge>
    );
  }
  return null;
}

function buildTaskListChips({
  task,
  organizationName,
  organizationId,
  organizationKind,
  organizationLogoUrl,
  isRelated,
  formatPmProviderLabel,
  formatDateTime,
}: {
  task: TaskListItemData;
  organizationName?: string | null;
  organizationId?: string | null;
  organizationKind?: string | null;
  organizationLogoUrl?: string | null;
  isRelated?: boolean;
  formatPmProviderLabel: (provider: string) => string;
  formatDateTime: (value: string) => string;
}): TaskListChip[] {
  const chips: TaskListChip[] = [];
  const maxChips = 3;

  if (organizationName) {
    chips.push({
      key: "org",
      node: (
        <OrganizationBadge
          name={organizationName}
          organizationId={organizationId ?? task.organizationId}
          kind={organizationKind}
          logoUrl={organizationLogoUrl}
        />
      ),
    });
  }

  if (task.wcpDismissedAt) {
    chips.push({
      key: "dismissed",
      node: (
        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
          Ignorada
        </Badge>
      ),
    });
  }

  if (task.sourceType === "imported" && task.externalKey) {
    chips.push({
      key: "external",
      node: (
        <Badge
          variant="outline"
          className="max-w-[120px] truncate px-1.5 py-0 text-[10px]"
        >
          {task.externalKey}
        </Badge>
      ),
    });
  } else if (task.sourceType === "imported" && task.externalProvider) {
    chips.push({
      key: "provider",
      node: (
        <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
          {formatPmProviderLabel(task.externalProvider)}
        </Badge>
      ),
    });
  }

  if (task.resumeSummary?.trim()) {
    chips.push({
      key: "resume",
      node: (
        <Badge variant="success" className="px-1.5 py-0 text-[10px]">
          Retomada
        </Badge>
      ),
    });
  }

  if (isRelated) {
    chips.push({
      key: "related",
      node: (
        <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
          Relacionada
        </Badge>
      ),
    });
  }

  if (task.scheduledFor && chips.length < maxChips) {
    chips.push({
      key: "deadline",
      node: (
        <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
          {formatDateTime(task.scheduledFor)}
        </Badge>
      ),
    });
  }

  return chips.slice(0, maxChips);
}
