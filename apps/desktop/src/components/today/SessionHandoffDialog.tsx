import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SessionFieldTextarea } from "@/components/ui/form-fields";
import { useEffect, useState } from "react";

export interface SessionHandoffArtifactDto {
  title: string;
  url?: string | null;
  artifactType: string;
}

export interface SessionGitCommitDto {
  sha: string;
  subject: string;
}

export interface SessionHandoffSummaryDto {
  sessionId: string;
  startedAt: string;
  durationLabel: string;
  workItemId?: string | null;
  workItemTitle?: string | null;
  externalKey?: string | null;
  organizationName?: string | null;
  projectName?: string | null;
  repositoryId?: string | null;
  repositoryName?: string | null;
  branchName?: string | null;
  endedBranch?: string | null;
  startedHead?: string | null;
  endedHead?: string | null;
  commits: SessionGitCommitDto[];
  worktreePath?: string | null;
  artifacts: SessionHandoffArtifactDto[];
}

function formatBranchLabel(
  branchName?: string | null,
  endedBranch?: string | null,
) {
  const started = branchName?.trim() || null;
  const ended = endedBranch?.trim() || null;
  if (started && ended && started !== ended) {
    return `${started} → ${ended}`;
  }
  return ended || started;
}

export function SessionHandoffDialog({
  open,
  onOpenChange,
  summary,
  loading = false,
  busy = false,
  onSaveAndEnd,
  onEndWithoutNote,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: SessionHandoffSummaryDto | null;
  loading?: boolean;
  busy?: boolean;
  onSaveAndEnd: (payload: { stoppedHere: string; nextStep: string }) => void;
  onEndWithoutNote: () => void;
}) {
  const [stoppedHere, setStoppedHere] = useState("");
  const [nextStep, setNextStep] = useState("");

  useEffect(() => {
    if (!open) {
      setStoppedHere("");
      setNextStep("");
    }
  }, [open]);

  const taskLabel = summary
    ? [summary.externalKey?.trim(), summary.workItemTitle?.trim()]
        .filter(Boolean)
        .join(" · ") || "Sem tarefa vinculada"
    : null;
  const branchLabel = summary
    ? formatBranchLabel(summary.branchName, summary.endedBranch)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-5 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Encerrar trabalho</DialogTitle>
          <DialogDescription>
            Contexto montado automaticamente. Os campos abaixo sao opcionais.
          </DialogDescription>
        </DialogHeader>

        {loading || !summary ? (
          <p className="muted">Montando resumo da sessao...</p>
        ) : (
          <div className="grid gap-4">
            <div className="contextIdentityCard">
              {summary.organizationName ? (
                <article>
                  <span>Empresa</span>
                  <strong>{summary.organizationName}</strong>
                </article>
              ) : null}
              {summary.projectName ? (
                <article>
                  <span>Projeto</span>
                  <strong>{summary.projectName}</strong>
                </article>
              ) : null}
              {summary.repositoryName ? (
                <article>
                  <span>Repo</span>
                  <strong>{summary.repositoryName}</strong>
                </article>
              ) : null}
              {branchLabel ? (
                <article>
                  <span>Branch</span>
                  <strong>
                    <code>{branchLabel}</code>
                  </strong>
                </article>
              ) : null}
              <article>
                <span>Tarefa</span>
                <strong>{taskLabel}</strong>
              </article>
              <article>
                <span>Duracao</span>
                <strong>{summary.durationLabel}</strong>
              </article>
            </div>

            {summary.commits.length > 0 ? (
              <div className="grid gap-2">
                <p className="text-sm font-medium">Commits desta sessao</p>
                <ul className="muted grid gap-1 text-sm">
                  {summary.commits.map((commit) => (
                    <li key={`${commit.sha}-${commit.subject}`}>
                      <code>{commit.sha}</code> {commit.subject}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {summary.artifacts.length > 0 ? (
              <div className="grid gap-2">
                <p className="text-sm font-medium">Artefatos / PRs</p>
                <ul className="muted grid gap-1 text-sm">
                  {summary.artifacts.map((artifact, index) => (
                    <li key={`${artifact.title}-${index}`}>
                      {artifact.url ? (
                        <a href={artifact.url} target="_blank" rel="noreferrer">
                          {artifact.title}
                        </a>
                      ) : (
                        artifact.title
                      )}{" "}
                      <span>({artifact.artifactType})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <SessionFieldTextarea
              label="Onde voce parou?"
              value={stoppedHere}
              onChange={(event) => setStoppedHere(event.target.value)}
              placeholder="Ex.: Adjust funcionando no iOS"
            />
            <SessionFieldTextarea
              label="Proximo passo"
              value={nextStep}
              onChange={(event) => setNextStep(event.target.value)}
              placeholder="Ex.: validar Android"
            />
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onEndWithoutNote}
            disabled={busy || loading || !summary}
          >
            {busy ? "Encerrando..." : "Encerrar sem nota"}
          </Button>
          <Button
            type="button"
            onClick={() =>
              onSaveAndEnd({
                stoppedHere: stoppedHere.trim(),
                nextStep: nextStep.trim(),
              })
            }
            disabled={busy || loading || !summary}
          >
            {busy ? "Encerrando..." : "Salvar e encerrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
