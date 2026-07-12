import {
  FilterTabs,
  StatusAlert,
  StatusBadge,
  TimelineEntry,
} from "@/components/app-ui";
import { DetailSection } from "@/components/layout/DetailSection";
import { TaskArtifactDialog } from "@/components/tasks/TaskArtifactDialog";
import { TaskDependencyDialog } from "@/components/tasks/TaskDependencyDialog";
import { TaskNoteDialog } from "@/components/tasks/TaskNoteDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { SessionFieldSelect } from "@/components/ui/form-fields";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HISTORY_KIND_ICONS } from "@/lib/app-icons";
import { MoreHorizontal, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";

type TimelineFilter =
  | "all"
  | "session"
  | "note"
  | "artifact"
  | "dependency"
  | "block"
  | "change";

interface TimelineEntryItem {
  id: string;
  kind: Exclude<TimelineFilter, "all">;
  title: string;
  detail?: string | null;
  createdAt: string;
}

interface WorkItem {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority?: number | null;
  sourceType?: string | null;
  externalProvider?: string | null;
  externalKey?: string | null;
  externalUrl?: string | null;
  organizationId?: string | null;
  projectId?: string | null;
  primaryRepositoryId?: string | null;
  blockedReason?: string | null;
  resumeSummary?: string | null;
  wcpDismissedAt?: string | null;
}

interface TaskDependency {
  id: string;
  relatedWorkItemId: string;
  title: string;
  status: string;
  relation: string;
}

interface TaskNote {
  id: string;
  title: string;
  content: string;
  sourceType?: string;
  createdAt: string;
}

interface TaskArtifact {
  id: string;
  title?: string | null;
  url?: string | null;
  artifactType: string;
  sourceType?: string;
  createdAt: string;
}

interface TaskSession {
  id: string;
  startedAt: string;
  branchName?: string | null;
  goal?: string | null;
  result?: string | null;
  sourceType?: string;
  workItemExternalKey?: string | null;
  workItemExternalProvider?: string | null;
}

interface RepositoryOption {
  id: string;
  name: string;
  organizationId?: string | null;
}

const QUICK_STATUS_OPTIONS = [
  { value: "todo", label: "A fazer" },
  { value: "doing", label: "Em andamento" },
  { value: "blocked", label: "Bloqueada" },
  { value: "done", label: "Concluida" },
] as const;

export interface TaskDetailPanelProps {
  taskFormMode: "create" | "edit" | null;
  currentTask: WorkItem | null;
  taskContextMessage?: string | null;
  taskFormPanel: ReactNode;
  resumeSuggestion?: { taskId: string; text: string } | null;
  repositories: RepositoryOption[];
  organizationMap: Map<string, string>;
  taskActionBusy: boolean;
  sessionBusy: boolean;
  taskContextBusy: boolean;
  contextBusy: boolean;
  dependencyBusy: boolean;
  dependencyError: string | null;
  taskActionsMenuOpen: boolean;
  timelineFilter: TimelineFilter;
  taskTimeline: TimelineEntryItem[];
  filteredTimeline: TimelineEntryItem[];
  timelineCounts: Record<TimelineFilter, number>;
  timelineFilters: { id: TimelineFilter; label: string }[];
  dependencies: TaskDependency[];
  taskNotes: TaskNote[];
  taskArtifacts: TaskArtifact[];
  recentSessions: TaskSession[];
  dependencyTaskOptions: { value: string; label: string }[];
  formatTaskStatus: (status: string) => string;
  formatPmProviderLabel: (provider: string) => string;
  formatDateTime: (value: string) => string;
  formatTimelineWhen: (value: string) => string;
  formatSourceTypeLabel: (sourceType: string) => string;
  formatDependencySentence: (
    currentTitle: string,
    relation: string,
    relatedTitle: string,
  ) => string;
  onTimelineFilterChange: (filter: TimelineFilter) => void;
  onTaskActionsMenuOpenChange: (open: boolean) => void;
  onQuickStatusChange: (status: string) => void;
  onStartFocus: () => void;
  onApplyContext: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onOpenGitContext?: () => void;
  onRestoreDismissed?: () => void;
  onDismiss?: () => void;
  onReopen?: () => void;
  onArchive?: () => void;
  onLinkRepository: (repositoryId: string) => void;
  onDismissResumeSuggestion: () => void;
  onApplyResumeSuggestion: () => void;
  onCreateDependency: (
    relation: "depends_on" | "blocks",
    targetId: string,
  ) => boolean | Promise<boolean>;
  onDeleteDependency: (dependencyId: string) => void;
  onClearDependencyError: () => void;
  onSaveNote: (title: string, content: string) => boolean | Promise<boolean>;
  onAttachArtifact: (title: string, url: string) => boolean | Promise<boolean>;
  onResumeSession: (session: TaskSession) => void;
}

export function TaskDetailPanel({
  taskFormMode,
  currentTask,
  taskContextMessage,
  taskFormPanel,
  resumeSuggestion,
  repositories,
  organizationMap,
  taskActionBusy,
  sessionBusy,
  taskContextBusy,
  contextBusy,
  dependencyBusy,
  dependencyError,
  taskActionsMenuOpen,
  timelineFilter,
  taskTimeline,
  filteredTimeline,
  timelineCounts,
  timelineFilters,
  dependencies,
  taskNotes,
  taskArtifacts,
  recentSessions,
  dependencyTaskOptions,
  formatTaskStatus,
  formatPmProviderLabel,
  formatDateTime,
  formatTimelineWhen,
  formatSourceTypeLabel,
  formatDependencySentence,
  onTimelineFilterChange,
  onTaskActionsMenuOpenChange,
  onQuickStatusChange,
  onStartFocus,
  onApplyContext,
  onEdit,
  onDuplicate,
  onOpenGitContext,
  onRestoreDismissed,
  onDismiss,
  onReopen,
  onArchive,
  onLinkRepository,
  onDismissResumeSuggestion,
  onApplyResumeSuggestion,
  onCreateDependency,
  onDeleteDependency,
  onClearDependencyError,
  onSaveNote,
  onAttachArtifact,
  onResumeSession,
}: TaskDetailPanelProps) {
  const [detailTab, setDetailTab] = useState("activity");
  const [dependencyDialogOpen, setDependencyDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [artifactDialogOpen, setArtifactDialogOpen] = useState(false);

  async function handleCreateDependency(
    relation: "depends_on" | "blocks",
    targetId: string,
  ) {
    const success = await onCreateDependency(relation, targetId);
    if (success) {
      setDependencyDialogOpen(false);
    }
  }

  async function handleSaveNote(title: string, content: string) {
    const success = await onSaveNote(title, content);
    if (success) {
      setNoteDialogOpen(false);
    }
  }

  async function handleAttachArtifact(title: string, url: string) {
    const success = await onAttachArtifact(title, url);
    if (success) {
      setArtifactDialogOpen(false);
    }
  }

  return (
    <div className="taskDetailPanel">
      <div className="taskDetailHeader">
        <div className="panelHeading">
          <h2>
            {taskFormMode === "create"
              ? "Nova tarefa"
              : taskFormMode === "edit"
                ? "Editar tarefa"
                : (currentTask?.title ?? "Escolha uma tarefa")}
          </h2>
          <p className="muted">
            {taskFormMode
              ? "Preencha o essencial e salve para atualizar o backlog."
              : currentTask
                ? "Historico, notas e links desta tarefa."
                : "Selecione uma tarefa na lista."}
          </p>
        </div>
        {taskFormMode ? null : currentTask ? (
          <>
            <div className="taskDetailMeta flex flex-wrap items-center gap-2">
              <StatusBadge
                variant={
                  currentTask.status === "blocked"
                    ? "blocked"
                    : currentTask.status === "doing"
                      ? "live"
                      : "idle"
                }
              >
                {formatTaskStatus(currentTask.status)}
              </StatusBadge>
              <Badge variant="outline">P{currentTask.priority ?? 3}</Badge>
              {currentTask.sourceType === "imported" &&
              currentTask.externalProvider ? (
                <Badge variant="outline">
                  Importado ·{" "}
                  {formatPmProviderLabel(currentTask.externalProvider)}
                  {currentTask.externalKey
                    ? ` · ${currentTask.externalKey}`
                    : ""}
                </Badge>
              ) : null}
              {currentTask.organizationId ? (
                <Badge variant="secondary">
                  {organizationMap.get(currentTask.organizationId) ?? "Empresa"}
                </Badge>
              ) : null}
              {currentTask.wcpDismissedAt ? (
                <Badge variant="secondary">Ignorada no WCP</Badge>
              ) : null}
              {currentTask.externalUrl ? (
                <a
                  className="externalTaskLink text-sm"
                  href={currentTask.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir no{" "}
                  {formatPmProviderLabel(currentTask.externalProvider ?? "pm")}↗
                </a>
              ) : null}
            </div>
            <div className="taskDetailActions">
              {currentTask.sourceType === "imported" &&
              !currentTask.wcpDismissedAt ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    disabled={sessionBusy}
                    onClick={onStartFocus}
                  >
                    Iniciar foco
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={taskContextBusy}
                    onClick={onApplyContext}
                  >
                    Aplicar contexto
                  </Button>
                </>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onEdit}
              >
                Editar
              </Button>
              <DropdownMenu
                open={taskActionsMenuOpen}
                onOpenChange={onTaskActionsMenuOpenChange}
                items={[
                  {
                    id: "duplicate",
                    label: "Duplicar",
                    disabled: taskActionBusy,
                    onClick: onDuplicate,
                  },
                  ...(currentTask.primaryRepositoryId && onOpenGitContext
                    ? [
                        {
                          id: "git",
                          label: "Abrir contexto Git",
                          onClick: onOpenGitContext,
                        },
                      ]
                    : []),
                  ...(currentTask.wcpDismissedAt && onRestoreDismissed
                    ? [
                        {
                          id: "restore",
                          label: "Restaurar ignorada",
                          disabled: taskActionBusy,
                          onClick: onRestoreDismissed,
                        },
                      ]
                    : currentTask.sourceType === "imported" && onDismiss
                      ? [
                          {
                            id: "dismiss",
                            label: "Ignorar no WCP",
                            disabled: taskActionBusy,
                            onClick: onDismiss,
                          },
                        ]
                      : []),
                  currentTask.status === "archived"
                    ? {
                        id: "reopen",
                        label: "Reabrir",
                        disabled: taskActionBusy,
                        onClick: onReopen ?? (() => undefined),
                      }
                    : {
                        id: "archive",
                        label: "Arquivar",
                        disabled: taskActionBusy,
                        onClick: onArchive ?? (() => undefined),
                      },
                ]}
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Mais acoes da tarefa"
                  >
                    <MoreHorizontal className="h-4 w-4" aria-hidden />
                  </Button>
                }
              />
            </div>
          </>
        ) : null}
      </div>

      {taskContextMessage && currentTask ? (
        <p className="resultText">{taskContextMessage}</p>
      ) : null}

      {currentTask?.sourceType === "imported" &&
      !currentTask.primaryRepositoryId ? (
        <div className="sessionForm compactForm">
          <p className="muted">
            Vincule um repositorio desta empresa para aplicar contexto Git
            automaticamente.
          </p>
          <SessionFieldSelect
            id="task-link-repository"
            label="Repositorio"
            value=""
            allowEmpty
            emptyLabel="Selecione"
            onValueChange={(repositoryId) => {
              if (repositoryId) {
                onLinkRepository(repositoryId);
              }
            }}
            options={repositories
              .filter(
                (repo) => repo.organizationId === currentTask.organizationId,
              )
              .map((repo) => ({
                value: repo.id,
                label: repo.name,
              }))}
          />
        </div>
      ) : null}

      {resumeSuggestion &&
      currentTask &&
      resumeSuggestion.taskId === currentTask.id &&
      !taskFormMode ? (
        <StatusAlert status="ok" title="Sugestao de retomada">
          <div className="grid gap-3">
            <span>{resumeSuggestion.text}</span>
            <div className="actionRow">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onDismissResumeSuggestion}
              >
                Ignorar
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={taskActionBusy}
                onClick={onApplyResumeSuggestion}
              >
                Usar como retomada
              </Button>
            </div>
          </div>
        </StatusAlert>
      ) : null}

      {taskFormMode ? (
        taskFormPanel
      ) : currentTask ? (
        <div className="taskDetailSections">
          <div className="taskQuickActions">
            <h3 className="subheading">Status rapido</h3>
            <div className="timelineFilters">
              {QUICK_STATUS_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={
                    currentTask.status === option.value ? "default" : "outline"
                  }
                  disabled={
                    taskActionBusy || currentTask.status === option.value
                  }
                  onClick={() => onQuickStatusChange(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {currentTask.description || currentTask.resumeSummary ? (
            <div className="taskContextSummary">
              {currentTask.description ? (
                <p className="muted">{currentTask.description}</p>
              ) : null}
              {currentTask.resumeSummary ? (
                <StatusAlert status="ok" title="Retomada">
                  {currentTask.resumeSummary}
                </StatusAlert>
              ) : null}
            </div>
          ) : null}

          <Tabs value={detailTab} onValueChange={setDetailTab}>
            <TabsList className="grid h-auto w-full grid-cols-3 gap-1 bg-muted/40 p-1">
              <TabsTrigger value="activity" className="text-xs sm:text-sm">
                Atividade
              </TabsTrigger>
              <TabsTrigger value="context" className="text-xs sm:text-sm">
                Contexto
              </TabsTrigger>
              <TabsTrigger value="focus" className="text-xs sm:text-sm">
                Focos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="activity" className="mt-4 space-y-4">
              {currentTask.blockedReason ? (
                <StatusAlert status="mismatch" title="Por que esta parada">
                  {currentTask.blockedReason}
                </StatusAlert>
              ) : null}

              {taskTimeline.length > 0 ? (
                <FilterTabs
                  value={timelineFilter}
                  onValueChange={(value) =>
                    onTimelineFilterChange(value as TimelineFilter)
                  }
                  aria-label="Filtrar historico por tipo"
                  items={timelineFilters.map((filter) => ({
                    id: filter.id,
                    label: `${filter.label} (${timelineCounts[filter.id]})`,
                    icon: HISTORY_KIND_ICONS[filter.id],
                  }))}
                />
              ) : null}

              {taskTimeline.length === 0 ? (
                <StatusAlert status="warning" title="Historico vazio">
                  Comece um foco ou adicione notas para montar o contexto.
                </StatusAlert>
              ) : filteredTimeline.length > 0 ? (
                <ul className="timelineList">
                  {filteredTimeline.map((entry) => (
                    <TimelineEntry
                      key={entry.id}
                      kind={entry.kind}
                      title={entry.title}
                      detail={entry.detail}
                      when={formatTimelineWhen(entry.createdAt)}
                    />
                  ))}
                </ul>
              ) : (
                <StatusAlert status="warning" title="Nada neste filtro">
                  Tente outro tipo de evento.
                </StatusAlert>
              )}
            </TabsContent>

            <TabsContent value="context" className="mt-4 space-y-6">
              <DetailSection
                title="Dependencias"
                action={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDependencyDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Adicionar
                  </Button>
                }
              >
                {dependencies.length > 0 ? (
                  <ul className="historyList">
                    {dependencies.map((dependency) => (
                      <li key={dependency.id}>
                        <div>
                          <strong>{dependency.title}</strong>
                          <span>
                            {formatDependencySentence(
                              currentTask.title,
                              dependency.relation,
                              dependency.title,
                            )}
                          </span>
                          <code>{dependency.status}</code>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => onDeleteDependency(dependency.id)}
                          disabled={dependencyBusy}
                        >
                          Remover
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <StatusAlert status="ok" title="Tudo livre">
                    Nenhuma dependencia registrada nesta tarefa.
                  </StatusAlert>
                )}
              </DetailSection>

              <DetailSection
                title="Notas"
                action={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setNoteDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Nova nota
                  </Button>
                }
              >
                {taskNotes.length > 0 ? (
                  <ul className="historyList">
                    {taskNotes.map((note) => (
                      <li key={note.id}>
                        <div>
                          <strong>{note.title}</strong>
                          {note.sourceType ? (
                            <Badge variant="outline">
                              {formatSourceTypeLabel(note.sourceType)}
                            </Badge>
                          ) : null}
                          <span>{formatDateTime(note.createdAt)}</span>
                          <code>{note.content}</code>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <StatusAlert status="warning" title="Sem notas">
                    Registre decisoes importantes para retomar depois.
                  </StatusAlert>
                )}
              </DetailSection>

              <DetailSection
                title="Links e anexos"
                action={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setArtifactDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Anexar link
                  </Button>
                }
              >
                {taskArtifacts.length > 0 ? (
                  <ul className="historyList">
                    {taskArtifacts.map((artifact) => (
                      <li key={artifact.id}>
                        <div>
                          <strong>
                            {artifact.title ?? artifact.artifactType}
                          </strong>
                          {artifact.sourceType ? (
                            <Badge variant="outline">
                              {formatSourceTypeLabel(artifact.sourceType)}
                            </Badge>
                          ) : null}
                          <span>{formatDateTime(artifact.createdAt)}</span>
                          <code>{artifact.url ?? "-"}</code>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <StatusAlert status="warning" title="Sem links">
                    Anexe PRs, docs ou referencias uteis.
                  </StatusAlert>
                )}
              </DetailSection>
            </TabsContent>

            <TabsContent value="focus" className="mt-4">
              {recentSessions.length > 0 ? (
                <ul className="historyList">
                  {recentSessions.map((session) => (
                    <li key={session.id}>
                      <div>
                        <strong>
                          {session.workItemExternalKey
                            ? `${session.workItemExternalKey} · `
                            : ""}
                          {formatDateTime(session.startedAt)}
                        </strong>
                        {session.workItemExternalProvider ? (
                          <Badge variant="outline">
                            {formatPmProviderLabel(
                              session.workItemExternalProvider,
                            )}
                          </Badge>
                        ) : null}
                        {session.sourceType ? (
                          <Badge variant="outline">
                            {formatSourceTypeLabel(session.sourceType)}
                          </Badge>
                        ) : null}
                        <span>
                          {session.branchName ?? "Branch nao registrada"}
                        </span>
                        <span>{session.goal ?? "Sem objetivo registrado"}</span>
                      </div>
                      <div className="historyMeta">
                        <code>
                          {session.result ?? "Ainda sem resultado final"}
                        </code>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => onResumeSession(session)}
                        >
                          Retomar
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <StatusAlert status="warning" title="Sem sessoes anteriores">
                  Quando encerrar um foco, ele aparece aqui.
                </StatusAlert>
              )}
            </TabsContent>
          </Tabs>

          <TaskDependencyDialog
            open={dependencyDialogOpen}
            onOpenChange={setDependencyDialogOpen}
            taskTitle={currentTask.title}
            taskOptions={dependencyTaskOptions}
            busy={dependencyBusy}
            error={dependencyError}
            onSubmit={handleCreateDependency}
            onClearError={onClearDependencyError}
          />
          <TaskNoteDialog
            open={noteDialogOpen}
            onOpenChange={setNoteDialogOpen}
            busy={contextBusy}
            onSubmit={handleSaveNote}
          />
          <TaskArtifactDialog
            open={artifactDialogOpen}
            onOpenChange={setArtifactDialogOpen}
            busy={contextBusy}
            onSubmit={handleAttachArtifact}
          />
        </div>
      ) : (
        <StatusAlert status="warning" title="Escolha uma tarefa">
          A lista ao lado mostra tudo que esta no seu backlog.
        </StatusAlert>
      )}
    </div>
  );
}
