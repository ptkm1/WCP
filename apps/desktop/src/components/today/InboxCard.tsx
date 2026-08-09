import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SessionFieldSelect } from "@/components/ui/form-fields";
import { useMemo, useState } from "react";

export type InboxWorkItem = {
  id: string;
  title: string;
  organizationId?: string | null;
  projectId?: string | null;
  primaryRepositoryId?: string | null;
  externalProvider?: string | null;
  externalKey?: string | null;
  externalUrl?: string | null;
  wcpInboxAt?: string | null;
};

export type InboxProjectOption = {
  id: string;
  name: string;
  organizationId?: string | null;
};

function providerLabel(provider?: string | null) {
  if (provider === "jira") return "Jira";
  if (provider === "clickup") return "ClickUp";
  return provider?.trim() || "Externo";
}

export function InboxCard({
  items,
  projects,
  busyId = null,
  onAccept,
  onDismiss,
  onAssociateProject,
}: {
  items: InboxWorkItem[];
  projects: InboxProjectOption[];
  busyId?: string | null;
  onAccept: (workItemId: string) => void;
  onDismiss: (workItemId: string) => void;
  onAssociateProject: (workItemId: string, projectId: string) => void;
}) {
  const [associateItem, setAssociateItem] = useState<InboxWorkItem | null>(
    null,
  );
  const [projectId, setProjectId] = useState("");

  const projectOptions = useMemo(() => {
    if (!associateItem) {
      return [];
    }
    return projects
      .filter(
        (project) =>
          !associateItem.organizationId ||
          project.organizationId === associateItem.organizationId,
      )
      .map((project) => ({
        value: project.id,
        label: project.name,
      }));
  }, [associateItem, projects]);

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="inboxCard border-amber-500/30 bg-card/95">
        <CardContent className="grid gap-4 p-5">
          <div className="panelHeading flex items-start justify-between gap-3">
            <div>
              <span className="nextActionEyebrow">Inbox</span>
              <h2 className="text-lg font-semibold leading-snug">
                Novas desde o ultimo sync
              </h2>
              <p className="muted text-sm">
                Triage antes de entrar no foco e no plano do dia.
              </p>
            </div>
            <Badge variant="secondary">{items.length}</Badge>
          </div>

          <ul className="grid gap-3">
            {items.map((item) => {
              const ticket = item.externalKey?.trim() || null;
              const busy = busyId === item.id;
              return (
                <li
                  key={item.id}
                  className="grid gap-2 rounded-xl border border-border/80 bg-background/40 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <strong className="block truncate">
                        {ticket ? `${ticket} · ${item.title}` : item.title}
                      </strong>
                      <span className="muted text-xs">
                        {providerLabel(item.externalProvider)}
                        {item.projectId
                          ? ` · projeto vinculado`
                          : " · sem projeto WCP"}
                      </span>
                    </div>
                    {item.externalUrl ? (
                      <a
                        className="text-xs text-primary underline-offset-2 hover:underline"
                        href={item.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir
                      </a>
                    ) : null}
                  </div>
                  <div className="actionRow flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy}
                      onClick={() => onAccept(item.id)}
                    >
                      {busy ? "Salvando..." : "Adicionar ao WCP"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        setAssociateItem(item);
                        setProjectId(item.projectId ?? "");
                      }}
                    >
                      Associar projeto
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => onDismiss(item.id)}
                    >
                      Ignorar
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Dialog
        open={associateItem !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAssociateItem(null);
            setProjectId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Associar projeto</DialogTitle>
            <DialogDescription>
              A tarefa permanece na Inbox ate voce adicionar ao WCP.
            </DialogDescription>
          </DialogHeader>
          {associateItem ? (
            <div className="grid gap-3">
              <p className="text-sm">
                <strong>
                  {associateItem.externalKey
                    ? `${associateItem.externalKey} · `
                    : ""}
                  {associateItem.title}
                </strong>
              </p>
              <SessionFieldSelect
                label="Projeto"
                value={projectId}
                onValueChange={setProjectId}
                options={[
                  { value: "", label: "Selecione um projeto" },
                  ...projectOptions,
                ]}
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setAssociateItem(null);
                setProjectId("");
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!associateItem || !projectId.trim()}
              onClick={() => {
                if (!associateItem || !projectId.trim()) {
                  return;
                }
                onAssociateProject(associateItem.id, projectId.trim());
                setAssociateItem(null);
                setProjectId("");
              }}
            >
              Salvar projeto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
