import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { describeMergeRequest } from "@wcp/domain";
import { ExternalLink, GitPullRequest, Trash2 } from "lucide-react";

export interface TaskMergeRequestItem {
  id: string;
  title?: string | null;
  url?: string | null;
  artifactType?: string | null;
  metadataJson?: string | null;
}

export function isTaskMergeRequest(item: TaskMergeRequestItem): boolean {
  return describeMergeRequest(item) !== null;
}

function mergeRequestHeading(
  item: TaskMergeRequestItem,
  info: NonNullable<ReturnType<typeof describeMergeRequest>>,
): string {
  const stored = item.title?.trim();
  if (stored && info.ref && !stored.includes(info.ref)) {
    return stored;
  }
  if (info.repo && info.ref) {
    return `${info.repo} ${info.ref}`;
  }
  return info.title;
}

export function TaskMergeRequestCards({
  items,
  busy = false,
  onDetach,
}: {
  items: TaskMergeRequestItem[];
  busy?: boolean;
  onDetach?: (artifactId: string) => void;
}) {
  return (
    <ul className="grid gap-2">
      {items.map((item) => {
        const info = describeMergeRequest(item);
        if (!info) {
          return null;
        }
        return (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background/80 text-primary">
              <GitPullRequest className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {info.roleLabel ? (
                  <Badge variant="success" className="px-1.5 py-0 text-[10px]">
                    {info.roleLabel}
                  </Badge>
                ) : null}
                <strong className="truncate text-sm font-semibold">
                  {mergeRequestHeading(item, info)}
                </strong>
                <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                  {info.providerLabel}
                </Badge>
              </div>
              {info.hostPath ? (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {info.hostPath}
                </p>
              ) : null}
            </div>
            {info.url ? (
              <Button asChild variant="outline" size="sm">
                <a href={info.url} target="_blank" rel="noreferrer">
                  Abrir
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              </Button>
            ) : null}
            {onDetach ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                disabled={busy}
                aria-label={`Remover ${info.title}`}
                onClick={() => onDetach(item.id)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
