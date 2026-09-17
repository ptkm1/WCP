import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import { SessionFieldInput } from "@/components/ui/form-fields";
import {
  describeMergeRequest,
  formatMergeRequestTitle,
  parseMergeRequestUrl,
  type MergeRequestRole,
} from "@wcp/domain";
import { GitPullRequest } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const ROLE_OPTIONS: Array<{ value: MergeRequestRole; label: string }> = [
  { value: "front", label: "Front" },
  { value: "back", label: "Back" },
];

export function TaskMergeRequestDialog({
  open,
  onOpenChange,
  busy = false,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy?: boolean;
  onSubmit: (
    title: string,
    url: string,
    role: string | null,
  ) => void | Promise<void>;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState<MergeRequestRole | null>(null);

  useEffect(() => {
    if (!open) {
      setUrl("");
      setTitle("");
      setRole(null);
    }
  }, [open]);

  const parsed = useMemo(() => parseMergeRequestUrl(url), [url]);
  const preview = useMemo(() => {
    if (!parsed) {
      return null;
    }
    return describeMergeRequest({
      title: title.trim() || null,
      url,
      artifactType: "pr",
      metadataJson: JSON.stringify({
        kind: "merge_request",
        provider: parsed.provider,
        host: parsed.host,
        projectPath: parsed.projectPath,
        repo: parsed.repo,
        number: parsed.number,
        role,
      }),
    });
  }, [parsed, role, title, url]);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Vincular merge request"
      description="Cole o link do GitLab ou GitHub. O WCP guarda o MR junto da tarefa para retomar o contexto depois."
      submitLabel="Vincular MR"
      busy={busy}
      submitDisabled={!parsed}
      onSubmit={() =>
        void onSubmit(
          title.trim() || (parsed ? formatMergeRequestTitle(parsed, role) : ""),
          url.trim(),
          role,
        )
      }
    >
      <SessionFieldInput
        id="task-mr-url"
        label="URL do MR"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://gitlab.com/org/repo/-/merge_requests/123"
        autoFocus
      />

      <div className="grid gap-2">
        <p className="text-sm text-muted-foreground">Camada (opcional)</p>
        <div className="flex flex-wrap gap-2">
          {ROLE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={role === option.value ? "default" : "outline"}
              onClick={() =>
                setRole((current) =>
                  current === option.value ? null : option.value,
                )
              }
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <SessionFieldInput
        id="task-mr-title"
        label="Rotulo (opcional)"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={
          parsed ? formatMergeRequestTitle(parsed, role) : "MR BACK, hotfix..."
        }
      />

      {url.trim() && !parsed ? (
        <p className="text-sm text-yellow-400">
          Nao reconheci essa URL. Use um link de merge request do GitLab ou
          pull request do GitHub.
        </p>
      ) : null}

      {preview ? (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
          <GitPullRequest className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {preview.roleLabel ? (
                <Badge variant="success" className="px-1.5 py-0 text-[10px]">
                  {preview.roleLabel}
                </Badge>
              ) : null}
              <span className="text-sm font-semibold">
                {title.trim() || `${preview.repo} ${preview.ref}`}
              </span>
              <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                {preview.providerLabel}
              </Badge>
            </div>
            {preview.hostPath ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {preview.hostPath}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </FormDialog>
  );
}
