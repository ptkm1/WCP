import { StatusAlert } from "@/components/app-ui";
import type { ContinueWorkDto } from "@/components/today/ContinueWorkCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ValidationCheckDto {
  key: string;
  status: string;
  expected?: string | null;
  actual?: string | null;
  message: string;
}

interface KnowledgeNoteDto {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

interface ArtifactDto {
  id: string;
  title?: string | null;
  url?: string | null;
  artifactType: string;
}

export function ContinueWorkDialog({
  open,
  onOpenChange,
  continueWork,
  currentBranch,
  branchWarning,
  validationChecks,
  notes,
  artifacts,
  message,
  busy = false,
  canStartFocus = false,
  formatDateTime,
  formatCheckDetail,
  onOpenTask,
  onStartFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  continueWork: ContinueWorkDto | null;
  currentBranch?: string | null;
  branchWarning?: string | null;
  validationChecks: ValidationCheckDto[];
  notes: KnowledgeNoteDto[];
  artifacts: ArtifactDto[];
  message?: string | null;
  busy?: boolean;
  canStartFocus?: boolean;
  formatDateTime: (value: string | null | undefined) => string;
  formatCheckDetail: (check: ValidationCheckDto) => string;
  onOpenTask: () => void;
  onStartFocus: () => void;
}) {
  if (!continueWork) {
    return null;
  }

  const failingChecks = validationChecks.filter(
    (check) => check.status !== "ok",
  );
  const okChecks = validationChecks.filter((check) => check.status === "ok");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-5 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Retomada de contexto</DialogTitle>
          <DialogDescription>
            Ambiente preparado para continuar{" "}
            {continueWork.externalKey
              ? `${continueWork.externalKey} · ${continueWork.title}`
              : continueWork.title}
            .
          </DialogDescription>
        </DialogHeader>

        <div className="contextIdentityCard">
          {continueWork.organizationName ? (
            <article>
              <span>Empresa</span>
              <strong>{continueWork.organizationName}</strong>
            </article>
          ) : null}
          {continueWork.repositoryName ? (
            <article>
              <span>Repo</span>
              <strong>{continueWork.repositoryName}</strong>
            </article>
          ) : null}
          <article>
            <span>Branch da sessao</span>
            <strong>
              {continueWork.branchName ? (
                <code>{continueWork.branchName}</code>
              ) : (
                "—"
              )}
            </strong>
          </article>
          <article>
            <span>Branch atual</span>
            <strong>
              {currentBranch ? <code>{currentBranch}</code> : "Indisponivel"}
            </strong>
          </article>
        </div>

        {message ? <p className="resultText">{message}</p> : null}

        {branchWarning ? (
          <StatusAlert status="warning" title="Branch divergente">
            {branchWarning}
          </StatusAlert>
        ) : continueWork.branchName && currentBranch ? (
          <StatusAlert status="ok" title="Branch alinhada">
            Voce esta em <code>{currentBranch}</code>, a mesma branch da sessao.
          </StatusAlert>
        ) : null}

        {failingChecks.length > 0 ? (
          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">
              Divergencias de identidade
            </h3>
            {failingChecks.map((check) => (
              <StatusAlert
                key={check.key}
                status="warning"
                title={check.message}
              >
                {formatCheckDetail(check)}
              </StatusAlert>
            ))}
          </section>
        ) : null}

        {okChecks.length > 0 && failingChecks.length === 0 ? (
          <StatusAlert status="ok" title="Identidade Git ok">
            Checks do repositorio passaram apos aplicar o contexto.
          </StatusAlert>
        ) : null}

        {(continueWork.sessionGoal ||
          continueWork.sessionDecisions ||
          continueWork.resumeSummary) && (
          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">Memoria da sessao</h3>
            {continueWork.resumeSummary ? (
              <p className="muted">Retomada: {continueWork.resumeSummary}</p>
            ) : null}
            {continueWork.sessionGoal ? (
              <p className="muted">Objetivo: {continueWork.sessionGoal}</p>
            ) : null}
            {continueWork.sessionDecisions ? (
              <p className="muted">Decisoes: {continueWork.sessionDecisions}</p>
            ) : null}
          </section>
        )}

        {notes.length > 0 ? (
          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">Notas recentes</h3>
            <ul className="grid gap-2">
              {notes.slice(0, 5).map((note) => (
                <li
                  key={note.id}
                  className="rounded-lg border border-border/70 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-sm">{note.title}</strong>
                    <Badge variant="outline">
                      {formatDateTime(note.createdAt)}
                    </Badge>
                  </div>
                  <p className="muted mt-1 text-sm whitespace-pre-wrap">
                    {note.content}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {artifacts.length > 0 ? (
          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">Artefatos relacionados</h3>
            <ul className="grid gap-2">
              {artifacts.slice(0, 8).map((artifact) => (
                <li
                  key={artifact.id}
                  className="flex items-center justify-between gap-3"
                >
                  <div>
                    <strong className="text-sm">
                      {artifact.title || artifact.artifactType}
                    </strong>
                    <p className="muted text-xs">{artifact.artifactType}</p>
                  </div>
                  {artifact.url ? (
                    <Button asChild type="button" variant="outline" size="sm">
                      <a href={artifact.url} target="_blank" rel="noreferrer">
                        Abrir
                      </a>
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Fechar
          </Button>
          {canStartFocus ? (
            <Button
              type="button"
              variant="outline"
              onClick={onStartFocus}
              disabled={busy}
            >
              Iniciar foco
            </Button>
          ) : null}
          <Button type="button" onClick={onOpenTask} disabled={busy}>
            Abrir tarefa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
