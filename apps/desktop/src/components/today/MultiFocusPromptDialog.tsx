import { StatusAlert } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FieldCheckbox,
  SessionFieldTextarea,
} from "@/components/ui/form-fields";
import { useEffect, useMemo, useState } from "react";

export interface MultiFocusTaskDto {
  id: string;
  title: string;
  externalKey?: string | null;
}

export interface MultiFocusGroupDto {
  groupKey: string;
  organizationId?: string | null;
  organizationName?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  repositoryId?: string | null;
  repositoryName?: string | null;
  tasks: MultiFocusTaskDto[];
}

export type MultiFocusTaskDraft = {
  acting: boolean;
  note: string;
};

export function MultiFocusPromptDialog({
  open,
  onOpenChange,
  group,
  busy = false,
  onSnooze,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: MultiFocusGroupDto | null;
  busy?: boolean;
  onSnooze: () => void;
  onSave: (drafts: Record<string, MultiFocusTaskDraft>) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, MultiFocusTaskDraft>>({});

  useEffect(() => {
    if (!group) {
      setDrafts({});
      return;
    }
    const next: Record<string, MultiFocusTaskDraft> = {};
    for (const task of group.tasks) {
      next[task.id] = { acting: true, note: "" };
    }
    setDrafts(next);
  }, [group]);

  const actingCount = useMemo(
    () => Object.values(drafts).filter((draft) => draft.acting).length,
    [drafts],
  );

  const missingNotes = useMemo(() => {
    if (!group || actingCount < 2) {
      return false;
    }
    return group.tasks.some((task) => {
      const draft = drafts[task.id];
      return draft?.acting && !draft.note.trim();
    });
  }, [actingCount, drafts, group]);

  if (!group) {
    return null;
  }

  const contextLabel = [
    group.organizationName,
    group.projectName ?? group.repositoryName,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-5 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Voce esta atuando em mais de uma tarefa?</DialogTitle>
          <DialogDescription>
            Ha {group.tasks.length} tarefas Em andamento
            {contextLabel ? ` em ${contextLabel}` : ""}. Confirme em quais voce
            esta de fato trabalhando e registre o motivo — isso ajuda na daily.
          </DialogDescription>
        </DialogHeader>

        {actingCount >= 2 ? (
          <StatusAlert status="warning" title="Multi-foco no mesmo contexto">
            Atuar em mais de uma tarefa no mesmo projeto/repo e incomum. Se for
            o caso, anote o motivo em cada uma marcada.
          </StatusAlert>
        ) : null}

        {actingCount === 1 ? (
          <StatusAlert status="ok" title="Foco unico">
            Voce marcou so uma tarefa. Considere mover as outras para A fazer ou
            Bloqueada depois — o WCP nao altera o status automaticamente.
          </StatusAlert>
        ) : null}

        <div className="grid gap-4">
          {group.tasks.map((task) => {
            const draft = drafts[task.id] ?? { acting: false, note: "" };
            const label = task.externalKey
              ? `${task.externalKey} · ${task.title}`
              : task.title;

            return (
              <div
                key={task.id}
                className="grid gap-3 rounded-xl border border-border/70 p-4"
              >
                <div className="grid gap-1">
                  <strong className="text-sm">{label}</strong>
                  <FieldCheckbox
                    id={`multi-focus-acting-${task.id}`}
                    label="Estou atuando nela agora"
                    checked={draft.acting}
                    onCheckedChange={(checked) =>
                      setDrafts((current) => ({
                        ...current,
                        [task.id]: {
                          ...(current[task.id] ?? { acting: false, note: "" }),
                          acting: checked,
                        },
                      }))
                    }
                  />
                </div>
                <SessionFieldTextarea
                  id={`multi-focus-note-${task.id}`}
                  label={
                    draft.acting && actingCount >= 2
                      ? "Motivo / anotacao (obrigatorio)"
                      : "Motivo / anotacao (opcional)"
                  }
                  value={draft.note}
                  rows={3}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [task.id]: {
                        ...(current[task.id] ?? { acting: false, note: "" }),
                        note: event.target.value,
                      },
                    }))
                  }
                  placeholder="Ex.: urgencia do cliente X; bloqueio na outra task; pair programming..."
                />
              </div>
            );
          })}
        </div>

        {missingNotes ? (
          <p className="errorText">
            Informe o motivo nas tarefas em que voce esta atuando (2 ou mais).
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onSnooze}
          >
            Agora nao
          </Button>
          <Button
            type="button"
            disabled={busy || missingNotes || actingCount === 0}
            onClick={() => onSave(drafts)}
          >
            {busy ? "Salvando..." : "Salvar no historico"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
