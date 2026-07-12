import {
  ConfirmDialog,
  ContextStepsBar,
  FilterTabs,
  HistoryEventButton,
  MainViewTabs,
  OrganizationAvatar,
  PageHeader,
  PlanStatusBadge,
  SearchField,
  SearchResultButton,
  SectionTitle,
  SelectableListItem,
  StatusAlert,
  StatusBadge,
  TimelineEntry,
} from "@/components/app-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  HISTORY_KIND_ICONS,
  ORG_TAB_ICONS,
  getSearchKindIcon,
} from "@/lib/app-icons";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  buildContextChainLabel,
  buildWorkContextEntityRefs,
  listOrganizationContextGaps,
  validateWorkContextLinks,
  type PmSyncFilter,
} from "@wcp/domain";
import {
  ArrowRightLeft,
  Building2,
  FolderGit2,
  GitBranch,
  History,
  Image,
  Info,
  Link2,
  ListTodo,
  Plug,
  Plus,
  Save,
  ScanSearch,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

interface TodaySummary {
  executableCount: number;
  blockedCount: number;
  doingCount: number;
}

interface WorkItemDto {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority?: number;
  blockedReason?: string | null;
  resumeSummary?: string | null;
  organizationId?: string | null;
  projectId?: string | null;
  primaryRepositoryId?: string | null;
  sourceType?: string;
  scheduledFor?: string | null;
  externalProvider?: string | null;
  externalId?: string | null;
  externalKey?: string | null;
  externalUrl?: string | null;
  wcpDismissedAt?: string | null;
  updatedAt?: string;
}

interface ProjectListItemDto {
  id: string;
  name: string;
  organizationId?: string | null;
  description?: string | null;
  isActive?: boolean;
}

interface TaskFormDraft {
  title: string;
  description: string;
  status: string;
  priority: number;
  organizationId: string;
  projectId: string;
  primaryRepositoryId: string;
  blockedReason: string;
  resumeSummary: string;
}

type TaskFormMode = "create" | "edit" | null;

interface TodayFocusDto {
  headline: string;
  nextStep: string;
  focusKind: string;
  taskId?: string | null;
  taskTitle?: string | null;
  primaryRepositoryId?: string | null;
  primaryRepositoryName?: string | null;
  sessionGoal?: string | null;
  blockerLabel?: string | null;
  dependencyLabel?: string | null;
  resumeHint?: string | null;
  signals: string[];
  deadlineSignals?: string[];
  suggestedByDeadline?: boolean;
}

interface PlanItemDto {
  id: string;
  workItemId: string;
  position: number;
  isCommitted: boolean;
}

interface RecoverableContextCandidateDto {
  workItemId: string;
  score: number;
  reasons: string[];
}

interface ValidationCheckDto {
  key: string;
  status: string;
  expected?: string | null;
  actual?: string | null;
  message: string;
}

interface IdentityValidationDto {
  status: string;
  checks: ValidationCheckDto[];
}

interface RepositoryGuardrailDto {
  repositoryId: string;
  repositoryName: string;
  organizationId?: string | null;
  organizationName?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  environmentName?: string | null;
  identitySource?: string | null;
  providerHost?: string | null;
  remoteUrl?: string | null;
  localPath?: string | null;
  expectedGitUserName?: string | null;
  expectedGitUserEmail?: string | null;
  expectedSshHostAlias?: string | null;
  expectedBranchPattern?: string | null;
  providerUsername?: string | null;
  providerAccountLabel?: string | null;
  validation?: IdentityValidationDto | null;
  chainLabel?: string | null;
}

interface RepositoryListItemDto {
  id: string;
  name: string;
  localPath?: string | null;
  providerHost?: string | null;
  remoteUrl?: string | null;
  defaultBranch?: string | null;
  isActive: boolean;
  organizationId?: string | null;
  organizationName?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  environmentProfileId?: string | null;
  environmentName?: string | null;
  expectedGitUserName?: string | null;
  expectedGitUserEmail?: string | null;
}

interface OrganizationListItemDto {
  id: string;
  name: string;
  kind?: string;
  isActive?: boolean;
  logoPath?: string | null;
  environmentProfileId?: string | null;
  environmentName?: string | null;
  providerType?: string | null;
  providerHost?: string | null;
  sshHostAlias?: string | null;
  gitUserName?: string | null;
  gitUserEmail?: string | null;
  branchPattern?: string | null;
  prConvention?: string | null;
  commitConvention?: string | null;
  notesJson?: string | null;
}

interface LocalRepositoryInspectionDto {
  localPath: string;
  pathExists: boolean;
  isGitRepo: boolean;
  suggestedName?: string | null;
  remoteUrl?: string | null;
  providerHost?: string | null;
  defaultBranch?: string | null;
  gitUserName?: string | null;
  gitUserEmail?: string | null;
  sshHostAlias?: string | null;
  suggestedProviderType?: string | null;
  gitUserNameSource?: string | null;
  gitUserEmailSource?: string | null;
}

interface OrganizationIdentityImportDto {
  repositoryId: string;
  repositoryName: string;
  providerType?: string | null;
  providerHost?: string | null;
  sshHostAlias?: string | null;
  gitUserName?: string | null;
  gitUserEmail?: string | null;
  remoteUrl?: string | null;
  defaultBranch?: string | null;
  sources: string[];
}

interface FixRepositoryRemoteResultDto {
  repositoryId: string;
  previousRemoteUrl?: string | null;
  updatedRemoteUrl?: string | null;
  changed: boolean;
}

interface SshConfigHostEntryDto {
  sectionLabel?: string | null;
  hostAlias: string;
  hostName?: string | null;
  identityFile?: string | null;
  lineStart: number;
  lineEnd: number;
}

interface ApplyFullContextResultDto {
  repositoryId: string;
  identityChanges: string[];
  remoteChanged: boolean;
  previousRemoteUrl?: string | null;
  updatedRemoteUrl?: string | null;
  validation?: IdentityValidationDto | null;
}

interface IntegrationConnectionDto {
  id: string;
  organizationId: string;
  provider: string;
  displayName?: string | null;
  configJson: string;
  hasCredentials: boolean;
  isActive: boolean;
  syncEnabled: boolean;
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
  syncFilterJson?: string | null;
}

type SyncFilterFormState = {
  assigneeOnly: boolean;
  includeClosed: boolean;
  focusCurrentWork: boolean;
  updatedWithinDays: number;
  jql: string;
};

const DEFAULT_SYNC_FILTER: SyncFilterFormState = {
  assigneeOnly: true,
  includeClosed: false,
  focusCurrentWork: true,
  updatedWithinDays: 21,
  jql: "",
};

function parseSyncFilterJson(raw?: string | null): SyncFilterFormState {
  if (!raw) {
    return { ...DEFAULT_SYNC_FILTER };
  }

  try {
    const value = JSON.parse(raw) as PmSyncFilter;
    return {
      assigneeOnly: value.assigneeOnly ?? true,
      includeClosed: value.includeClosed ?? false,
      focusCurrentWork: value.focusCurrentWork ?? true,
      updatedWithinDays: value.updatedWithinDays ?? 21,
      jql: value.jql ?? "",
    };
  } catch {
    return { ...DEFAULT_SYNC_FILTER };
  }
}

function buildSyncFilterJson(state: SyncFilterFormState): string {
  return JSON.stringify({
    assigneeOnly: state.assigneeOnly,
    includeClosed: state.includeClosed,
    focusCurrentWork: state.focusCurrentWork,
    updatedWithinDays: state.updatedWithinDays,
    jql: state.jql.trim() || null,
  });
}

function describeJiraSyncFilter(state: SyncFilterFormState): string {
  if (state.jql.trim()) {
    return state.jql.trim();
  }

  const parts = ["assignee = currentUser()"];
  if (!state.includeClosed) {
    parts.push("resolution = Unresolved");
  }
  if (state.focusCurrentWork) {
    parts.push(
      `(sprint in openSprints() OR updated >= -${state.updatedWithinDays}d)`,
    );
  }
  return `${parts.join(" AND ")} ORDER BY updated DESC`;
}

interface ClickUpTeamDto {
  id: string;
  name: string;
}

interface PmSyncResultDto {
  created: number;
  updated: number;
  unchanged: number;
  removed: number;
  errors: string[];
}

interface DeadlineAlertItemDto {
  workItemId: string;
  title: string;
  scheduledFor: string;
  externalProvider?: string | null;
  externalUrl?: string | null;
  kind: string;
  hoursUntilDue: number;
  organizationId?: string | null;
  organizationName?: string | null;
}

interface PmProjectMappingDto {
  id: string;
  organizationId: string;
  integrationConnectionId?: string | null;
  externalProjectKey: string;
  projectId: string;
  projectName?: string | null;
  defaultRepositoryId?: string | null;
  defaultRepositoryName?: string | null;
}

interface ApplyWorkItemContextResultDto {
  workItemId: string;
  needsRepositoryLink: boolean;
  repositoryId?: string | null;
  repositoryName?: string | null;
  context?: {
    repositoryId: string;
    identityChanges: string[];
    remoteChanged: boolean;
    validation?: IdentityValidationDto | null;
  } | null;
  guardrail?: RepositoryGuardrailDto | null;
}

type IntegrationWizardStep =
  | "choose"
  | "test"
  | "save"
  | "filters"
  | "sync"
  | "review";

interface DeadlineAlertsDto {
  overdue: DeadlineAlertItemDto[];
  dueToday: DeadlineAlertItemDto[];
  dueSoon: DeadlineAlertItemDto[];
  items: DeadlineAlertItemDto[];
}

interface CreateRepositoryResultDto {
  repository: RepositoryListItemDto;
}

interface ResolvedWorkContextDto {
  organizationId?: string | null;
  organizationName?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  repositoryId?: string | null;
  repositoryName?: string | null;
  environmentProfileId?: string | null;
  environmentName?: string | null;
  identitySource?: string | null;
  expectedGitUserName?: string | null;
  expectedGitUserEmail?: string | null;
  providerHost?: string | null;
  branchPattern?: string | null;
  chainLabel?: string | null;
  gaps?: string[];
  inferredOrganizationFrom?: string | null;
}

interface UpdateRepositoryResultDto {
  repository: RepositoryListItemDto;
}

interface ContextSwitchCheck {
  id: string;
  label: string;
  message: string;
  status: "ok" | "warning" | "mismatch";
}

interface RepositoryMemoryDto {
  repositoryId: string;
  notes: KnowledgeNoteDto[];
}

interface SessionLogDto {
  id: string;
  workItemId?: string | null;
  repositoryId?: string | null;
  branchName?: string | null;
  startedAt: string;
  endedAt?: string | null;
  goal?: string | null;
  decisions?: string | null;
  result?: string | null;
  sourceType?: string;
  workItemExternalKey?: string | null;
  workItemExternalProvider?: string | null;
}

interface KnowledgeNoteDto {
  id: string;
  entityType: string;
  entityId: string;
  noteType: string;
  title: string;
  content: string;
  sourceType: string;
  createdAt: string;
}

interface ArtifactDto {
  id: string;
  repositoryId?: string | null;
  artifactType: string;
  title?: string | null;
  url?: string | null;
  createdAt: string;
  sourceType?: string;
}

interface DashboardDto {
  summary: TodaySummary;
  todayFocus: TodayFocusDto;
  currentTask?: WorkItemDto | null;
  activeSession?: SessionLogDto | null;
  recentTaskSessions: SessionLogDto[];
  taskNotes: KnowledgeNoteDto[];
  taskArtifacts: ArtifactDto[];
  todayPlan: PlanItemDto[];
  recoverableContext: RecoverableContextCandidateDto[];
  guardrail?: RepositoryGuardrailDto | null;
  backlog: WorkItemDto[];
}

interface TaskContextDto {
  task?: WorkItemDto | null;
  recentTaskSessions: SessionLogDto[];
  taskNotes: KnowledgeNoteDto[];
  taskArtifacts: ArtifactDto[];
  recoverableContext: RecoverableContextCandidateDto[];
  dependencies: TaskDependencyDto[];
}

interface TaskDependencyDto {
  id: string;
  relatedWorkItemId: string;
  title: string;
  status: string;
  relation: string;
  dependencyType: string;
}

interface TimelineEntryDto {
  id: string;
  kind: "session" | "note" | "artifact" | "dependency" | "block" | "change";
  title: string;
  detail: string;
  createdAt: string;
}

interface ApplyIdentityResultDto {
  repositoryId: string;
  appliedChanges: string[];
  validation?: IdentityValidationDto | null;
}

interface InstallPrePushHookResultDto {
  repositoryId: string;
  hookPath: string;
  installed: boolean;
}

interface RepositoryHookStatusDto {
  repositoryId: string;
  hookPath?: string | null;
  installed: boolean;
  managedByApp: boolean;
}

interface RemovePrePushHookResultDto {
  repositoryId: string;
  removed: boolean;
}

interface StartSessionResultDto {
  session: SessionLogDto;
}

interface EndSessionResultDto {
  session: SessionLogDto;
}

interface SaveNoteResultDto {
  note: KnowledgeNoteDto;
}

interface AttachArtifactResultDto {
  artifact: ArtifactDto;
}

type SearchResultKind =
  | "task"
  | "note"
  | "session"
  | "artifact"
  | "repository"
  | "dependency";

interface SearchResultDto {
  id: string;
  kind: SearchResultKind;
  title: string;
  detail: string;
  createdAt?: string | null;
  workItemId?: string | null;
  repositoryId?: string | null;
}

type ContextEventKind =
  | "session"
  | "decision"
  | "note"
  | "artifact"
  | "block"
  | "dependency"
  | "repository"
  | "task";

interface ContextEventDto {
  id: string;
  kind: ContextEventKind;
  title: string;
  detail: string;
  createdAt: string;
  workItemId?: string | null;
  workItemTitle?: string | null;
  repositoryId?: string | null;
  repositoryName?: string | null;
  organizationId?: string | null;
  organizationName?: string | null;
}

type DesktopView = "today" | "backlog" | "organizations" | "repos" | "history";

type OrgDetailTab =
  | "company"
  | "projects"
  | "repos"
  | "identity"
  | "integrations";

type TimelineFilter = "all" | TimelineEntryDto["kind"];

type HistoryKindFilter = "all" | ContextEventKind;

const TASK_STATUS_OPTIONS = [
  { value: "todo", label: "A fazer" },
  { value: "doing", label: "Em andamento" },
  { value: "blocked", label: "Bloqueada" },
  { value: "backlog", label: "Backlog" },
  { value: "done", label: "Concluida" },
] as const;

const TASK_PRIORITY_OPTIONS = [
  { value: 1, label: "1 · Urgente" },
  { value: 2, label: "2 · Alta" },
  { value: 3, label: "3 · Normal" },
  { value: 4, label: "4 · Baixa" },
  { value: 5, label: "5 · Algum dia" },
] as const;

const QUICK_STATUS_OPTIONS = [
  { value: "todo", label: "A fazer" },
  { value: "doing", label: "Em andamento" },
  { value: "blocked", label: "Bloqueada" },
  { value: "done", label: "Concluida" },
] as const;

const BACKLOG_STATUS_FILTERS = [
  { value: "all", label: "Todas" },
  { value: "blocked", label: "Bloqueadas" },
  { value: "todo", label: "A fazer" },
  { value: "doing", label: "Em andamento" },
  { value: "done", label: "Concluidas" },
  { value: "backlog", label: "Backlog" },
] as const;

const BACKLOG_SORT_OPTIONS = [
  { value: "priority", label: "Prioridade" },
  { value: "scheduled_for", label: "Prazo" },
  { value: "title", label: "Titulo" },
  { value: "status", label: "Status" },
] as const;

const BACKLOG_SOURCE_FILTERS = [
  { value: "all", label: "Todas as origens" },
  { value: "manual", label: "Manuais" },
  { value: "imported", label: "Importadas" },
  { value: "jira", label: "Jira" },
  { value: "clickup", label: "ClickUp" },
] as const;

const BACKLOG_DEADLINE_FILTERS = [
  { value: "all", label: "Todos os prazos" },
  { value: "overdue", label: "Vencidas" },
  { value: "due_today", label: "Vence hoje" },
  { value: "due_soon", label: "Em breve" },
  { value: "no_deadline", label: "Sem prazo" },
] as const;

const TIMELINE_FILTERS: { id: TimelineFilter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "session", label: "Sessoes" },
  { id: "change", label: "Alteracoes" },
  { id: "note", label: "Notas" },
  { id: "artifact", label: "Artefatos" },
  { id: "dependency", label: "Dependencias" },
  { id: "block", label: "Bloqueios" },
];

const VIEW_PAGE_HINT: Record<DesktopView, string> = {
  today: "Um resumo do que importa agora e onde colocar o foco.",
  backlog: "Escolha uma tarefa e veja tudo que ja foi registrado sobre ela.",
  organizations: "Cadastre empresas, projetos e repos com contexto Git claro.",
  repos: "Confira o ambiente Git antes de comecar a trabalhar no projeto.",
  history:
    "Retome qualquer contexto sem depender da tarefa que esta aberta agora.",
};

const ORG_DETAIL_TABS: { id: OrgDetailTab; label: string }[] = [
  { id: "company", label: "Empresa" },
  { id: "projects", label: "Projetos" },
  { id: "repos", label: "Repos" },
  { id: "identity", label: "Identidade Git" },
  { id: "integrations", label: "Integracoes" },
];

const HISTORY_KIND_FILTERS: { id: HistoryKindFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "session", label: "Sessoes" },
  { id: "decision", label: "Decisoes" },
  { id: "note", label: "Notas" },
  { id: "artifact", label: "Artefatos" },
  { id: "task", label: "Tarefas" },
  { id: "block", label: "Bloqueios" },
  { id: "dependency", label: "Dependencias" },
  { id: "repository", label: "Projetos" },
];

const SEARCH_KIND_ORDER: SearchResultKind[] = [
  "task",
  "note",
  "session",
  "artifact",
  "repository",
  "dependency",
];

const CONTEXT_STEPS = [
  { step: 1, label: "Empresa" },
  { step: 2, label: "Repositorio" },
  { step: 3, label: "Conferir" },
  { step: 4, label: "Aplicar" },
  { step: 5, label: "Proteger" },
  { step: 6, label: "Pronto" },
] as const;

const CONTEXT_STEP_HINTS: Record<number, string> = {
  1: "Escolha a empresa e confira a identidade Git esperada.",
  2: "Selecione o repositorio em que vai trabalhar.",
  3: "Valide o ambiente local antes de aplicar qualquer mudanca.",
  4: "Ajuste user.name e user.email no repo se estiverem divergentes.",
  5: "Instale ou repare a protecao pre-push do repositorio.",
  6: "Contexto pronto — pode comecar a trabalhar com seguranca.",
};

async function pickLocalFolder(
  defaultPath?: string | null,
): Promise<string | null> {
  const picked = await open({
    title: "Selecione a pasta do projeto Git",
    directory: true,
    multiple: false,
    defaultPath: defaultPath?.trim() || undefined,
  });

  if (picked === null) {
    return null;
  }

  return Array.isArray(picked) ? (picked[0] ?? null) : picked;
}

async function pickOrganizationLogoFile(): Promise<string | null> {
  const picked = await open({
    title: "Selecione o logo da empresa",
    directory: false,
    multiple: false,
    filters: [
      {
        name: "Imagem",
        extensions: ["png", "jpg", "jpeg", "webp", "gif", "svg"],
      },
    ],
  });

  if (picked === null) {
    return null;
  }

  return Array.isArray(picked) ? (picked[0] ?? null) : picked;
}

interface LocalPathFieldProps {
  path: string;
  inspecting: boolean;
  onPathChange: (value: string) => void;
  onBrowse: () => void;
  onInspect: () => void;
}

interface TaskFormPanelProps {
  mode: "create" | "edit";
  draft: TaskFormDraft;
  busy: boolean;
  error: string | null;
  warnings: string[];
  organizations: OrganizationListItemDto[];
  organizationLogoUrls: Record<string, string>;
  projects: ProjectListItemDto[];
  repositories: RepositoryListItemDto[];
  onDraftChange: (patch: Partial<TaskFormDraft>) => void;
  onCancel: () => void;
  onSave: () => void;
}

function TaskFormPanel({
  mode,
  draft,
  busy,
  error,
  warnings,
  organizations,
  organizationLogoUrls,
  projects,
  repositories,
  onDraftChange,
  onCancel,
  onSave,
}: TaskFormPanelProps) {
  const filteredProjects = draft.organizationId
    ? projects.filter(
        (project) => project.organizationId === draft.organizationId,
      )
    : projects;
  const filteredRepositories = draft.organizationId
    ? repositories.filter(
        (repository) => repository.organizationId === draft.organizationId,
      )
    : repositories;
  const selectedOrganization = draft.organizationId
    ? (organizations.find(
        (organization) => organization.id === draft.organizationId,
      ) ?? null)
    : null;

  return (
    <Card className="border-primary/20">
      <CardContent className="grid gap-4 p-5 pt-5">
        <div className="panelHeading">
          <h3 className="subheading">
            {mode === "create" ? "Nova tarefa" : "Editar tarefa"}
          </h3>
          <p className="muted">
            Registre o essencial para retomar depois sem perder contexto.
          </p>
        </div>

        <div className="sessionForm compactForm">
          <label className="grid gap-2 text-sm">
            <Label htmlFor="task-title">Titulo</Label>
            <Input
              id="task-title"
              value={draft.title}
              onChange={(event) => onDraftChange({ title: event.target.value })}
              placeholder="Ex.: corrigir refresh token no login"
            />
          </label>

          <label className="grid gap-2 text-sm">
            <Label htmlFor="task-description">Descricao curta</Label>
            <Textarea
              id="task-description"
              value={draft.description}
              onChange={(event) =>
                onDraftChange({ description: event.target.value })
              }
              placeholder="O que precisa ser feito, em uma frase"
              rows={3}
            />
          </label>

          <div className="historyFilterRow">
            <label className="grid gap-2 text-sm text-muted-foreground">
              <Label htmlFor="task-status">Status</Label>
              <select
                id="task-status"
                value={draft.status}
                onChange={(event) =>
                  onDraftChange({ status: event.target.value })
                }
              >
                {TASK_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm text-muted-foreground">
              <Label htmlFor="task-priority">Prioridade</Label>
              <select
                id="task-priority"
                value={draft.priority}
                onChange={(event) =>
                  onDraftChange({ priority: Number(event.target.value) })
                }
              >
                {TASK_PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="historyFilterRow">
            <label className="grid gap-2 text-sm text-muted-foreground">
              <Label htmlFor="task-org">Empresa</Label>
              <select
                id="task-org"
                value={draft.organizationId}
                onChange={(event) =>
                  onDraftChange({
                    organizationId: event.target.value,
                    projectId: "",
                    primaryRepositoryId: "",
                  })
                }
              >
                <option value="">Nenhuma</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
              {selectedOrganization ? (
                <span className="taskOrgPreview">
                  <OrganizationAvatar
                    name={selectedOrganization.name}
                    kind={selectedOrganization.kind}
                    logoUrl={
                      organizationLogoUrls[selectedOrganization.id] ?? null
                    }
                    size="sm"
                  />
                  <span>{selectedOrganization.name}</span>
                </span>
              ) : null}
            </label>
            <label className="grid gap-2 text-sm text-muted-foreground">
              <Label htmlFor="task-project">Projeto</Label>
              <select
                id="task-project"
                value={draft.projectId}
                onChange={(event) =>
                  onDraftChange({ projectId: event.target.value })
                }
              >
                <option value="">Nenhum</option>
                {filteredProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm text-muted-foreground">
              <Label htmlFor="task-repo">Repositorio principal</Label>
              <select
                id="task-repo"
                value={draft.primaryRepositoryId}
                onChange={(event) =>
                  onDraftChange({ primaryRepositoryId: event.target.value })
                }
              >
                <option value="">Nenhum</option>
                {filteredRepositories.map((repository) => (
                  <option key={repository.id} value={repository.id}>
                    {repository.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {draft.status === "blocked" ? (
            <label className="grid gap-2 text-sm">
              <Label htmlFor="task-blocked">Motivo do bloqueio</Label>
              <Textarea
                id="task-blocked"
                value={draft.blockedReason}
                onChange={(event) =>
                  onDraftChange({ blockedReason: event.target.value })
                }
                placeholder="Ex.: aguardando definicao da task #128"
                rows={2}
              />
            </label>
          ) : null}

          <label className="grid gap-2 text-sm">
            <Label htmlFor="task-resume">Resumo de retomada</Label>
            <Textarea
              id="task-resume"
              value={draft.resumeSummary}
              onChange={(event) =>
                onDraftChange({ resumeSummary: event.target.value })
              }
              placeholder="O que voce precisa lembrar para continuar depois"
              rows={2}
            />
          </label>

          {warnings.length > 0 ? (
            <StatusAlert status="warning" title="Revise antes de salvar">
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </StatusAlert>
          ) : null}

          {error ? <p className="errorText">{error}</p> : null}

          <div className="actionRow">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="button" onClick={onSave} disabled={busy}>
              {busy
                ? "Salvando..."
                : mode === "create"
                  ? "Criar tarefa"
                  : "Salvar alteracoes"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LocalPathField({
  path,
  inspecting,
  onPathChange,
  onBrowse,
  onInspect,
}: LocalPathFieldProps) {
  return (
    <label className="grid gap-2 text-sm">
      <Label>Pasta local</Label>
      <div className="inputWithAction flex flex-wrap gap-2">
        <Input
          className="min-w-[240px] flex-1"
          value={path}
          onChange={(event) => onPathChange(event.target.value)}
          placeholder="/Users/voce/Code/meu-projeto"
        />
        <Button type="button" variant="outline" onClick={onBrowse}>
          Escolher pasta
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onInspect}
          disabled={inspecting || !path.trim()}
        >
          {inspecting ? "Detectando..." : "Detectar Git"}
        </Button>
      </div>
    </label>
  );
}

export function App() {
  const [data, setData] = useState<DashboardDto | null>(null);
  const [taskContext, setTaskContext] = useState<TaskContextDto | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<DesktopView>("today");
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>("all");
  const [repositories, setRepositories] = useState<RepositoryListItemDto[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationListItemDto[]>(
    [],
  );
  const [projects, setProjects] = useState<ProjectListItemDto[]>([]);
  const [taskFormMode, setTaskFormMode] = useState<TaskFormMode>(null);
  const [taskFormDraft, setTaskFormDraft] =
    useState<TaskFormDraft>(emptyTaskFormDraft());
  const [taskFormBusy, setTaskFormBusy] = useState(false);
  const [taskFormError, setTaskFormError] = useState<string | null>(null);
  const [taskFormBaseline, setTaskFormBaseline] =
    useState<TaskFormDraft | null>(null);
  const [showArchivedBacklog, setShowArchivedBacklog] = useState(false);
  const [showDismissedBacklog, setShowDismissedBacklog] = useState(false);
  const [backlogSearchQuery, setBacklogSearchQuery] = useState("");
  const [backlogStatusFilter, setBacklogStatusFilter] = useState<string>("all");
  const [backlogOrgFilter, setBacklogOrgFilter] = useState<string>("all");
  const [backlogSourceFilter, setBacklogSourceFilter] = useState<string>("all");
  const [backlogDeadlineFilter, setBacklogDeadlineFilter] =
    useState<string>("all");
  const [backlogSort, setBacklogSort] = useState<
    "priority" | "scheduled_for" | "title" | "status"
  >("priority");
  const [resumeSuggestion, setResumeSuggestion] = useState<{
    taskId: string;
    text: string;
  } | null>(null);
  const [taskActionBusy, setTaskActionBusy] = useState(false);
  const [selectedOrganizationId, setSelectedOrganizationId] =
    useState<string>("all");
  const [contextStep, setContextStep] = useState<number>(1);
  const [preparingContext, setPreparingContext] = useState(false);
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [selectedGuardrail, setSelectedGuardrail] =
    useState<RepositoryGuardrailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [repoLoading, setRepoLoading] = useState(false);
  const [repoMemory, setRepoMemory] = useState<RepositoryMemoryDto | null>(
    null,
  );
  const [applyingIdentity, setApplyingIdentity] = useState(false);
  const [installingHook, setInstallingHook] = useState(false);
  const [removingHook, setRemovingHook] = useState(false);
  const [refreshingRepo, setRefreshingRepo] = useState(false);
  const [applyResult, setApplyResult] = useState<string | null>(null);
  const [hookResult, setHookResult] = useState<string | null>(null);
  const [hookStatus, setHookStatus] = useState<RepositoryHookStatusDto | null>(
    null,
  );
  const [sessionGoal, setSessionGoal] = useState("");
  const [sessionResult, setSessionResult] = useState("");
  const [sessionDecisions, setSessionDecisions] = useState("");
  const [sessionBusy, setSessionBusy] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [artifactTitle, setArtifactTitle] = useState("");
  const [artifactUrl, setArtifactUrl] = useState("");
  const [contextBusy, setContextBusy] = useState(false);
  const [repoNoteTitle, setRepoNoteTitle] = useState("");
  const [repoNoteContent, setRepoNoteContent] = useState("");
  const [dependencyTargetId, setDependencyTargetId] = useState("");
  const [dependencyRelation, setDependencyRelation] = useState<
    "depends_on" | "blocks"
  >("depends_on");
  const [dependencyBusy, setDependencyBusy] = useState(false);
  const [dependencyError, setDependencyError] = useState<string | null>(null);
  const [showAddProjectForm, setShowAddProjectForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectPath, setNewProjectPath] = useState("");
  const [newProjectRemoteUrl, setNewProjectRemoteUrl] = useState("");
  const [newProjectInspection, setNewProjectInspection] =
    useState<LocalRepositoryInspectionDto | null>(null);
  const [newProjectInspecting, setNewProjectInspecting] = useState(false);
  const [newProjectSaving, setNewProjectSaving] = useState(false);
  const [newProjectError, setNewProjectError] = useState<string | null>(null);
  const [showEditProjectPathForm, setShowEditProjectPathForm] = useState(false);
  const [editProjectPath, setEditProjectPath] = useState("");
  const [editProjectRemoteUrl, setEditProjectRemoteUrl] = useState("");
  const [editProjectInspection, setEditProjectInspection] =
    useState<LocalRepositoryInspectionDto | null>(null);
  const [editProjectInspecting, setEditProjectInspecting] = useState(false);
  const [editProjectSaving, setEditProjectSaving] = useState(false);
  const [editProjectError, setEditProjectError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultDto[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);
  const [historyEvents, setHistoryEvents] = useState<ContextEventDto[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyKindFilter, setHistoryKindFilter] =
    useState<HistoryKindFilter>("all");
  const [historyTaskFilter, setHistoryTaskFilter] = useState<string>("all");
  const [historyRepoFilter, setHistoryRepoFilter] = useState<string>("all");
  const [historyOrgFilter, setHistoryOrgFilter] = useState<string>("all");
  const sessionPanelRef = useRef<HTMLElement | null>(null);
  const [historyTextQuery, setHistoryTextQuery] = useState("");
  const [historySearchResults, setHistorySearchResults] = useState<
    SearchResultDto[] | null
  >(null);
  const [historySearchBusy, setHistorySearchBusy] = useState(false);
  const [orgSetupSelectedId, setOrgSetupSelectedId] = useState<string | null>(
    null,
  );
  const [orgDetailTab, setOrgDetailTab] = useState<OrgDetailTab>("company");
  const [showNewOrgForm, setShowNewOrgForm] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgKind, setNewOrgKind] = useState("company");
  const [orgEditName, setOrgEditName] = useState("");
  const [orgEditKind, setOrgEditKind] = useState("company");
  const [orgSetupBusy, setOrgSetupBusy] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description: string;
    confirmLabel?: string;
    destructive?: boolean;
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  const [confirmDialogBusy, setConfirmDialogBusy] = useState(false);
  const [orgSetupError, setOrgSetupError] = useState<string | null>(null);
  const [orgSetupSuccess, setOrgSetupSuccess] = useState<string | null>(null);
  const [orgEnvFormDirty, setOrgEnvFormDirty] = useState(false);
  const [newOrgProjectName, setNewOrgProjectName] = useState("");
  const [newOrgProjectDescription, setNewOrgProjectDescription] = useState("");
  const [orgEnvProviderType, setOrgEnvProviderType] = useState("");
  const [orgEnvProviderHost, setOrgEnvProviderHost] = useState("");
  const [orgEnvSshHostAlias, setOrgEnvSshHostAlias] = useState("");
  const [orgEnvGitUserName, setOrgEnvGitUserName] = useState("");
  const [orgEnvGitUserEmail, setOrgEnvGitUserEmail] = useState("");
  const [orgEnvBranchPattern, setOrgEnvBranchPattern] = useState("");
  const [orgEnvPrConvention, setOrgEnvPrConvention] = useState("");
  const [orgEnvCommitConvention, setOrgEnvCommitConvention] = useState("");
  const [orgUsefulLinks, setOrgUsefulLinks] = useState<
    Array<{ label: string; url: string }>
  >([{ label: "", url: "" }]);
  const [orgLinkProjectId, setOrgLinkProjectId] = useState("");
  const [orgLinkRepoName, setOrgLinkRepoName] = useState("");
  const [orgLinkRepoPath, setOrgLinkRepoPath] = useState("");
  const [orgLinkRepoRemote, setOrgLinkRepoRemote] = useState("");
  const [orgLinkInspection, setOrgLinkInspection] =
    useState<LocalRepositoryInspectionDto | null>(null);
  const [orgLinkInspecting, setOrgLinkInspecting] = useState(false);
  const [reassignRepoId, setReassignRepoId] = useState("");
  const [reassignProjectId, setReassignProjectId] = useState("");
  const [orgIdentityRepoId, setOrgIdentityRepoId] = useState<string | null>(
    null,
  );
  const [orgIdentityImportRepoId, setOrgIdentityImportRepoId] = useState<
    string | null
  >(null);
  const [orgIdentityImportPreview, setOrgIdentityImportPreview] =
    useState<OrganizationIdentityImportDto | null>(null);
  const [orgIdentityGuardrail, setOrgIdentityGuardrail] =
    useState<RepositoryGuardrailDto | null>(null);
  const [orgIdentityBusy, setOrgIdentityBusy] = useState(false);
  const [orgIdentityResult, setOrgIdentityResult] = useState<string | null>(
    null,
  );
  const [orgIdentitySshInputMode, setOrgIdentitySshInputMode] = useState<
    "selector" | "manual"
  >("selector");
  const [sshConfigHosts, setSshConfigHosts] = useState<SshConfigHostEntryDto[]>(
    [],
  );
  const [sshConfigHostsLoading, setSshConfigHostsLoading] = useState(false);
  const [orgIdentitySelectedSshHost, setOrgIdentitySelectedSshHost] =
    useState("");
  const [integrationConnections, setIntegrationConnections] = useState<
    IntegrationConnectionDto[]
  >([]);
  const [integrationBusy, setIntegrationBusy] = useState(false);
  const [integrationMessage, setIntegrationMessage] = useState<string | null>(
    null,
  );
  const [jiraSiteUrl, setJiraSiteUrl] = useState("");
  const [jiraEmail, setJiraEmail] = useState("");
  const [jiraApiToken, setJiraApiToken] = useState("");
  const [clickUpApiToken, setClickUpApiToken] = useState("");
  const [clickUpTeamId, setClickUpTeamId] = useState("");
  const [clickUpTeams, setClickUpTeams] = useState<ClickUpTeamDto[]>([]);
  const [deadlineAlerts, setDeadlineAlerts] =
    useState<DeadlineAlertsDto | null>(null);
  const [taskContextBusy, setTaskContextBusy] = useState(false);
  const [taskContextMessage, setTaskContextMessage] = useState<string | null>(
    null,
  );
  const [integrationWizardStep, setIntegrationWizardStep] =
    useState<IntegrationWizardStep>("choose");
  const [integrationWizardProvider, setIntegrationWizardProvider] = useState<
    "jira" | "clickup" | null
  >(null);
  const [pmProjectMappings, setPmProjectMappings] = useState<
    PmProjectMappingDto[]
  >([]);
  const [pmExternalProjects, setPmExternalProjects] = useState<string[]>([]);
  const [pmMappingDraft, setPmMappingDraft] = useState({
    externalProjectKey: "",
    projectId: "",
    defaultRepositoryId: "",
  });
  const [jiraSyncFilter, setJiraSyncFilter] = useState<SyncFilterFormState>({
    ...DEFAULT_SYNC_FILTER,
  });
  const [clickUpSyncFilter, setClickUpSyncFilter] =
    useState<SyncFilterFormState>({
      ...DEFAULT_SYNC_FILTER,
    });
  const [newRepoProjectId, setNewRepoProjectId] = useState("");
  const [resolvedWorkContext, setResolvedWorkContext] =
    useState<ResolvedWorkContextDto | null>(null);
  const [organizationLogoUrls, setOrganizationLogoUrls] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [dashboard, repoList, orgList, projectList] = await Promise.all([
          invoke<DashboardDto>("load_dashboard_data"),
          invoke<RepositoryListItemDto[]>("list_repositories"),
          invoke<OrganizationListItemDto[]>("list_organizations"),
          invoke<ProjectListItemDto[]>("list_projects"),
        ]);

        if (cancelled) {
          return;
        }

        setData(dashboard);
        setTaskContext({
          task: dashboard.currentTask,
          recentTaskSessions: dashboard.recentTaskSessions,
          taskNotes: dashboard.taskNotes,
          taskArtifacts: dashboard.taskArtifacts,
          recoverableContext: dashboard.recoverableContext,
          dependencies: [],
        });
        setSelectedTaskId(
          dashboard.currentTask?.id ?? dashboard.backlog[0]?.id ?? null,
        );
        setRepositories(repoList);
        setOrganizations(orgList);
        void refreshOrganizationLogos(orgList);
        setProjects(projectList);
        setError(null);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            extractErrorMessage(loadError, "Falha ao carregar dashboard"),
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (organizations.length === 0) {
      setOrgSetupSelectedId(null);
      return;
    }
    if (
      !orgSetupSelectedId ||
      !organizations.some((org) => org.id === orgSetupSelectedId)
    ) {
      setOrgSetupSelectedId(organizations[0]?.id ?? null);
    }
  }, [organizations, orgSetupSelectedId]);

  const orgEnvSyncRef = useRef<string | null>(null);

  useEffect(() => {
    if (orgSetupSelectedId !== orgEnvSyncRef.current) {
      orgEnvSyncRef.current = orgSetupSelectedId;
      const organization =
        organizations.find((org) => org.id === orgSetupSelectedId) ?? null;
      syncOrgEnvForm(organization);
      setOrgIdentityImportPreview(null);
      setOrgEnvFormDirty(false);
      setOrgSetupSuccess(null);
      return;
    }

    if (orgEnvFormDirty) {
      return;
    }

    const organization =
      organizations.find((org) => org.id === orgSetupSelectedId) ?? null;
    syncOrgEnvForm(organization);
    setOrgIdentityImportPreview(null);
  }, [orgSetupSelectedId, organizations, orgEnvFormDirty]);

  useEffect(() => {
    const importableRepos = repositories.filter(
      (repository) =>
        repository.organizationId === orgSetupSelectedId &&
        repository.localPath?.trim(),
    );

    setOrgIdentityImportRepoId((current) => {
      if (importableRepos.length === 0) {
        return null;
      }
      if (
        current &&
        importableRepos.some((repository) => repository.id === current)
      ) {
        return current;
      }
      return importableRepos[0]?.id ?? null;
    });
  }, [orgSetupSelectedId, repositories]);

  useEffect(() => {
    if (orgDetailTab !== "identity") {
      return;
    }

    let cancelled = false;
    setSshConfigHostsLoading(true);

    invoke<SshConfigHostEntryDto[]>("list_ssh_config_hosts")
      .then((hosts) => {
        if (cancelled) {
          return;
        }
        setSshConfigHosts(hosts);
        if (hosts.length === 0) {
          setOrgIdentitySshInputMode("manual");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSshConfigHosts([]);
          setOrgIdentitySshInputMode("manual");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSshConfigHostsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [orgDetailTab, orgSetupSelectedId]);

  useEffect(() => {
    if (orgEnvFormDirty || sshConfigHosts.length === 0) {
      return;
    }

    const savedAlias = orgEnvSshHostAlias.trim();
    if (!savedAlias) {
      setOrgIdentitySelectedSshHost("");
      return;
    }

    const match = sshConfigHosts.find(
      (entry) => entry.hostAlias === savedAlias,
    );
    if (match) {
      setOrgIdentitySelectedSshHost(match.hostAlias);
      setOrgIdentitySshInputMode("selector");
      return;
    }

    setOrgIdentitySshInputMode("manual");
  }, [orgEnvSshHostAlias, orgEnvFormDirty, sshConfigHosts]);

  useEffect(() => {
    if (!orgSetupSelectedId) {
      setIntegrationConnections([]);
      clearIntegrationFormState();
      setIntegrationMessage(null);
      return;
    }

    clearIntegrationFormState();
    setIntegrationMessage(null);

    let cancelled = false;
    invoke<IntegrationConnectionDto[]>("list_integration_connections", {
      organizationId: orgSetupSelectedId,
    })
      .then((connections) => {
        if (cancelled) {
          return;
        }
        applyIntegrationConnectionsToForm(connections, {
          loadClickUpTeams: orgDetailTab === "integrations",
        });
      })
      .catch(() => {
        if (!cancelled) {
          setIntegrationConnections([]);
          clearIntegrationFormState();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [orgSetupSelectedId, orgDetailTab]);

  useEffect(() => {
    if (!orgSetupSelectedId || activeView !== "organizations") {
      return;
    }
    setBacklogOrgFilter(orgSetupSelectedId);
  }, [activeView, orgSetupSelectedId]);

  useEffect(() => {
    if (orgDetailTab !== "integrations" || !orgSetupSelectedId) {
      return;
    }

    let cancelled = false;
    void Promise.all([
      invoke<PmProjectMappingDto[]>("list_pm_project_mappings_command", {
        organizationId: orgSetupSelectedId,
      }),
      invoke<string[]>("list_pm_external_projects", {
        organizationId: orgSetupSelectedId,
      }),
    ])
      .then(([mappings, externalProjects]) => {
        if (!cancelled) {
          setPmProjectMappings(mappings);
          setPmExternalProjects(externalProjects);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPmProjectMappings([]);
          setPmExternalProjects([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [orgDetailTab, orgSetupSelectedId, integrationConnections]);

  useEffect(() => {
    if (activeView !== "today") {
      return;
    }

    let cancelled = false;

    invoke<DeadlineAlertsDto>("get_deadline_alerts")
      .then((alerts) => {
        if (!cancelled) {
          setDeadlineAlerts(alerts);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDeadlineAlerts(null);
        }
      });

    void invoke<number>("notify_deadline_alerts").catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [activeView]);

  useEffect(() => {
    if (activeView !== "backlog" && activeView !== "today") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        for (const organization of organizations) {
          try {
            await invoke<PmSyncResultDto>(
              "sync_organization_pm_tasks_command",
              {
                organizationId: organization.id,
              },
            );
          } catch {
            // sync silencioso em background
          }
        }
        await refreshDashboard();
        if (activeView === "today") {
          try {
            const alerts = await invoke<DeadlineAlertsDto>(
              "get_deadline_alerts",
            );
            setDeadlineAlerts(alerts);
            await invoke<number>("notify_deadline_alerts");
          } catch {
            // alertas opcionais
          }
        }
      })();
    }, 2000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeView, organizations]);

  useEffect(() => {
    if (activeView !== "backlog" && activeView !== "today") {
      return;
    }

    const intervalId = window.setInterval(
      () => {
        void (async () => {
          for (const organization of organizations) {
            try {
              await invoke<PmSyncResultDto>(
                "sync_organization_pm_tasks_command",
                {
                  organizationId: organization.id,
                },
              );
            } catch {
              // sync periodico silencioso
            }
          }
          await refreshDashboard();
        })();
      },
      30 * 60 * 1000,
    );

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeView, organizations]);

  useEffect(() => {
    if (activeView !== "repos" && activeView !== "organizations") {
      return;
    }

    const organizationId =
      activeView === "repos"
        ? selectedOrganizationId !== "all"
          ? selectedOrganizationId
          : null
        : orgSetupSelectedId;
    const projectId =
      activeView === "repos" && newRepoProjectId.trim()
        ? newRepoProjectId.trim()
        : null;
    const repositoryId = activeView === "repos" ? selectedRepoId : null;

    if (!organizationId && !projectId && !repositoryId) {
      setResolvedWorkContext(null);
      return;
    }

    let cancelled = false;

    invoke<ResolvedWorkContextDto>("resolve_work_context", {
      organizationId,
      projectId,
      repositoryId,
    })
      .then((response) => {
        if (!cancelled) {
          setResolvedWorkContext(response);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedWorkContext(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeView,
    newRepoProjectId,
    orgSetupSelectedId,
    organizations,
    selectedOrganizationId,
    selectedRepoId,
  ]);

  useEffect(() => {
    setTimelineFilter("all");
    setDependencyTargetId("");
    setDependencyRelation("depends_on");
    setDependencyError(null);
  }, [selectedTaskId]);

  useEffect(() => {
    if (!selectedTaskId) {
      return;
    }

    let cancelled = false;

    async function loadTaskContext() {
      try {
        const response = await invoke<TaskContextDto>("get_task_context", {
          workItemId: selectedTaskId,
        });

        if (!cancelled) {
          setTaskContext(response);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(extractErrorMessage(loadError, "Falha ao carregar tarefa"));
        }
      }
    }

    loadTaskContext();

    return () => {
      cancelled = true;
    };
  }, [selectedTaskId]);

  useEffect(() => {
    if (!selectedRepoId) {
      setSelectedGuardrail(null);
      setHookStatus(null);
      return;
    }

    let cancelled = false;
    setRepoLoading(true);

    async function loadGuardrail() {
      try {
        const [response, hook, memory] = await Promise.all([
          invoke<RepositoryGuardrailDto | null>("get_repository_guardrail", {
            repositoryId: selectedRepoId,
          }),
          invoke<RepositoryHookStatusDto>("get_repository_hook_status", {
            repositoryId: selectedRepoId,
          }),
          invoke<RepositoryMemoryDto>("get_repository_memory", {
            repositoryId: selectedRepoId,
          }),
        ]);

        if (!cancelled) {
          setSelectedGuardrail(response);
          setHookStatus(hook);
          setRepoMemory(memory);
          setRepoError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setRepoError(
            extractErrorMessage(loadError, "Falha ao validar repositorio"),
          );
        }
      } finally {
        if (!cancelled) {
          setRepoLoading(false);
        }
      }
    }

    loadGuardrail();

    return () => {
      cancelled = true;
    };
  }, [selectedRepoId]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      setSearchBusy(false);
      return;
    }

    setSearchOpen(true);
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setSearchBusy(true);
        const results = await invoke<SearchResultDto[]>(
          "search_local_history",
          {
            query: trimmed,
          },
        );
        if (!cancelled) {
          setSearchResults(results);
        }
      } catch {
        if (!cancelled) {
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearchBusy(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  useEffect(() => {
    if (activeView !== "history") {
      return;
    }

    let cancelled = false;

    async function loadHistory() {
      try {
        setHistoryLoading(true);
        setHistoryError(null);
        const events = await invoke<ContextEventDto[]>("list_context_history", {
          limit: 150,
        });
        if (!cancelled) {
          setHistoryEvents(events);
        }
      } catch (loadError) {
        if (!cancelled) {
          setHistoryError(
            extractErrorMessage(loadError, "Falha ao carregar historico"),
          );
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    }

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [activeView]);

  useEffect(() => {
    const trimmed = historyTextQuery.trim();
    if (trimmed.length < 2) {
      setHistorySearchResults(null);
      setHistorySearchBusy(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setHistorySearchBusy(true);
        const results = await invoke<SearchResultDto[]>(
          "search_local_history",
          { query: trimmed },
        );
        if (!cancelled) {
          setHistorySearchResults(results);
        }
      } catch {
        if (!cancelled) {
          setHistorySearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setHistorySearchBusy(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [historyTextQuery]);

  async function refreshHistoryIfNeeded() {
    if (activeView !== "history" && historyEvents.length === 0) {
      return;
    }

    try {
      const events = await invoke<ContextEventDto[]>("list_context_history", {
        limit: 150,
      });
      setHistoryEvents(events);
    } catch {
      // keep current list on background refresh failure
    }
  }

  async function refreshRepositoryContext(showBusyState = true) {
    if (!selectedRepoId) {
      return;
    }

    try {
      if (showBusyState) {
        setRefreshingRepo(true);
      }

      const [response, hook, memory] = await Promise.all([
        invoke<RepositoryGuardrailDto | null>("get_repository_guardrail", {
          repositoryId: selectedRepoId,
        }),
        invoke<RepositoryHookStatusDto>("get_repository_hook_status", {
          repositoryId: selectedRepoId,
        }),
        invoke<RepositoryMemoryDto>("get_repository_memory", {
          repositoryId: selectedRepoId,
        }),
      ]);

      setSelectedGuardrail(response);
      setHookStatus(hook);
      setRepoMemory(memory);
      setRepoError(null);
    } catch (loadError) {
      setRepoError(
        extractErrorMessage(loadError, "Falha ao validar repositorio"),
      );
    } finally {
      if (showBusyState) {
        setRefreshingRepo(false);
      }
    }
  }

  async function reloadRepositories() {
    const repoList = await invoke<RepositoryListItemDto[]>("list_repositories");
    setRepositories(repoList);
    return repoList;
  }

  async function reloadOrganizations() {
    const orgList =
      await invoke<OrganizationListItemDto[]>("list_organizations");
    setOrganizations(orgList);
    await refreshOrganizationLogos(orgList);
    return orgList;
  }

  async function refreshOrganizationLogos(
    orgList: OrganizationListItemDto[],
  ): Promise<void> {
    const entries = await Promise.all(
      orgList
        .filter((organization) => organization.logoPath)
        .map(async (organization) => {
          try {
            const logoUrl = await invoke<string | null>(
              "read_organization_logo",
              {
                organizationId: organization.id,
              },
            );
            return logoUrl ? ([organization.id, logoUrl] as const) : null;
          } catch {
            return null;
          }
        }),
    );

    const next: Record<string, string> = {};
    for (const entry of entries) {
      if (entry) {
        next[entry[0]] = entry[1];
      }
    }
    setOrganizationLogoUrls(next);
  }

  function getOrganizationLogoUrl(
    organizationId?: string | null,
  ): string | null {
    if (!organizationId) {
      return null;
    }
    return organizationLogoUrls[organizationId] ?? null;
  }

  function findOrganizationById(
    organizationId?: string | null,
  ): OrganizationListItemDto | null {
    if (!organizationId) {
      return null;
    }
    return (
      organizations.find(
        (organization) => organization.id === organizationId,
      ) ?? null
    );
  }

  async function reloadProjects() {
    const projectList = await invoke<ProjectListItemDto[]>("list_projects");
    setProjects(projectList);
    return projectList;
  }

  function syncOrgEnvForm(organization: OrganizationListItemDto | null) {
    if (!organization) {
      return;
    }
    setOrgEditName(organization.name);
    setOrgEditKind(organization.kind ?? "company");
    setOrgEnvProviderType(organization.providerType ?? "");
    setOrgEnvProviderHost(organization.providerHost ?? "");
    setOrgEnvSshHostAlias(organization.sshHostAlias ?? "");
    setOrgEnvGitUserName(organization.gitUserName ?? "");
    setOrgEnvGitUserEmail(organization.gitUserEmail ?? "");
    setOrgEnvBranchPattern(organization.branchPattern ?? "");
    setOrgEnvPrConvention(organization.prConvention ?? "");
    setOrgEnvCommitConvention(organization.commitConvention ?? "");
    setOrgUsefulLinks(parseUsefulLinks(organization.notesJson));
  }

  function resetAddProjectForm() {
    setNewProjectName("");
    setNewProjectPath("");
    setNewProjectRemoteUrl("");
    setNewProjectInspection(null);
    setNewProjectError(null);
  }

  function resetEditProjectPathForm(repository?: RepositoryListItemDto | null) {
    setEditProjectPath(repository?.localPath ?? "");
    setEditProjectRemoteUrl(repository?.remoteUrl ?? "");
    setEditProjectInspection(null);
    setEditProjectError(null);
  }

  async function inspectLocalProjectPath(
    path: string,
    options: {
      setInspection: (value: LocalRepositoryInspectionDto | null) => void;
      setPath: (value: string) => void;
      setError: (value: string | null) => void;
      setInspecting: (value: boolean) => void;
      onDetected?: (inspection: LocalRepositoryInspectionDto) => void;
    },
  ) {
    const trimmedPath = path.trim();
    if (!trimmedPath) {
      options.setError("Informe a pasta local do projeto.");
      return;
    }

    try {
      options.setInspecting(true);
      options.setError(null);
      const inspection = await invoke<LocalRepositoryInspectionDto>(
        "inspect_local_repository_path",
        { localPath: trimmedPath },
      );
      options.setInspection(inspection);
      options.setPath(inspection.localPath);

      if (!inspection.pathExists) {
        options.setError(`Pasta nao encontrada: ${inspection.localPath}`);
        return;
      }

      if (!inspection.isGitRepo) {
        options.setError(
          "Esta pasta existe, mas nao parece ser um repositorio Git.",
        );
        return;
      }

      options.onDetected?.(inspection);
    } catch (inspectError) {
      options.setError(
        extractErrorMessage(inspectError, "Falha ao inspecionar pasta local"),
      );
    } finally {
      options.setInspecting(false);
    }
  }

  async function inspectNewProjectPath() {
    await inspectLocalProjectPath(newProjectPath, {
      setInspection: setNewProjectInspection,
      setPath: setNewProjectPath,
      setError: setNewProjectError,
      setInspecting: setNewProjectInspecting,
      onDetected: (inspection) => {
        if (!newProjectName.trim() && inspection.suggestedName) {
          setNewProjectName(inspection.suggestedName);
        }
        if (!newProjectRemoteUrl.trim() && inspection.remoteUrl) {
          setNewProjectRemoteUrl(inspection.remoteUrl);
        }
      },
    });
  }

  async function inspectEditProjectPath() {
    await inspectLocalProjectPath(editProjectPath, {
      setInspection: setEditProjectInspection,
      setPath: setEditProjectPath,
      setError: setEditProjectError,
      setInspecting: setEditProjectInspecting,
      onDetected: (inspection) => {
        if (!editProjectRemoteUrl.trim() && inspection.remoteUrl) {
          setEditProjectRemoteUrl(inspection.remoteUrl);
        }
      },
    });
  }

  async function browseNewProjectPath() {
    try {
      const picked = await pickLocalFolder(newProjectPath);
      if (!picked) {
        return;
      }

      setNewProjectPath(picked);
      setNewProjectInspection(null);
      setNewProjectError(null);
      await inspectLocalProjectPath(picked, {
        setInspection: setNewProjectInspection,
        setPath: setNewProjectPath,
        setError: setNewProjectError,
        setInspecting: setNewProjectInspecting,
        onDetected: (inspection) => {
          if (!newProjectName.trim() && inspection.suggestedName) {
            setNewProjectName(inspection.suggestedName);
          }
          if (!newProjectRemoteUrl.trim() && inspection.remoteUrl) {
            setNewProjectRemoteUrl(inspection.remoteUrl);
          }
        },
      });
    } catch (browseError) {
      setNewProjectError(
        extractErrorMessage(
          browseError,
          "Nao foi possivel abrir o seletor de pastas",
        ),
      );
    }
  }

  async function browseEditProjectPath() {
    try {
      const picked = await pickLocalFolder(editProjectPath);
      if (!picked) {
        return;
      }

      setEditProjectPath(picked);
      setEditProjectInspection(null);
      setEditProjectError(null);
      await inspectLocalProjectPath(picked, {
        setInspection: setEditProjectInspection,
        setPath: setEditProjectPath,
        setError: setEditProjectError,
        setInspecting: setEditProjectInspecting,
        onDetected: (inspection) => {
          if (!editProjectRemoteUrl.trim() && inspection.remoteUrl) {
            setEditProjectRemoteUrl(inspection.remoteUrl);
          }
        },
      });
    } catch (browseError) {
      setEditProjectError(
        extractErrorMessage(
          browseError,
          "Nao foi possivel abrir o seletor de pastas",
        ),
      );
    }
  }

  async function handleCreateProject() {
    if (selectedOrganizationId === "all") {
      setNewProjectError("Selecione uma empresa antes de cadastrar o projeto.");
      return;
    }

    const trimmedName = newProjectName.trim();
    const trimmedPath = newProjectPath.trim();
    if (!trimmedName || !trimmedPath) {
      setNewProjectError("Informe nome e pasta local do projeto.");
      return;
    }

    try {
      setNewProjectSaving(true);
      setNewProjectError(null);

      const response = await invoke<CreateRepositoryResultDto>(
        "create_repository",
        {
          organizationId: selectedOrganizationId,
          name: trimmedName,
          localPath: trimmedPath,
          remoteUrl: newProjectRemoteUrl.trim() || null,
          providerHost: selectedOrganization?.providerHost ?? null,
          defaultBranch: newProjectInspection?.defaultBranch ?? null,
          projectId: newRepoProjectId.trim() || null,
        },
      );

      await reloadRepositories();
      handleSelectRepository(response.repository);
      resetAddProjectForm();
      setShowAddProjectForm(false);
      setRepoError(null);
    } catch (createError) {
      setNewProjectError(
        extractErrorMessage(createError, "Falha ao cadastrar projeto"),
      );
    } finally {
      setNewProjectSaving(false);
    }
  }

  async function handleUpdateProjectPath() {
    if (!selectedRepoId) {
      return;
    }

    const trimmedPath = editProjectPath.trim();
    if (!trimmedPath) {
      setEditProjectError("Informe a pasta local do projeto.");
      return;
    }

    try {
      setEditProjectSaving(true);
      setEditProjectError(null);

      const response = await invoke<UpdateRepositoryResultDto>(
        "update_repository_local_path",
        {
          repositoryId: selectedRepoId,
          localPath: trimmedPath,
          remoteUrl: editProjectRemoteUrl.trim() || null,
          defaultBranch: editProjectInspection?.defaultBranch ?? null,
        },
      );

      await reloadRepositories();
      handleSelectRepository(response.repository);
      setShowEditProjectPathForm(false);
      setRepoError(null);
      await refreshRepositoryContext(false);
    } catch (updateError) {
      setEditProjectError(
        extractErrorMessage(updateError, "Falha ao atualizar pasta local"),
      );
    } finally {
      setEditProjectSaving(false);
    }
  }

  const planMap = useMemo(
    () => new Map(data?.backlog.map((item) => [item.id, item]) ?? []),
    [data],
  );
  const organizationMap = useMemo(
    () => new Map(organizations.map((org) => [org.id, org.name])),
    [organizations],
  );
  const filteredBacklog = useMemo(() => {
    let items = data?.backlog ?? [];

    if (!showArchivedBacklog) {
      items = items.filter((item) => item.status !== "archived");
    }

    if (!showDismissedBacklog) {
      items = items.filter((item) => !item.wcpDismissedAt);
    }

    if (backlogStatusFilter === "blocked") {
      items = items.filter((item) => item.status === "blocked");
    } else if (backlogStatusFilter !== "all") {
      items = items.filter((item) => item.status === backlogStatusFilter);
    }

    if (backlogOrgFilter !== "all") {
      items = items.filter((item) => item.organizationId === backlogOrgFilter);
    }

    if (backlogSourceFilter === "manual") {
      items = items.filter((item) => item.sourceType !== "imported");
    } else if (backlogSourceFilter === "imported") {
      items = items.filter((item) => item.sourceType === "imported");
    } else if (backlogSourceFilter === "jira") {
      items = items.filter((item) => item.externalProvider === "jira");
    } else if (backlogSourceFilter === "clickup") {
      items = items.filter((item) => item.externalProvider === "clickup");
    }

    if (backlogDeadlineFilter !== "all") {
      items = items.filter(
        (item) =>
          classifyWorkItemDeadlineFilter(item) === backlogDeadlineFilter,
      );
    }

    const query = backlogSearchQuery.trim().toLowerCase();
    if (query) {
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query) ||
          item.resumeSummary?.toLowerCase().includes(query) ||
          item.blockedReason?.toLowerCase().includes(query) ||
          item.externalKey?.toLowerCase().includes(query),
      );
    }

    return [...items].sort((left, right) => {
      if (backlogSort === "title") {
        return left.title.localeCompare(right.title, "pt-BR");
      }
      if (backlogSort === "status") {
        return left.status.localeCompare(right.status, "pt-BR");
      }
      if (backlogSort === "scheduled_for") {
        const leftDate = left.scheduledFor ?? "9999-12-31";
        const rightDate = right.scheduledFor ?? "9999-12-31";
        return leftDate.localeCompare(rightDate);
      }
      return (left.priority ?? 3) - (right.priority ?? 3);
    });
  }, [
    backlogDeadlineFilter,
    backlogOrgFilter,
    backlogSearchQuery,
    backlogSort,
    backlogSourceFilter,
    backlogStatusFilter,
    data?.backlog,
    showArchivedBacklog,
    showDismissedBacklog,
  ]);
  const taskFormWarnings = useMemo(
    () =>
      getTaskFormWarnings(taskFormDraft, projects, repositories, organizations),
    [taskFormDraft, projects, repositories, organizations],
  );
  const currentTask = taskContext?.task ?? data?.currentTask ?? null;
  const headerFocusTask = useMemo(() => {
    if (data?.activeSession?.workItemId) {
      return (
        planMap.get(data.activeSession.workItemId) ?? data.currentTask ?? null
      );
    }
    return data?.currentTask ?? null;
  }, [data?.activeSession?.workItemId, data?.currentTask, planMap]);
  const todayFocusTask = useMemo(
    () => resolveTodayFocusTask(data ?? null, planMap),
    [data, planMap],
  );
  const todayCommittedTask = useMemo(
    () => resolveTodayCommittedTask(data ?? null, planMap),
    [data, planMap],
  );
  const todayDayBrief = useMemo(
    () =>
      data
        ? buildTodayDayBrief(data, todayFocusTask, todayCommittedTask)
        : null,
    [data, todayCommittedTask, todayFocusTask],
  );
  const groupedDeadlineAlerts = useMemo(
    () => groupDeadlineAlertsByOrganization(deadlineAlerts?.items ?? []),
    [deadlineAlerts],
  );
  const todayStatusChips = useMemo(
    () =>
      data
        ? buildTodayStatusChips(data, todayFocusTask, todayCommittedTask)
        : [],
    [data, todayCommittedTask, todayFocusTask],
  );
  const todayFocusPriority =
    todayFocusTask?.priority ?? todayCommittedTask?.priority ?? 3;
  const todayFocusKindLabel = data?.todayFocus.focusKind
    ? getFocusKindLabel(data.todayFocus.focusKind)
    : "Foco";
  const todayRecoverableContext = useMemo(
    () => taskContext?.recoverableContext ?? data?.recoverableContext ?? [],
    [data?.recoverableContext, taskContext?.recoverableContext],
  );
  const relatedDependencyIds = useMemo(
    () =>
      new Set(
        (taskContext?.dependencies ?? []).map(
          (dependency) => dependency.relatedWorkItemId,
        ),
      ),
    [taskContext?.dependencies],
  );
  const dependencyPreviewText = useMemo(() => {
    if (!currentTask || !dependencyTargetId) {
      return null;
    }

    const targetTitle = planMap.get(dependencyTargetId)?.title;
    if (!targetTitle) {
      return null;
    }

    return formatDependencyPreview(
      currentTask.title,
      dependencyRelation,
      targetTitle,
    );
  }, [currentTask, dependencyRelation, dependencyTargetId, planMap]);
  const groupedSearchResults = useMemo(() => {
    const groups = Object.fromEntries(
      SEARCH_KIND_ORDER.map((kind) => [kind, [] as SearchResultDto[]]),
    ) as Record<SearchResultKind, SearchResultDto[]>;

    for (const result of searchResults) {
      groups[result.kind]?.push(result);
    }

    return SEARCH_KIND_ORDER.filter((kind) => groups[kind].length > 0).map(
      (kind) => ({
        kind,
        label: normalizeSearchLabel(kind),
        items: groups[kind],
      }),
    );
  }, [searchResults]);
  const dashboardValidation = data?.guardrail?.validation ?? null;
  const selectedRepo =
    repositories.find((item) => item.id === selectedRepoId) ?? null;
  const selectedValidation = selectedGuardrail?.validation ?? null;
  const selectedRepoPathIssue = useMemo(() => {
    const localPathCheck = selectedValidation?.checks.find(
      (check) => check.key === "localPath",
    );
    if (localPathCheck) {
      return localPathCheck.message;
    }
    if (!selectedRepo?.localPath) {
      return "Este projeto ainda nao tem pasta local configurada.";
    }
    return null;
  }, [selectedRepo?.localPath, selectedValidation]);
  const selectedOrganization = useMemo(() => {
    if (selectedOrganizationId !== "all") {
      return (
        organizations.find((org) => org.id === selectedOrganizationId) ?? null
      );
    }
    return (
      organizations.find((org) => org.id === selectedRepo?.organizationId) ??
      null
    );
  }, [organizations, selectedOrganizationId, selectedRepo?.organizationId]);
  const orgSetupOrganization = useMemo(
    () =>
      organizations.find(
        (organization) => organization.id === orgSetupSelectedId,
      ) ?? null,
    [organizations, orgSetupSelectedId],
  );
  const orgSetupProjects = useMemo(
    () =>
      projects.filter(
        (project) => project.organizationId === orgSetupSelectedId,
      ),
    [orgSetupSelectedId, projects],
  );
  const orgSetupRepositories = useMemo(
    () =>
      repositories.filter(
        (repository) => repository.organizationId === orgSetupSelectedId,
      ),
    [orgSetupSelectedId, repositories],
  );
  const orgIdentitySelectedRepo = useMemo(
    () =>
      orgSetupRepositories.find(
        (repository) => repository.id === orgIdentityRepoId,
      ) ?? null,
    [orgIdentityRepoId, orgSetupRepositories],
  );
  const orgIdentitySshAlias =
    orgEnvSshHostAlias.trim() ||
    orgSetupOrganization?.sshHostAlias?.trim() ||
    "";
  const orgIdentityRemoteUrl =
    orgIdentityGuardrail?.remoteUrl ??
    orgIdentitySelectedRepo?.remoteUrl ??
    null;
  const orgIdentityRemoteFixPreview = useMemo(() => {
    if (!orgIdentityRemoteUrl || !orgIdentitySshAlias) {
      return null;
    }
    if (!needsSshRemoteAliasFix(orgIdentityRemoteUrl, orgIdentitySshAlias)) {
      return null;
    }
    return previewSshRemoteWithAlias(orgIdentityRemoteUrl, orgIdentitySshAlias);
  }, [orgIdentityRemoteUrl, orgIdentitySshAlias]);
  const orgSetupGaps = useMemo(
    () =>
      resolvedWorkContext?.gaps ??
      listOrganizationContextGaps(
        orgSetupOrganization
          ? {
              gitUserName: orgSetupOrganization.gitUserName,
              gitUserEmail: orgSetupOrganization.gitUserEmail,
              branchPattern: orgSetupOrganization.branchPattern,
              providerHost: orgSetupOrganization.providerHost,
            }
          : null,
      ),
    [orgSetupOrganization, resolvedWorkContext?.gaps],
  );
  const groupedRepositories = useMemo(
    () => groupRepositoriesByOrg(repositories, selectedOrganizationId),
    [repositories, selectedOrganizationId],
  );
  const contextSwitchChecks = useMemo(
    () =>
      buildContextSwitchChecks(selectedRepo, selectedValidation, hookStatus),
    [hookStatus, selectedRepo, selectedValidation],
  );
  const contextReady = useMemo(
    () =>
      Boolean(
        selectedRepoId &&
        selectedValidation?.status === "ok" &&
        hookStatus?.managedByApp,
      ),
    [hookStatus?.managedByApp, selectedRepoId, selectedValidation?.status],
  );
  const contextOrganizationRepos = useMemo(() => {
    if (selectedOrganizationId === "all") {
      return repositories;
    }
    return repositories.filter(
      (repository) => repository.organizationId === selectedOrganizationId,
    );
  }, [repositories, selectedOrganizationId]);
  const contextChainLabel = useMemo(() => {
    if (resolvedWorkContext?.chainLabel) {
      return resolvedWorkContext.chainLabel;
    }

    return formatContextChain(
      selectedOrganization,
      selectedRepo,
      selectedGuardrail,
    );
  }, [
    resolvedWorkContext?.chainLabel,
    selectedGuardrail,
    selectedOrganization,
    selectedRepo,
  ]);
  const newProjectIdentityWarning = useMemo(
    () =>
      buildInspectIdentityWarning(selectedOrganization, newProjectInspection),
    [newProjectInspection, selectedOrganization],
  );
  const completedContextSteps = useMemo(() => {
    const completed = new Set<number>();
    if (selectedOrganizationId !== "all") {
      completed.add(1);
    }
    if (
      selectedRepoId &&
      (selectedOrganizationId === "all" ||
        selectedRepo?.organizationId === selectedOrganizationId)
    ) {
      completed.add(2);
    }
    if (selectedValidation) {
      completed.add(3);
    }
    if (
      selectedValidation?.status === "ok" ||
      selectedValidation?.checks.every(
        (check) =>
          check.status === "ok" ||
          (check.key !== "gitUserName" && check.key !== "gitUserEmail"),
      )
    ) {
      completed.add(4);
    }
    if (hookStatus?.managedByApp) {
      completed.add(5);
    }
    if (contextReady) {
      completed.add(6);
    }
    return completed;
  }, [
    contextReady,
    hookStatus?.managedByApp,
    selectedOrganizationId,
    selectedRepo?.organizationId,
    selectedRepoId,
    selectedValidation,
  ]);
  const taskTimeline = useMemo<TimelineEntryDto[]>(
    () => buildTaskTimelineEntries(currentTask, taskContext),
    [currentTask, taskContext],
  );

  const timelineCounts = useMemo<Record<TimelineFilter, number>>(() => {
    const counts: Record<TimelineFilter, number> = {
      all: taskTimeline.length,
      session: 0,
      change: 0,
      note: 0,
      artifact: 0,
      dependency: 0,
      block: 0,
    };

    for (const entry of taskTimeline) {
      counts[entry.kind] += 1;
    }

    return counts;
  }, [taskTimeline]);

  const filteredTimeline = useMemo<TimelineEntryDto[]>(
    () =>
      timelineFilter === "all"
        ? taskTimeline
        : taskTimeline.filter((entry) => entry.kind === timelineFilter),
    [taskTimeline, timelineFilter],
  );

  const historyTaskOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const event of historyEvents) {
      if (event.workItemId && event.workItemTitle) {
        options.set(event.workItemId, event.workItemTitle);
      }
    }
    return Array.from(options.entries()).sort((left, right) =>
      left[1].localeCompare(right[1]),
    );
  }, [historyEvents]);

  const historyRepoOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const event of historyEvents) {
      if (event.repositoryId && event.repositoryName) {
        options.set(event.repositoryId, event.repositoryName);
      }
    }
    return Array.from(options.entries()).sort((left, right) =>
      left[1].localeCompare(right[1]),
    );
  }, [historyEvents]);

  const historyOrgOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const event of historyEvents) {
      if (event.organizationId) {
        options.set(
          event.organizationId,
          event.organizationName ?? event.organizationId,
        );
      }
    }
    return Array.from(options.entries()).sort((left, right) =>
      left[1].localeCompare(right[1]),
    );
  }, [historyEvents]);

  const historyKindCounts = useMemo<Record<HistoryKindFilter, number>>(() => {
    const counts: Record<HistoryKindFilter, number> = {
      all: historyEvents.length,
      session: 0,
      decision: 0,
      note: 0,
      artifact: 0,
      task: 0,
      block: 0,
      dependency: 0,
      repository: 0,
    };

    for (const event of historyEvents) {
      counts[event.kind] += 1;
    }

    return counts;
  }, [historyEvents]);

  const historySourceEvents = useMemo(() => {
    const trimmed = historyTextQuery.trim();
    if (trimmed.length >= 2 && historySearchResults !== null) {
      return historySearchResults.map((result) =>
        searchResultToContextEvent(
          result,
          data?.backlog ?? [],
          repositories,
          organizations,
        ),
      );
    }

    return historyEvents;
  }, [
    data?.backlog,
    historyEvents,
    historySearchResults,
    historyTextQuery,
    organizations,
    repositories,
  ]);

  const filteredHistoryEvents = useMemo(() => {
    const needle = historyTextQuery.trim().toLowerCase();
    const useDeepSearch = needle.length >= 2 && historySearchResults !== null;

    return historySourceEvents.filter((event) => {
      if (historyKindFilter !== "all" && event.kind !== historyKindFilter) {
        return false;
      }
      if (
        historyTaskFilter !== "all" &&
        event.workItemId !== historyTaskFilter
      ) {
        return false;
      }
      if (
        historyRepoFilter !== "all" &&
        event.repositoryId !== historyRepoFilter
      ) {
        return false;
      }
      if (
        historyOrgFilter !== "all" &&
        event.organizationId !== historyOrgFilter
      ) {
        return false;
      }
      if (!needle || useDeepSearch) {
        return true;
      }

      const haystack = [
        event.title,
        event.detail,
        event.workItemTitle,
        event.repositoryName,
        event.organizationName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [
    historyKindFilter,
    historyOrgFilter,
    historyRepoFilter,
    historySearchResults,
    historySourceEvents,
    historyTaskFilter,
    historyTextQuery,
  ]);

  const groupedHistoryEvents = useMemo(
    () => groupHistoryByDay(filteredHistoryEvents),
    [filteredHistoryEvents],
  );

  const historyUsesDeepSearch =
    historyTextQuery.trim().length >= 2 && historySearchResults !== null;

  async function handleApplyIdentity() {
    if (!selectedRepoId) {
      return;
    }

    try {
      setApplyingIdentity(true);
      setApplyResult(null);
      setHookResult(null);
      const response = await invoke<ApplyIdentityResultDto>(
        "apply_repository_identity",
        {
          repositoryId: selectedRepoId,
        },
      );

      setSelectedGuardrail((current) =>
        current
          ? {
              ...current,
              validation: response.validation ?? current.validation,
            }
          : current,
      );

      setApplyResult(
        response.appliedChanges.length > 0
          ? `Aplicado: ${response.appliedChanges.join(" · ")}`
          : "Nenhuma alteracao foi aplicada.",
      );
      await refreshRepositoryContext(false);
      setRepoError(null);
    } catch (applyError) {
      setRepoError(
        extractErrorMessage(applyError, "Falha ao aplicar identidade local"),
      );
    } finally {
      setApplyingIdentity(false);
    }
  }

  async function handleInstallPrePushHook() {
    if (!selectedRepoId) {
      return;
    }

    try {
      setInstallingHook(true);
      setHookResult(null);
      const response = await invoke<InstallPrePushHookResultDto>(
        "install_repository_pre_push_hook",
        {
          repositoryId: selectedRepoId,
        },
      );
      setHookResult(`Hook instalado em ${response.hookPath}`);
      setHookStatus({
        repositoryId: response.repositoryId,
        hookPath: response.hookPath,
        installed: response.installed,
        managedByApp: true,
      });
      await refreshRepositoryContext(false);
      setRepoError(null);
    } catch (hookError) {
      setRepoError(
        extractErrorMessage(hookError, "Falha ao instalar hook pre-push"),
      );
    } finally {
      setInstallingHook(false);
    }
  }

  async function handleRemovePrePushHook() {
    if (!selectedRepoId) {
      return;
    }

    try {
      setRemovingHook(true);
      setHookResult(null);
      const response = await invoke<RemovePrePushHookResultDto>(
        "remove_repository_pre_push_hook",
        {
          repositoryId: selectedRepoId,
        },
      );
      setHookResult(
        response.removed
          ? "Hook pre-push removido."
          : "Nenhuma alteracao foi aplicada ao hook.",
      );
      await refreshRepositoryContext(false);
      setRepoError(null);
    } catch (hookError) {
      setRepoError(
        extractErrorMessage(hookError, "Falha ao remover hook pre-push"),
      );
    } finally {
      setRemovingHook(false);
    }
  }

  function handleOrganizationChange(orgId: string) {
    setSelectedOrganizationId(orgId);
    setContextStep(1);
    setSelectedRepoId(null);
    setSelectedGuardrail(null);
    setHookStatus(null);
    setRepoMemory(null);
    setApplyResult(null);
    setHookResult(null);
  }

  function resetContextFlowForReposTab() {
    handleOrganizationChange("all");
  }

  function closeConfirmDialog() {
    if (confirmDialogBusy) {
      return;
    }
    setConfirmDialog(null);
  }

  async function handleConfirmDialog() {
    if (!confirmDialog || confirmDialogBusy) {
      return;
    }

    try {
      setConfirmDialogBusy(true);
      await confirmDialog.onConfirm();
      setConfirmDialog(null);
    } finally {
      setConfirmDialogBusy(false);
    }
  }

  async function handleCreateOrganization() {
    const trimmedName = newOrgName.trim();
    if (!trimmedName) {
      setOrgSetupError("Informe o nome da empresa.");
      return;
    }

    try {
      setOrgSetupBusy(true);
      setOrgSetupError(null);
      const response = await invoke<{ organization: OrganizationListItemDto }>(
        "create_organization",
        {
          name: trimmedName,
          kind: newOrgKind,
        },
      );
      await reloadOrganizations();
      setOrgSetupSelectedId(response.organization.id);
      setShowNewOrgForm(false);
      setNewOrgName("");
      setNewOrgKind("company");
    } catch (createError) {
      setOrgSetupError(
        extractErrorMessage(createError, "Falha ao criar empresa"),
      );
    } finally {
      setOrgSetupBusy(false);
    }
  }

  async function handleUpdateOrganization() {
    if (!orgSetupSelectedId) {
      return;
    }

    try {
      setOrgSetupBusy(true);
      setOrgSetupError(null);
      await invoke("update_organization", {
        organizationId: orgSetupSelectedId,
        name: orgEditName.trim() || null,
        kind: orgEditKind,
        isActive: true,
      });
      await reloadOrganizations();
    } catch (updateError) {
      setOrgSetupError(
        extractErrorMessage(updateError, "Falha ao atualizar empresa"),
      );
    } finally {
      setOrgSetupBusy(false);
    }
  }

  async function handleUploadOrganizationLogo() {
    if (!orgSetupSelectedId) {
      return;
    }

    const sourcePath = await pickOrganizationLogoFile();
    if (!sourcePath) {
      return;
    }

    try {
      setOrgSetupBusy(true);
      setOrgSetupError(null);
      await invoke("update_organization_logo", {
        organizationId: orgSetupSelectedId,
        sourcePath,
      });
      await reloadOrganizations();
    } catch (uploadError) {
      setOrgSetupError(
        extractErrorMessage(uploadError, "Falha ao salvar logo da empresa"),
      );
    } finally {
      setOrgSetupBusy(false);
    }
  }

  async function handleRemoveOrganizationLogo() {
    if (!orgSetupSelectedId) {
      return;
    }

    try {
      setOrgSetupBusy(true);
      setOrgSetupError(null);
      await invoke("remove_organization_logo", {
        organizationId: orgSetupSelectedId,
      });
      await reloadOrganizations();
    } catch (removeError) {
      setOrgSetupError(
        extractErrorMessage(removeError, "Falha ao remover logo da empresa"),
      );
    } finally {
      setOrgSetupBusy(false);
    }
  }

  function markOrgEnvFormDirty() {
    setOrgEnvFormDirty(true);
    setOrgSetupSuccess(null);
  }

  function applySshConfigHostEntry(entry: SshConfigHostEntryDto) {
    markOrgEnvFormDirty();
    setOrgIdentitySelectedSshHost(entry.hostAlias);
    setOrgEnvSshHostAlias(entry.hostAlias);
    if (entry.hostName) {
      setOrgEnvProviderHost(entry.hostName);
      if (!orgEnvProviderType.trim()) {
        setOrgEnvProviderType(inferProviderTypeFromHost(entry.hostName));
      }
    }
  }

  function applyOrganizationIdentityImport(
    identityImport: OrganizationIdentityImportDto,
  ) {
    if (identityImport.providerType) {
      setOrgEnvProviderType(identityImport.providerType);
    }
    if (identityImport.providerHost) {
      setOrgEnvProviderHost(identityImport.providerHost);
    }
    if (identityImport.sshHostAlias) {
      setOrgEnvSshHostAlias(identityImport.sshHostAlias);
    }
    if (identityImport.gitUserName) {
      setOrgEnvGitUserName(identityImport.gitUserName);
    }
    if (identityImport.gitUserEmail) {
      setOrgEnvGitUserEmail(identityImport.gitUserEmail);
    }
    markOrgEnvFormDirty();
  }

  async function handleImportOrganizationIdentity() {
    if (!orgSetupSelectedId || !orgIdentityImportRepoId) {
      setOrgSetupError("Selecione um repositorio para importar a identidade.");
      return;
    }

    try {
      setOrgSetupBusy(true);
      setOrgSetupError(null);
      const identityImport = await invoke<OrganizationIdentityImportDto>(
        "import_organization_identity_from_repository",
        {
          organizationId: orgSetupSelectedId,
          repositoryId: orgIdentityImportRepoId,
        },
      );
      applyOrganizationIdentityImport(identityImport);
      setOrgIdentityImportPreview(identityImport);
    } catch (importError) {
      setOrgSetupError(
        extractErrorMessage(importError, "Falha ao importar identidade Git"),
      );
    } finally {
      setOrgSetupBusy(false);
    }
  }

  async function handleSaveOrganizationEnvironment() {
    if (!orgSetupSelectedId) {
      return;
    }

    try {
      setOrgSetupBusy(true);
      setOrgSetupError(null);
      setOrgSetupSuccess(null);
      const response = await invoke<{ organization: OrganizationListItemDto }>(
        "update_organization_environment",
        {
          organizationId: orgSetupSelectedId,
          providerType: orgEnvProviderType.trim() || null,
          providerHost: orgEnvProviderHost.trim() || null,
          sshHostAlias: orgEnvSshHostAlias.trim() || null,
          gitUserName: orgEnvGitUserName.trim() || null,
          gitUserEmail: orgEnvGitUserEmail.trim() || null,
          branchPattern: orgEnvBranchPattern.trim() || null,
          prConvention: orgEnvPrConvention.trim() || null,
          commitConvention: orgEnvCommitConvention.trim() || null,
          notesJson: serializeUsefulLinks(orgUsefulLinks),
        },
      );
      setOrganizations((current) =>
        current.map((organization) =>
          organization.id === response.organization.id
            ? response.organization
            : organization,
        ),
      );
      syncOrgEnvForm(response.organization);
      setOrgEnvFormDirty(false);
      setOrgSetupSuccess("Identidade Git salva.");
      await refreshOrganizationLogos([response.organization]);
      if (orgIdentityRepoId) {
        try {
          const guardrail = await invoke<RepositoryGuardrailDto | null>(
            "get_repository_guardrail",
            { repositoryId: orgIdentityRepoId },
          );
          setOrgIdentityGuardrail(guardrail);
        } catch {
          // validacao opcional apos salvar
        }
      }
    } catch (saveError) {
      setOrgSetupError(
        extractErrorMessage(saveError, "Falha ao salvar identidade Git"),
      );
    } finally {
      setOrgSetupBusy(false);
    }
  }

  async function handleCreateOrgProject() {
    if (!orgSetupSelectedId) {
      return;
    }

    const trimmedName = newOrgProjectName.trim();
    if (!trimmedName) {
      setOrgSetupError("Informe o nome do projeto.");
      return;
    }

    try {
      setOrgSetupBusy(true);
      setOrgSetupError(null);
      await invoke("create_project", {
        organizationId: orgSetupSelectedId,
        name: trimmedName,
        description: newOrgProjectDescription.trim() || null,
      });
      await reloadProjects();
      setNewOrgProjectName("");
      setNewOrgProjectDescription("");
    } catch (createError) {
      setOrgSetupError(
        extractErrorMessage(createError, "Falha ao criar projeto"),
      );
    } finally {
      setOrgSetupBusy(false);
    }
  }

  function handleDeleteOrgProject(project: ProjectListItemDto) {
    setConfirmDialog({
      title: `Excluir projeto "${project.name}"?`,
      description:
        "Repositorios vinculados precisam ser removidos antes. Tarefas ficam sem projeto.",
      confirmLabel: "Excluir projeto",
      destructive: true,
      onConfirm: async () => {
        try {
          setOrgSetupBusy(true);
          setOrgSetupError(null);
          setOrgSetupSuccess(null);
          await invoke("delete_project", { projectId: project.id });
          await reloadProjects();
          setOrgSetupSuccess(`Projeto "${project.name}" excluido.`);
        } catch (deleteError) {
          setOrgSetupError(
            extractErrorMessage(deleteError, "Falha ao excluir projeto"),
          );
        } finally {
          setOrgSetupBusy(false);
        }
      },
    });
  }

  function handleDeleteRepository(repository: RepositoryListItemDto) {
    setConfirmDialog({
      title: `Excluir repositorio "${repository.name}"?`,
      description:
        "Remove o cadastro do WCP. A pasta local no disco nao sera apagada.",
      confirmLabel: "Excluir repositorio",
      destructive: true,
      onConfirm: async () => {
        try {
          setOrgSetupBusy(true);
          setOrgSetupError(null);
          setOrgSetupSuccess(null);
          await invoke("delete_repository", { repositoryId: repository.id });
          const repoList = await reloadRepositories();
          await refreshDashboard();

          if (selectedRepoId === repository.id) {
            const nextRepo =
              repoList.find(
                (entry) => entry.organizationId === repository.organizationId,
              ) ?? repoList[0];
            setSelectedRepoId(nextRepo?.id ?? null);
          }
          if (orgIdentityRepoId === repository.id) {
            setOrgIdentityRepoId(null);
          }
          if (reassignRepoId === repository.id) {
            setReassignRepoId("");
          }

          setOrgSetupSuccess(`Repositorio "${repository.name}" excluido.`);
        } catch (deleteError) {
          setOrgSetupError(
            extractErrorMessage(deleteError, "Falha ao excluir repositorio"),
          );
        } finally {
          setOrgSetupBusy(false);
        }
      },
    });
  }

  function handleDeleteOrganization() {
    if (!orgSetupSelectedId || !orgSetupOrganization) {
      return;
    }

    const organizationName = orgSetupOrganization.name;
    const deletedOrganizationId = orgSetupSelectedId;

    setConfirmDialog({
      title: `Excluir empresa "${organizationName}"?`,
      description:
        "Isso remove projetos, repositorios, tarefas, integracoes e historico vinculados. Nao da para desfazer.",
      confirmLabel: "Excluir empresa",
      destructive: true,
      onConfirm: async () => {
        try {
          setOrgSetupBusy(true);
          setOrgSetupError(null);
          setOrgSetupSuccess(null);
          await invoke("delete_organization", {
            organizationId: deletedOrganizationId,
          });

          const [orgList] = await Promise.all([
            reloadOrganizations(),
            reloadProjects(),
            reloadRepositories(),
          ]);
          await refreshDashboard();

          const nextOrgId = orgList[0]?.id ?? null;
          setOrgSetupSelectedId(nextOrgId);
          if (
            selectedOrganizationId !== "all" &&
            selectedOrganizationId === deletedOrganizationId
          ) {
            setSelectedOrganizationId(nextOrgId ?? "all");
          }

          setOrgSetupSuccess(`Empresa "${organizationName}" excluida.`);
        } catch (deleteError) {
          setOrgSetupError(
            extractErrorMessage(deleteError, "Falha ao excluir empresa"),
          );
        } finally {
          setOrgSetupBusy(false);
        }
      },
    });
  }

  async function handleOrgLinkRepository() {
    if (!orgSetupSelectedId) {
      return;
    }

    const trimmedName = orgLinkRepoName.trim();
    const trimmedPath = orgLinkRepoPath.trim();
    if (!trimmedName || !trimmedPath) {
      setOrgSetupError("Informe nome e pasta local do repositorio.");
      return;
    }

    try {
      setOrgSetupBusy(true);
      setOrgSetupError(null);
      await invoke<CreateRepositoryResultDto>("create_repository", {
        organizationId: orgSetupSelectedId,
        name: trimmedName,
        localPath: trimmedPath,
        remoteUrl: orgLinkRepoRemote.trim() || null,
        providerHost: orgSetupOrganization?.providerHost ?? null,
        defaultBranch: orgLinkInspection?.defaultBranch ?? null,
        projectId: orgLinkProjectId.trim() || null,
      });
      await reloadRepositories();
      setOrgLinkRepoName("");
      setOrgLinkRepoPath("");
      setOrgLinkRepoRemote("");
      setOrgLinkProjectId("");
      setOrgLinkInspection(null);
    } catch (linkError) {
      setOrgSetupError(
        extractErrorMessage(linkError, "Falha ao vincular repositorio"),
      );
    } finally {
      setOrgSetupBusy(false);
    }
  }

  async function handleReassignRepository() {
    if (!orgSetupSelectedId || !reassignRepoId) {
      return;
    }

    try {
      setOrgSetupBusy(true);
      setOrgSetupError(null);
      await invoke("update_repository_context", {
        repositoryId: reassignRepoId,
        organizationId: orgSetupSelectedId,
        projectId: reassignProjectId.trim() || null,
      });
      await reloadRepositories();
      setReassignRepoId("");
      setReassignProjectId("");
    } catch (reassignError) {
      setOrgSetupError(
        extractErrorMessage(reassignError, "Falha ao reassociar repositorio"),
      );
    } finally {
      setOrgSetupBusy(false);
    }
  }

  async function handleValidateOrgIdentity() {
    if (!orgIdentityRepoId) {
      return;
    }

    try {
      setOrgIdentityBusy(true);
      setOrgIdentityResult(null);
      const guardrail = await invoke<RepositoryGuardrailDto | null>(
        "get_repository_guardrail",
        { repositoryId: orgIdentityRepoId },
      );
      setOrgIdentityGuardrail(guardrail);
      setOrgIdentityResult(
        guardrail?.validation?.status === "ok"
          ? "Contexto validado."
          : "Revise os checks abaixo.",
      );
    } catch (validateError) {
      setOrgIdentityResult(
        extractErrorMessage(validateError, "Falha ao validar contexto"),
      );
    } finally {
      setOrgIdentityBusy(false);
    }
  }

  async function handleApplyOrgIdentity() {
    if (!orgIdentityRepoId) {
      return;
    }

    try {
      setOrgIdentityBusy(true);
      setOrgIdentityResult(null);
      const response = await invoke<{ appliedChanges: string[] }>(
        "apply_repository_identity",
        { repositoryId: orgIdentityRepoId },
      );
      setOrgIdentityResult(
        response.appliedChanges.length > 0
          ? `Identidade aplicada: ${response.appliedChanges.join(", ")}`
          : "Nenhuma alteracao necessaria.",
      );
      await handleValidateOrgIdentity();
    } catch (applyError) {
      setOrgIdentityResult(
        extractErrorMessage(applyError, "Falha ao aplicar identidade"),
      );
    } finally {
      setOrgIdentityBusy(false);
    }
  }

  async function handleFixRepositoryRemote() {
    if (!orgIdentityRepoId) {
      return;
    }

    if (!orgIdentitySshAlias) {
      setOrgIdentityResult(
        "Configure e salve o alias SSH no perfil antes de corrigir o remoto.",
      );
      return;
    }

    try {
      setOrgIdentityBusy(true);
      setOrgIdentityResult(null);
      const response = await invoke<FixRepositoryRemoteResultDto>(
        "fix_repository_remote_ssh_alias",
        {
          repositoryId: orgIdentityRepoId,
          sshHostAlias: orgIdentitySshAlias,
        },
      );
      if (response.changed) {
        setOrgIdentityResult(
          `Remoto atualizado: ${response.previousRemoteUrl ?? "?"} → ${response.updatedRemoteUrl ?? "?"}`,
        );
        await reloadRepositories();
        const guardrail = await invoke<RepositoryGuardrailDto | null>(
          "get_repository_guardrail",
          { repositoryId: orgIdentityRepoId },
        );
        setOrgIdentityGuardrail(guardrail);
      } else {
        setOrgIdentityResult("Remoto ja usa o alias SSH esperado.");
      }
    } catch (fixError) {
      setOrgIdentityResult(
        extractErrorMessage(fixError, "Falha ao corrigir remoto"),
      );
    } finally {
      setOrgIdentityBusy(false);
    }
  }

  async function handleApplyFullRepositoryContext() {
    if (!orgIdentityRepoId) {
      return;
    }

    if (!orgIdentitySshAlias) {
      setOrgIdentityResult(
        "Configure o alias SSH no perfil antes de aplicar o contexto completo.",
      );
      return;
    }

    try {
      setOrgIdentityBusy(true);
      setOrgIdentityResult(null);

      if (orgEnvFormDirty && orgSetupSelectedId) {
        await handleSaveOrganizationEnvironment();
      }

      const response = await invoke<ApplyFullContextResultDto>(
        "apply_repository_full_context",
        {
          repositoryId: orgIdentityRepoId,
          sshHostAlias: orgIdentitySshAlias,
        },
      );

      const parts: string[] = [];
      if (response.identityChanges.length > 0) {
        parts.push(`Identidade: ${response.identityChanges.join(", ")}`);
      } else {
        parts.push("Identidade: nenhuma alteracao necessaria");
      }

      if (response.remoteChanged) {
        parts.push(
          `Remoto: ${response.previousRemoteUrl ?? "?"} → ${response.updatedRemoteUrl ?? "?"}`,
        );
      } else {
        parts.push("Remoto: ja estava correto");
      }

      setOrgIdentityResult(parts.join(" · "));
      await reloadRepositories();
      const guardrail = await invoke<RepositoryGuardrailDto | null>(
        "get_repository_guardrail",
        { repositoryId: orgIdentityRepoId },
      );
      setOrgIdentityGuardrail(guardrail);
    } catch (applyError) {
      setOrgIdentityResult(
        extractErrorMessage(applyError, "Falha ao aplicar contexto completo"),
      );
    } finally {
      setOrgIdentityBusy(false);
    }
  }

  function getPmConnection(provider: "jira" | "clickup") {
    return (
      integrationConnections.find(
        (connection) => connection.provider === provider,
      ) ?? null
    );
  }

  function clearIntegrationFormState() {
    setJiraSiteUrl("");
    setJiraEmail("");
    setJiraApiToken("");
    setClickUpApiToken("");
    setClickUpTeamId("");
    setClickUpTeams([]);
  }

  function applyIntegrationConnectionsToForm(
    connections: IntegrationConnectionDto[],
    options?: { loadClickUpTeams?: boolean },
  ) {
    setIntegrationConnections(connections);
    clearIntegrationFormState();

    const jira = connections.find((entry) => entry.provider === "jira");
    const clickup = connections.find((entry) => entry.provider === "clickup");

    if (jira?.configJson) {
      try {
        const config = JSON.parse(jira.configJson) as {
          siteUrl?: string;
          email?: string;
        };
        setJiraSiteUrl(config.siteUrl ?? "");
        setJiraEmail(config.email ?? "");
      } catch {
        // formulario permanece limpo
      }
    }
    setJiraSyncFilter(parseSyncFilterJson(jira?.syncFilterJson));

    if (clickup?.configJson) {
      try {
        const config = JSON.parse(clickup.configJson) as { teamId?: string };
        setClickUpTeamId(config.teamId ?? "");
      } catch {
        // formulario permanece limpo
      }
    }
    setClickUpSyncFilter(parseSyncFilterJson(clickup?.syncFilterJson));

    if (
      options?.loadClickUpTeams &&
      clickup?.hasCredentials &&
      orgSetupSelectedId
    ) {
      void invoke<{ teams: ClickUpTeamDto[] }>("list_clickup_teams", {
        apiToken: null,
        connectionId: clickup.id,
      })
        .then((response) => {
          setClickUpTeams(response.teams);
        })
        .catch(() => {
          setClickUpTeams([]);
        });
    }
  }

  async function reloadIntegrationConnections() {
    if (!orgSetupSelectedId) {
      setIntegrationConnections([]);
      clearIntegrationFormState();
      return;
    }

    const connections = await invoke<IntegrationConnectionDto[]>(
      "list_integration_connections",
      { organizationId: orgSetupSelectedId },
    );
    applyIntegrationConnectionsToForm(connections, {
      loadClickUpTeams: orgDetailTab === "integrations",
    });
  }

  function buildJiraCredentialsJson(): string {
    return JSON.stringify({
      email: jiraEmail.trim(),
      apiToken: jiraApiToken.trim(),
    });
  }

  function buildClickUpCredentialsJson(): string {
    return JSON.stringify({
      apiToken: clickUpApiToken.trim(),
    });
  }

  async function handleTestJiraConnection() {
    if (!orgSetupSelectedId) {
      return;
    }

    const connection = getPmConnection("jira");
    if (!jiraApiToken.trim() && !connection?.hasCredentials) {
      setIntegrationMessage("Informe o API token do Jira para testar.");
      return;
    }

    try {
      setIntegrationBusy(true);
      setIntegrationMessage(null);
      const result = await invoke<{
        ok: boolean;
        error?: string | null;
        info?: { accountLabel?: string } | null;
      }>("test_integration_connection", {
        provider: "jira",
        configJson: JSON.stringify({ siteUrl: jiraSiteUrl.trim() }),
        credentialsJson: jiraApiToken.trim()
          ? buildJiraCredentialsJson()
          : "{}",
        connectionId: connection?.id ?? null,
      });

      if (result.ok) {
        setIntegrationMessage(
          `Jira conectado${result.info?.accountLabel ? `: ${result.info.accountLabel}` : ""}.`,
        );
      } else {
        setIntegrationMessage(result.error ?? "Falha ao testar Jira.");
      }
    } catch (testError) {
      setIntegrationMessage(
        extractErrorMessage(testError, "Falha ao testar Jira"),
      );
    } finally {
      setIntegrationBusy(false);
    }
  }

  async function handleSaveJiraConnection() {
    if (!orgSetupSelectedId) {
      return;
    }

    if (!jiraSiteUrl.trim() || !jiraEmail.trim() || !jiraApiToken.trim()) {
      setIntegrationMessage(
        "Preencha site URL, email e API token do Jira para salvar.",
      );
      return;
    }

    try {
      setIntegrationBusy(true);
      setIntegrationMessage(null);
      await invoke("save_integration_connection", {
        organizationId: orgSetupSelectedId,
        provider: "jira",
        displayName: "Jira",
        configJson: JSON.stringify({
          siteUrl: jiraSiteUrl.trim(),
          email: jiraEmail.trim(),
        }),
        credentialsJson: buildJiraCredentialsJson(),
        syncFilterJson: buildSyncFilterJson(jiraSyncFilter),
      });
      setJiraApiToken("");
      setIntegrationMessage("Conexao Jira salva.");
      await reloadIntegrationConnections();
    } catch (saveError) {
      setIntegrationMessage(
        extractErrorMessage(saveError, "Falha ao salvar Jira"),
      );
    } finally {
      setIntegrationBusy(false);
    }
  }

  async function handleTestClickUpConnection() {
    const connection = getPmConnection("clickup");
    if (!clickUpApiToken.trim() && !connection?.hasCredentials) {
      setIntegrationMessage("Informe o API token do ClickUp para testar.");
      return;
    }

    try {
      setIntegrationBusy(true);
      setIntegrationMessage(null);
      const result = await invoke<{
        ok: boolean;
        error?: string | null;
        info?: { accountLabel?: string } | null;
      }>("test_integration_connection", {
        provider: "clickup",
        configJson: "{}",
        credentialsJson: clickUpApiToken.trim()
          ? buildClickUpCredentialsJson()
          : "{}",
        connectionId: connection?.id ?? null,
      });

      if (result.ok) {
        setIntegrationMessage(
          `ClickUp conectado${result.info?.accountLabel ? `: ${result.info.accountLabel}` : ""}.`,
        );
        const teamsResponse = await invoke<{ teams: ClickUpTeamDto[] }>(
          "list_clickup_teams",
          {
            apiToken: clickUpApiToken.trim() || null,
            connectionId: clickUpApiToken.trim()
              ? null
              : (connection?.id ?? null),
          },
        );
        setClickUpTeams(teamsResponse.teams);
        if (!clickUpTeamId && teamsResponse.teams[0]) {
          setClickUpTeamId(teamsResponse.teams[0].id);
        }
      } else {
        setIntegrationMessage(result.error ?? "Falha ao testar ClickUp.");
      }
    } catch (testError) {
      setIntegrationMessage(
        extractErrorMessage(testError, "Falha ao testar ClickUp"),
      );
    } finally {
      setIntegrationBusy(false);
    }
  }

  async function handleSaveClickUpConnection() {
    if (!orgSetupSelectedId) {
      return;
    }

    if (!clickUpApiToken.trim()) {
      setIntegrationMessage("Informe o API token do ClickUp para salvar.");
      return;
    }

    if (!clickUpTeamId.trim()) {
      setIntegrationMessage("Selecione um workspace (team) do ClickUp.");
      return;
    }

    try {
      setIntegrationBusy(true);
      setIntegrationMessage(null);
      await invoke("save_integration_connection", {
        organizationId: orgSetupSelectedId,
        provider: "clickup",
        displayName: "ClickUp",
        configJson: JSON.stringify({ teamId: clickUpTeamId.trim() }),
        credentialsJson: buildClickUpCredentialsJson(),
        syncFilterJson: buildSyncFilterJson(clickUpSyncFilter),
      });
      setClickUpApiToken("");
      setIntegrationMessage("Conexao ClickUp salva.");
      await reloadIntegrationConnections();
    } catch (saveError) {
      setIntegrationMessage(
        extractErrorMessage(saveError, "Falha ao salvar ClickUp"),
      );
    } finally {
      setIntegrationBusy(false);
    }
  }

  async function handleSavePmSyncFilter(provider: "jira" | "clickup") {
    const connection = getPmConnection(provider);
    if (!connection) {
      setIntegrationMessage("Salve a conexao antes de configurar os filtros.");
      return;
    }

    const filter = provider === "jira" ? jiraSyncFilter : clickUpSyncFilter;
    const providerLabel = provider === "jira" ? "Jira" : "ClickUp";

    try {
      setIntegrationBusy(true);
      setIntegrationMessage(null);
      await invoke("save_integration_sync_filter", {
        connectionId: connection.id,
        syncFilterJson: buildSyncFilterJson(filter),
      });
      setIntegrationMessage(`Filtros de sync do ${providerLabel} salvos.`);
      await reloadIntegrationConnections();
    } catch (saveError) {
      setIntegrationMessage(
        extractErrorMessage(
          saveError,
          `Falha ao salvar filtros do ${providerLabel}`,
        ),
      );
    } finally {
      setIntegrationBusy(false);
    }
  }

  function handleDeletePmConnection(provider: "jira" | "clickup") {
    const connection = getPmConnection(provider);
    if (!connection) {
      return;
    }

    const providerLabel = provider === "jira" ? "Jira" : "ClickUp";
    setConfirmDialog({
      title: `Remover integracao ${providerLabel}?`,
      description:
        "Remove credenciais, mapeamentos de projeto e tarefas importadas desta empresa. Voce podera configurar de novo em outra empresa.",
      confirmLabel: "Remover integracao",
      destructive: true,
      onConfirm: async () => {
        try {
          setIntegrationBusy(true);
          setIntegrationMessage(null);
          await invoke("delete_integration_connection", {
            connectionId: connection.id,
          });
          setIntegrationMessage(`Integracao ${providerLabel} removida.`);
          await reloadIntegrationConnections();
          await refreshDashboard();
        } catch (deleteError) {
          setIntegrationMessage(
            extractErrorMessage(
              deleteError,
              `Falha ao remover ${providerLabel}`,
            ),
          );
        } finally {
          setIntegrationBusy(false);
        }
      },
    });
  }

  async function handleSyncPmTasks(provider?: "jira" | "clickup") {
    if (!orgSetupSelectedId) {
      return;
    }

    try {
      setIntegrationBusy(true);
      setIntegrationMessage(null);
      const result = await invoke<PmSyncResultDto>(
        "sync_organization_pm_tasks_command",
        {
          organizationId: orgSetupSelectedId,
          provider: provider ?? null,
        },
      );
      const summary = [
        `${result.created} criadas`,
        `${result.updated} atualizadas`,
        `${result.removed} removidas`,
        `${result.unchanged} sem mudanca`,
      ].join(" · ");
      setIntegrationMessage(
        result.errors.length > 0
          ? `${summary} · ${result.errors.join(" · ")}`
          : `Sync concluido: ${summary}.`,
      );
      await reloadIntegrationConnections();
      await refreshDashboard();
      const alerts = await invoke<DeadlineAlertsDto>("get_deadline_alerts");
      setDeadlineAlerts(alerts);
      await invoke<number>("notify_deadline_alerts");
    } catch (syncError) {
      setIntegrationMessage(
        extractErrorMessage(syncError, "Falha ao sincronizar tarefas"),
      );
    } finally {
      setIntegrationBusy(false);
    }
  }

  async function handleCommitTodayPlan() {
    const candidates = (data?.backlog ?? [])
      .filter((item) => item.sourceType === "imported")
      .filter((item) => item.status === "todo" || item.status === "doing")
      .filter((item) => {
        const kind = classifyWorkItemDeadlineFilter(item);
        return (
          kind === "overdue" || kind === "due_today" || kind === "due_soon"
        );
      })
      .sort((left, right) => {
        const leftDate = left.scheduledFor ?? "9999-12-31";
        const rightDate = right.scheduledFor ?? "9999-12-31";
        return leftDate.localeCompare(rightDate);
      })
      .slice(0, 3)
      .map((item) => item.id);

    if (candidates.length === 0) {
      setError(
        "Nenhuma tarefa importada com prazo encontrada para montar o dia.",
      );
      return;
    }

    try {
      await invoke("commit_today_plan_command", { workItemIds: candidates });
      await refreshDashboard();
      setError(null);
    } catch (commitError) {
      setError(
        extractErrorMessage(commitError, "Falha ao montar plano do dia"),
      );
    }
  }

  async function handleApplyWorkItemContext(task: WorkItemDto) {
    try {
      setTaskContextBusy(true);
      setTaskContextMessage(null);
      const result = await invoke<ApplyWorkItemContextResultDto>(
        "apply_work_item_context",
        { workItemId: task.id },
      );

      if (result.needsRepositoryLink) {
        setTaskContextMessage(
          "Vincule um repositorio a esta tarefa antes de aplicar o contexto.",
        );
        return;
      }

      setTaskContextMessage(
        result.context?.validation?.status === "ok"
          ? "Contexto completo aplicado com sucesso."
          : "Contexto aplicado. Revise os checks de validacao.",
      );
      await refreshDashboard();
      if (result.repositoryId) {
        const repository = repositories.find(
          (entry) => entry.id === result.repositoryId,
        );
        if (repository) {
          setSelectedGuardrail(result.guardrail ?? null);
        }
      }
    } catch (contextError) {
      setTaskContextMessage(
        extractErrorMessage(
          contextError,
          "Falha ao aplicar contexto da tarefa",
        ),
      );
    } finally {
      setTaskContextBusy(false);
    }
  }

  async function handleStartFocusForTask(task: WorkItemDto) {
    try {
      setSessionBusy(true);
      setSessionGoal(task.title);
      const result = await invoke<{
        session: SessionLogDto;
        suggestedWorkItemId?: string | null;
      }>("start_session", {
        workItemId: task.id,
        repositoryId: task.primaryRepositoryId ?? null,
        goal: task.title,
      });

      if (
        !task.id &&
        result.suggestedWorkItemId &&
        result.suggestedWorkItemId !== task.id
      ) {
        selectTaskId(result.suggestedWorkItemId);
      }

      await refreshDashboard();
      setActiveView("today");
      window.setTimeout(() => {
        sessionPanelRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 120);
    } catch (sessionError) {
      setError(extractErrorMessage(sessionError, "Falha ao iniciar foco"));
    } finally {
      setSessionBusy(false);
    }
  }

  async function handleSavePmProjectMapping() {
    if (
      !orgSetupSelectedId ||
      !pmMappingDraft.externalProjectKey ||
      !pmMappingDraft.projectId
    ) {
      setIntegrationMessage(
        "Selecione projeto Jira e projeto WCP para mapear.",
      );
      return;
    }

    try {
      setIntegrationBusy(true);
      await invoke<PmProjectMappingDto>("save_pm_project_mapping", {
        organizationId: orgSetupSelectedId,
        integrationConnectionId: getPmConnection("jira")?.id ?? null,
        externalProjectKey: pmMappingDraft.externalProjectKey,
        projectId: pmMappingDraft.projectId,
        defaultRepositoryId: pmMappingDraft.defaultRepositoryId || null,
      });
      const mappings = await invoke<PmProjectMappingDto[]>(
        "list_pm_project_mappings_command",
        { organizationId: orgSetupSelectedId },
      );
      setPmProjectMappings(mappings);
      setIntegrationMessage("Mapeamento de projeto salvo.");
    } catch (mappingError) {
      setIntegrationMessage(
        extractErrorMessage(mappingError, "Falha ao salvar mapeamento"),
      );
    } finally {
      setIntegrationBusy(false);
    }
  }

  function openGitContextForRepo(repository: RepositoryListItemDto) {
    requestTaskFormClose(() => {
      setTaskFormMode(null);
      setTaskFormError(null);
      setActiveView("repos");
      if (repository.organizationId) {
        setSelectedOrganizationId(repository.organizationId);
      }
      handleSelectRepository(repository);
    });
  }

  function goToContextStep(step: number) {
    if (step === 1) {
      if (contextStep !== 1) {
        setSelectedRepoId(null);
        setSelectedGuardrail(null);
        setHookStatus(null);
        setRepoMemory(null);
        setApplyResult(null);
        setHookResult(null);
      }
      setContextStep(1);
      return;
    }

    if (selectedOrganizationId === "all") {
      setContextStep(1);
      return;
    }

    if (step >= 3 && !selectedRepoId) {
      setContextStep(2);
      return;
    }

    setContextStep(step);
  }

  function handleSelectRepository(repository: RepositoryListItemDto) {
    setSelectedRepoId(repository.id);
    if (repository.organizationId) {
      setSelectedOrganizationId(repository.organizationId);
    }
    setContextStep(2);
    setApplyResult(null);
    setHookResult(null);
    setShowEditProjectPathForm(false);
    resetEditProjectPathForm(repository);
  }

  function openContextForRepository(
    repositoryId: string,
    organizationId?: string | null,
  ) {
    const repository = repositories.find((item) => item.id === repositoryId);
    if (!repository) {
      return;
    }
    setActiveView("repos");
    const resolvedOrganizationId =
      organizationId ?? repository.organizationId ?? null;
    if (resolvedOrganizationId) {
      setSelectedOrganizationId(resolvedOrganizationId);
    }
    handleSelectRepository(repository);
  }

  function navigateFromHistoryEvent(
    event: ContextEventDto | SearchResultDto,
    options?: { closeGlobalSearch?: boolean },
  ) {
    const workItemId = event.workItemId ?? null;
    const repositoryId = event.repositoryId ?? null;
    let organizationId =
      "organizationId" in event ? (event.organizationId ?? null) : null;

    if (!organizationId && workItemId) {
      organizationId =
        data?.backlog.find((task) => task.id === workItemId)?.organizationId ??
        null;
    }

    if (!organizationId && repositoryId) {
      organizationId =
        repositories.find((repo) => repo.id === repositoryId)?.organizationId ??
        null;
    }

    if (
      event.kind === "repository" ||
      (event.kind === "note" && !workItemId && repositoryId) ||
      (!workItemId && repositoryId)
    ) {
      if (repositoryId) {
        openContextForRepository(repositoryId, organizationId);
      } else {
        setActiveView("repos");
      }
    } else if (workItemId) {
      setSelectedTaskId(workItemId);
      setActiveView("backlog");
    }

    if (options?.closeGlobalSearch) {
      setSearchOpen(false);
      setSearchQuery("");
      setSearchResults([]);
    }
  }

  function openGlobalSearchInHistory() {
    setHistoryTextQuery(searchQuery.trim());
    setSearchOpen(false);
    setActiveView("history");
  }

  async function handlePrepareContext() {
    if (!selectedRepoId || !selectedRepo?.localPath) {
      return;
    }

    try {
      setPreparingContext(true);
      setRepoError(null);

      const guardrail = await invoke<RepositoryGuardrailDto | null>(
        "get_repository_guardrail",
        { repositoryId: selectedRepoId },
      );
      setSelectedGuardrail(guardrail);

      const needsIdentity = guardrail?.validation?.checks.some(
        (check) =>
          (check.key === "gitUserName" || check.key === "gitUserEmail") &&
          check.status === "mismatch",
      );

      if (needsIdentity) {
        const response = await invoke<ApplyIdentityResultDto>(
          "apply_repository_identity",
          { repositoryId: selectedRepoId },
        );
        setApplyResult(
          response.appliedChanges.length > 0
            ? `Identidade aplicada: ${response.appliedChanges.join(" · ")}`
            : "Identidade conferida.",
        );
      }

      let hook = await invoke<RepositoryHookStatusDto>(
        "get_repository_hook_status",
        { repositoryId: selectedRepoId },
      );

      if (!hook.managedByApp) {
        const installResponse = await invoke<InstallPrePushHookResultDto>(
          "install_repository_pre_push_hook",
          { repositoryId: selectedRepoId },
        );
        hook = {
          repositoryId: installResponse.repositoryId,
          hookPath: installResponse.hookPath,
          installed: installResponse.installed,
          managedByApp: true,
        };
        setHookResult(`Protecao instalada em ${installResponse.hookPath}`);
      }

      setHookStatus(hook);
      await refreshRepositoryContext(false);
      setContextStep(6);
    } catch (prepareError) {
      setRepoError(
        extractErrorMessage(prepareError, "Falha ao preparar contexto"),
      );
    } finally {
      setPreparingContext(false);
    }
  }

  async function handleSaveRepositoryNote() {
    if (!selectedRepoId || !repoNoteTitle.trim() || !repoNoteContent.trim()) {
      return;
    }

    try {
      setContextBusy(true);
      const response = await invoke<SaveNoteResultDto>("save_repository_note", {
        repositoryId: selectedRepoId,
        title: repoNoteTitle,
        content: repoNoteContent,
        noteType: "pattern",
      });

      setRepoMemory((current) =>
        current
          ? { ...current, notes: [response.note, ...current.notes] }
          : { repositoryId: selectedRepoId, notes: [response.note] },
      );
      setRepoNoteTitle("");
      setRepoNoteContent("");
      await refreshHistoryIfNeeded();
    } catch (contextError) {
      setRepoError(
        extractErrorMessage(
          contextError,
          "Falha ao salvar memoria do repositorio",
        ),
      );
    } finally {
      setContextBusy(false);
    }
  }

  async function handleStartSession() {
    if (!data) {
      return;
    }

    try {
      setSessionBusy(true);
      const response = await invoke<StartSessionResultDto>("start_session", {
        workItemId: selectedTaskId,
        repositoryId: selectedRepoId,
        goal: sessionGoal || null,
      });

      setData({
        ...data,
        activeSession: response.session,
      });
      setTaskContext((current) =>
        current
          ? {
              ...current,
            }
          : current,
      );
      setSessionResult("");
      setSessionDecisions("");
      setError(null);
      await refreshHistoryIfNeeded();
    } catch (startError) {
      setError(extractErrorMessage(startError, "Falha ao iniciar sessao"));
    } finally {
      setSessionBusy(false);
    }
  }

  async function handleEndSession() {
    if (!data?.activeSession) {
      return;
    }

    try {
      setSessionBusy(true);
      await invoke<EndSessionResultDto>("end_session", {
        sessionId: data.activeSession.id,
        result: sessionResult || null,
        decisions: sessionDecisions || null,
      });

      setData({
        ...data,
        activeSession: null,
      });
      setSessionGoal("");
      setSessionResult("");
      setSessionDecisions("");
      setError(null);
      if (selectedTaskId) {
        offerResumeSuggestion(
          selectedTaskId,
          [sessionResult, sessionDecisions].filter(Boolean).join(" · "),
        );
      }
      await refreshHistoryIfNeeded();
    } catch (endError) {
      setError(extractErrorMessage(endError, "Falha ao encerrar sessao"));
    } finally {
      setSessionBusy(false);
    }
  }

  function handleResumeFromSession(session: SessionLogDto) {
    setSelectedRepoId(
      session.repositoryId ?? data?.guardrail?.repositoryId ?? null,
    );
    setSessionGoal(session.goal ?? taskContext?.task?.title ?? "");
    setSessionResult("");
    setSessionDecisions(session.decisions ?? "");
  }

  function handleNextActionPrimary() {
    if (data?.activeSession) {
      sessionPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }

    const taskId = data?.todayFocus.taskId;
    if (taskId) {
      setSelectedTaskId(taskId);
      setActiveView("backlog");
    } else {
      setActiveView("backlog");
    }
  }

  function getNextActionPrimaryLabel(): string {
    if (data?.activeSession) {
      return "Continuar foco";
    }

    const focusKind = data?.todayFocus.focusKind;
    if (focusKind === "unblock") {
      return "Ver bloqueio";
    }
    if (focusKind === "pick_task") {
      return "Escolher tarefa";
    }

    return "Abrir tarefa";
  }

  async function handleSaveTaskNote() {
    if (!selectedTaskId || !noteTitle.trim() || !noteContent.trim()) {
      return;
    }

    try {
      setContextBusy(true);
      const response = await invoke<SaveNoteResultDto>("save_task_note", {
        workItemId: selectedTaskId,
        title: noteTitle,
        content: noteContent,
        noteType: "decision",
      });

      setData((current) =>
        current
          ? {
              ...current,
              taskNotes: [response.note, ...current.taskNotes],
            }
          : current,
      );
      setTaskContext((current) =>
        current
          ? {
              ...current,
              taskNotes: [response.note, ...current.taskNotes],
            }
          : current,
      );
      setNoteTitle("");
      setNoteContent("");
      offerResumeSuggestion(
        selectedTaskId,
        `${noteTitle.trim()}: ${noteContent.trim()}`,
      );
      await refreshHistoryIfNeeded();
    } catch (contextError) {
      setError(extractErrorMessage(contextError, "Falha ao salvar nota"));
    } finally {
      setContextBusy(false);
    }
  }

  async function handleAttachArtifact() {
    if (!selectedTaskId || !artifactUrl.trim()) {
      return;
    }

    try {
      setContextBusy(true);
      const response = await invoke<AttachArtifactResultDto>(
        "attach_task_artifact",
        {
          workItemId: selectedTaskId,
          repositoryId: selectedRepoId,
          artifactType: "link",
          title: artifactTitle || null,
          url: artifactUrl,
        },
      );

      setData((current) =>
        current
          ? {
              ...current,
              taskArtifacts: [response.artifact, ...current.taskArtifacts],
            }
          : current,
      );
      setTaskContext((current) =>
        current
          ? {
              ...current,
              taskArtifacts: [response.artifact, ...current.taskArtifacts],
            }
          : current,
      );
      setArtifactTitle("");
      setArtifactUrl("");
      await refreshHistoryIfNeeded();
    } catch (contextError) {
      setError(extractErrorMessage(contextError, "Falha ao anexar artefato"));
    } finally {
      setContextBusy(false);
    }
  }

  async function refreshDashboard(nextTaskId?: string | null) {
    const dashboard = await invoke<DashboardDto>("load_dashboard_data");
    setData(dashboard);

    const resolvedTaskId =
      nextTaskId === undefined
        ? (selectedTaskId ?? dashboard.backlog[0]?.id ?? null)
        : nextTaskId;

    setSelectedTaskId(resolvedTaskId);

    if (resolvedTaskId) {
      const response = await invoke<TaskContextDto>("get_task_context", {
        workItemId: resolvedTaskId,
      });
      setTaskContext(response);
    } else {
      setTaskContext(null);
    }
  }

  function isTaskFormDirty(): boolean {
    if (!taskFormMode) {
      return false;
    }
    if (taskFormMode === "create") {
      return (
        JSON.stringify(taskFormDraft) !== JSON.stringify(emptyTaskFormDraft())
      );
    }
    return (
      taskFormBaseline !== null &&
      JSON.stringify(taskFormDraft) !== JSON.stringify(taskFormBaseline)
    );
  }

  function requestTaskFormClose(onClose: () => void) {
    if (isTaskFormDirty()) {
      const confirmed = window.confirm("Descartar alteracoes nao salvas?");
      if (!confirmed) {
        return;
      }
    }
    setTaskFormBaseline(null);
    onClose();
  }

  function openCreateTaskForm() {
    requestTaskFormClose(() => {
      setTaskFormError(null);
      const draft = emptyTaskFormDraft();
      setTaskFormDraft(draft);
      setTaskFormBaseline(draft);
      setTaskFormMode("create");
    });
  }

  function openEditTaskForm(patch?: Partial<TaskFormDraft>) {
    if (!currentTask) {
      return;
    }

    setTaskFormError(null);
    const draft = { ...taskToFormDraft(currentTask), ...patch };
    setTaskFormDraft(draft);
    setTaskFormBaseline(draft);
    setTaskFormMode("edit");
  }

  function closeTaskForm() {
    requestTaskFormClose(() => {
      setTaskFormMode(null);
      setTaskFormError(null);
    });
  }

  function selectTaskId(taskId: string) {
    requestTaskFormClose(() => {
      setTaskFormMode(null);
      setTaskFormError(null);
      setSelectedTaskId(taskId);
    });
  }

  function switchActiveView(view: DesktopView) {
    requestTaskFormClose(() => {
      setTaskFormMode(null);
      setTaskFormError(null);
      if (view === "repos") {
        resetContextFlowForReposTab();
      }
      setActiveView(view);
    });
  }

  function buildTaskPayload(draft: TaskFormDraft) {
    return {
      title: draft.title,
      description: optionalFormValue(draft.description),
      status: draft.status,
      priority: draft.priority,
      organizationId: optionalFormValue(draft.organizationId),
      projectId: optionalFormValue(draft.projectId),
      primaryRepositoryId: optionalFormValue(draft.primaryRepositoryId),
      blockedReason: optionalFormValue(draft.blockedReason),
      resumeSummary: optionalFormValue(draft.resumeSummary),
    };
  }

  async function persistTaskDraft(
    draft: TaskFormDraft,
    workItemId?: string | null,
  ) {
    const payload = buildTaskPayload(draft);
    if (workItemId) {
      return invoke<{ task: WorkItemDto }>("update_work_item", {
        workItemId,
        ...payload,
      });
    }
    return invoke<{ task: WorkItemDto }>("create_work_item", payload);
  }

  async function handleSaveTaskForm() {
    if (taskFormWarnings.length > 0) {
      setTaskFormError("Revise os avisos do formulario antes de salvar.");
      return;
    }

    try {
      setTaskFormBusy(true);
      setTaskFormError(null);

      if (taskFormMode === "create") {
        const response = await persistTaskDraft(taskFormDraft);
        setTaskFormBaseline(null);
        setTaskFormMode(null);
        await refreshDashboard(response.task.id);
      } else if (taskFormMode === "edit" && selectedTaskId) {
        const response = await persistTaskDraft(taskFormDraft, selectedTaskId);
        setTaskFormBaseline(null);
        setTaskFormMode(null);
        await refreshDashboard(response.task.id);
      }
    } catch (saveError) {
      setTaskFormError(
        extractErrorMessage(saveError, "Falha ao salvar tarefa"),
      );
    } finally {
      setTaskFormBusy(false);
    }
  }

  async function handleQuickStatusChange(status: string) {
    if (!currentTask || !selectedTaskId || taskActionBusy) {
      return;
    }

    if (status === "blocked" && !currentTask.blockedReason) {
      openEditTaskForm({ status: "blocked" });
      return;
    }

    const draft = {
      ...taskToFormDraft(currentTask),
      status,
      blockedReason:
        status === "blocked" ? (currentTask.blockedReason ?? "") : "",
    };

    try {
      setTaskActionBusy(true);
      await persistTaskDraft(draft, selectedTaskId);
      await refreshDashboard(selectedTaskId);
    } catch (statusError) {
      setError(extractErrorMessage(statusError, "Falha ao atualizar status"));
    } finally {
      setTaskActionBusy(false);
    }
  }

  async function handleArchiveTask() {
    if (!currentTask || !selectedTaskId || taskActionBusy) {
      return;
    }

    try {
      setTaskActionBusy(true);
      await persistTaskDraft(
        { ...taskToFormDraft(currentTask), status: "archived" },
        selectedTaskId,
      );
      await refreshDashboard(null);
    } catch (archiveError) {
      setError(extractErrorMessage(archiveError, "Falha ao arquivar tarefa"));
    } finally {
      setTaskActionBusy(false);
    }
  }

  async function handleReopenTask() {
    if (!currentTask || !selectedTaskId || taskActionBusy) {
      return;
    }

    try {
      setTaskActionBusy(true);
      await persistTaskDraft(
        { ...taskToFormDraft(currentTask), status: "todo" },
        selectedTaskId,
      );
      await refreshDashboard(selectedTaskId);
    } catch (reopenError) {
      setError(extractErrorMessage(reopenError, "Falha ao reabrir tarefa"));
    } finally {
      setTaskActionBusy(false);
    }
  }

  async function handleDismissTask() {
    if (!currentTask || !selectedTaskId || taskActionBusy) {
      return;
    }

    const confirmed = window.confirm(
      "Ignorar esta tarefa no WCP? Ela some do foco, prazos e plano do dia. Jira/ClickUp nao serao alterados.",
    );
    if (!confirmed) {
      return;
    }

    try {
      setTaskActionBusy(true);
      await invoke<{ task: WorkItemDto }>("dismiss_work_item_command", {
        workItemId: selectedTaskId,
      });
      await refreshDashboard(null);
    } catch (dismissError) {
      setError(
        extractErrorMessage(dismissError, "Falha ao ignorar tarefa no WCP"),
      );
    } finally {
      setTaskActionBusy(false);
    }
  }

  async function handleRestoreDismissedTask() {
    if (!currentTask || !selectedTaskId || taskActionBusy) {
      return;
    }

    try {
      setTaskActionBusy(true);
      const response = await invoke<{ task: WorkItemDto }>(
        "restore_dismissed_work_item_command",
        { workItemId: selectedTaskId },
      );
      await refreshDashboard(response.task.id);
    } catch (restoreError) {
      setError(
        extractErrorMessage(restoreError, "Falha ao restaurar tarefa ignorada"),
      );
    } finally {
      setTaskActionBusy(false);
    }
  }

  async function handleDuplicateTask() {
    if (!selectedTaskId || taskActionBusy) {
      return;
    }

    try {
      setTaskActionBusy(true);
      const response = await invoke<{ task: WorkItemDto }>(
        "duplicate_work_item",
        {
          workItemId: selectedTaskId,
        },
      );
      await refreshDashboard(response.task.id);
    } catch (duplicateError) {
      setError(extractErrorMessage(duplicateError, "Falha ao duplicar tarefa"));
    } finally {
      setTaskActionBusy(false);
    }
  }

  async function handleApplyResumeSuggestion() {
    if (!resumeSuggestion || !currentTask || taskActionBusy) {
      return;
    }

    try {
      setTaskActionBusy(true);
      await persistTaskDraft(
        {
          ...taskToFormDraft(currentTask),
          resumeSummary: resumeSuggestion.text,
        },
        resumeSuggestion.taskId,
      );
      setResumeSuggestion(null);
      await refreshDashboard(resumeSuggestion.taskId);
    } catch (resumeError) {
      setError(
        extractErrorMessage(resumeError, "Falha ao salvar resumo de retomada"),
      );
    } finally {
      setTaskActionBusy(false);
    }
  }

  function offerResumeSuggestion(taskId: string, text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    setResumeSuggestion({ taskId, text: trimmed });
  }

  function updateTaskFormDraft(patch: Partial<TaskFormDraft>) {
    setTaskFormDraft((current) => ({ ...current, ...patch }));
    setTaskFormError(null);
  }

  async function handleCreateDependency() {
    if (!selectedTaskId || !dependencyTargetId) {
      return;
    }

    if (dependencyTargetId === selectedTaskId) {
      setDependencyError("Origem e destino devem ser tarefas diferentes.");
      return;
    }

    const fromWorkItemId =
      dependencyRelation === "depends_on" ? selectedTaskId : dependencyTargetId;
    const toWorkItemId =
      dependencyRelation === "depends_on" ? dependencyTargetId : selectedTaskId;

    try {
      setDependencyBusy(true);
      setDependencyError(null);
      const response = await invoke<TaskContextDto>(
        "create_work_item_dependency",
        {
          fromWorkItemId,
          toWorkItemId,
          dependencyType: "depends_on",
          contextWorkItemId: selectedTaskId,
        },
      );

      setTaskContext(response);
      setDependencyTargetId("");
      setDependencyError(null);
      await refreshHistoryIfNeeded();
    } catch (contextError) {
      setDependencyError(
        extractErrorMessage(contextError, "Falha ao criar dependencia"),
      );
    } finally {
      setDependencyBusy(false);
    }
  }

  async function handleDeleteDependency(dependencyId: string) {
    if (!selectedTaskId) {
      return;
    }

    try {
      setDependencyBusy(true);
      setDependencyError(null);
      const response = await invoke<TaskContextDto>(
        "delete_work_item_dependency",
        {
          dependencyId,
          contextWorkItemId: selectedTaskId,
        },
      );

      setTaskContext(response);
      setDependencyError(null);
      await refreshHistoryIfNeeded();
    } catch (contextError) {
      setDependencyError(
        extractErrorMessage(contextError, "Falha ao remover dependencia"),
      );
    } finally {
      setDependencyBusy(false);
    }
  }

  function handleSearchResultClick(result: SearchResultDto) {
    navigateFromHistoryEvent(result, { closeGlobalSearch: true });
  }

  function handleContextEventClick(event: ContextEventDto) {
    navigateFromHistoryEvent(event);
  }

  function formatHistoryEventMeta(event: ContextEventDto): string {
    const parts = [
      event.workItemTitle,
      event.repositoryName,
      event.organizationName,
    ].filter(Boolean);

    return parts.join(" · ");
  }

  if (loading) {
    return (
      <main className="shell mx-auto px-6 py-8 pb-20">
        <header className="mb-7 border-b border-border pb-5">
          <div className="grid gap-1">
            <span className="text-2xl font-semibold tracking-tight text-foreground">
              Contexto
            </span>
            <span className="text-sm text-muted-foreground">
              Seu assistente de trabalho
            </span>
          </div>
        </header>
        <Card>
          <CardContent className="py-8">
            <p className="text-muted-foreground">Carregando seu dia...</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="shell mx-auto px-6 py-8 pb-20">
        <header className="mb-7 border-b border-border pb-5">
          <div className="grid gap-1">
            <span className="text-2xl font-semibold tracking-tight text-foreground">
              Contexto
            </span>
            <span className="text-sm text-muted-foreground">
              Seu assistente de trabalho
            </span>
          </div>
        </header>
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="py-8">
            <h2 className="text-lg font-semibold">Nao foi possivel carregar</h2>
            <p className="mt-2 text-muted-foreground">
              {error ?? "Sem dados para exibir."}
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const pageTitle =
    activeView === "today"
      ? getGreeting()
      : activeView === "backlog"
        ? "Tarefas"
        : activeView === "organizations"
          ? "Empresa"
          : activeView === "history"
            ? "Historico"
            : "Projetos";

  return (
    <>
      <main className="shell mx-auto px-6 py-8 pb-20">
        <header className="appHeader mb-7 border-b border-border pb-5">
          <div className="appHeaderTop mb-4 flex flex-wrap items-start justify-between gap-4">
            <div className="appBrand grid gap-1">
              <span className="appName text-2xl font-semibold tracking-tight text-foreground">
                Contexto
              </span>
              <span className="appTagline text-sm text-muted-foreground">
                Seu assistente de trabalho
              </span>
            </div>
            {headerFocusTask ? (
              <Card className="max-w-sm border-primary/30 bg-card/80 shadow-glow">
                <CardContent className="grid gap-2 p-4">
                  <Badge
                    variant="secondary"
                    className="w-fit text-[11px] uppercase tracking-wide"
                  >
                    {data?.activeSession
                      ? "Foco agora · sessao ativa"
                      : "Foco agora"}
                  </Badge>
                  <strong className="text-sm leading-snug">
                    {headerFocusTask.title}
                  </strong>
                  {headerFocusTask.primaryRepositoryId ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-fit"
                      onClick={() =>
                        openContextForRepository(
                          headerFocusTask.primaryRepositoryId!,
                          headerFocusTask.organizationId,
                        )
                      }
                    >
                      <GitBranch className="h-4 w-4" aria-hidden />
                      Ir para contexto
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </div>

          <section className="globalSearch relative">
            <SearchField
              type="search"
              className="h-11 rounded-2xl bg-background/80"
              placeholder="Buscar em tarefas, notas, sessoes e projetos..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label="Busca global no historico local"
            />
            {searchOpen ? (
              <div
                className="searchResultsPanel"
                role="listbox"
                aria-label="Resultados da busca"
              >
                {searchBusy ? (
                  <p className="searchResultsStatus">Buscando...</p>
                ) : null}
                {!searchBusy && groupedSearchResults.length === 0 ? (
                  <p className="searchResultsStatus">
                    Nenhum resultado para &quot;{searchQuery.trim()}&quot;
                  </p>
                ) : null}
                {searchQuery.trim().length >= 2 ? (
                  <div className="searchResultsFooter">
                    <Button
                      type="button"
                      variant="secondary"
                      className="searchOpenHistoryButton w-full"
                      onClick={openGlobalSearchInHistory}
                    >
                      <History className="h-4 w-4" aria-hidden />
                      Ver tudo no Historico
                    </Button>
                  </div>
                ) : null}
                {groupedSearchResults.map((group) => {
                  const GroupIcon = getSearchKindIcon(group.kind);

                  return (
                    <div key={group.kind} className="searchGroup">
                      <h3 className="searchGroupTitle inline-flex items-center gap-2">
                        <GroupIcon
                          className="h-4 w-4 text-muted-foreground"
                          aria-hidden
                        />
                        {group.label}
                      </h3>
                      {group.items.map((item) => (
                        <SearchResultButton
                          key={`${item.kind}-${item.id}`}
                          kind={item.kind}
                          onClick={() => handleSearchResultClick(item)}
                          title={item.title}
                          detail={
                            item.detail
                              ? truncateSearchDetail(item.detail)
                              : undefined
                          }
                          meta={`${normalizeSearchLabel(item.kind)}${
                            item.createdAt
                              ? ` · ${formatDateTime(item.createdAt)}`
                              : ""
                          }`}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>

          <div className="mt-4" aria-label="Navegacao principal">
            <MainViewTabs
              value={activeView}
              onValueChange={(view) => switchActiveView(view)}
            />
          </div>
        </header>

        <PageHeader
          view={activeView}
          title={pageTitle}
          hint={VIEW_PAGE_HINT[activeView]}
        />

        {activeView === "today" ? (
          <>
            <section className="panel">
              <div className="dayOverview">
                {todayDayBrief ? (
                  <section className="daySummary" aria-label="Resumo do dia">
                    <p className="dayBriefLine dayBriefLine-muted">
                      {todayDayBrief.line1}
                    </p>
                    <p className="dayBriefLine dayBriefLine-strong">
                      {todayDayBrief.line2}
                    </p>
                  </section>
                ) : null}

                <section
                  className={`nextActionPanel nextActionPanel-${data.todayFocus.focusKind}`}
                  aria-label="Proxima acao"
                >
                  {data.activeSession ? (
                    <div className="sessionDominantBar">
                      <StatusBadge variant="live">Em foco</StatusBadge>
                      <span>
                        {data.todayFocus.sessionGoal?.trim() ||
                          data.activeSession.goal?.trim() ||
                          data.todayFocus.headline}
                      </span>
                      <span className="sessionDominantMeta muted">
                        {formatDateTime(data.activeSession.startedAt)}
                        {data.activeSession.branchName
                          ? ` · ${data.activeSession.branchName}`
                          : ""}
                      </span>
                    </div>
                  ) : null}

                  <div className="todayContextChips">
                    <Badge variant="secondary">{todayFocusKindLabel}</Badge>
                    <Badge variant="outline">P{todayFocusPriority}</Badge>
                    {data.todayFocus.primaryRepositoryName ? (
                      <Badge variant="outline">
                        {data.todayFocus.primaryRepositoryName}
                      </Badge>
                    ) : null}
                  </div>

                  {data.todayFocus.focusKind === "unblock" &&
                  data.todayFocus.blockerLabel ? (
                    <StatusAlert
                      status="warning"
                      title="Bloqueio"
                      className="nextActionAlert"
                    >
                      {data.todayFocus.blockerLabel}
                    </StatusAlert>
                  ) : null}

                  {data.todayFocus.focusKind === "unblock" &&
                  data.todayFocus.dependencyLabel ? (
                    <StatusAlert
                      status="warning"
                      title="Dependencia"
                      className="nextActionAlert"
                    >
                      {data.todayFocus.dependencyLabel}
                    </StatusAlert>
                  ) : null}

                  <div className="nextActionHeader">
                    <span className="nextActionEyebrow">Proxima acao</span>
                    <h2 className="nextActionStep">
                      {data.todayFocus.nextStep}
                    </h2>
                    {data.todayFocus.headline &&
                    data.todayFocus.headline !== data.todayFocus.nextStep ? (
                      <p className="nextActionHeadline muted">
                        {data.todayFocus.headline}
                      </p>
                    ) : null}
                  </div>

                  {data.todayFocus.focusKind !== "unblock" &&
                  data.todayFocus.blockerLabel ? (
                    <StatusAlert
                      status="warning"
                      title="Bloqueio"
                      className="nextActionAlert"
                    >
                      {data.todayFocus.blockerLabel}
                    </StatusAlert>
                  ) : null}

                  {data.todayFocus.focusKind !== "unblock" &&
                  data.todayFocus.dependencyLabel ? (
                    <StatusAlert
                      status="warning"
                      title="Dependencia"
                      className="nextActionAlert"
                    >
                      {data.todayFocus.dependencyLabel}
                    </StatusAlert>
                  ) : null}

                  {data.todayFocus.resumeHint ? (
                    <p className="nextActionResume muted">
                      Retomada: {data.todayFocus.resumeHint}
                    </p>
                  ) : null}

                  <div className="actionRow">
                    <Button type="button" onClick={handleNextActionPrimary}>
                      {getNextActionPrimaryLabel()}
                    </Button>
                    {data.todayFocus.primaryRepositoryId ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          openContextForRepository(
                            data.todayFocus.primaryRepositoryId!,
                            data.currentTask?.organizationId,
                          )
                        }
                      >
                        Ir para{" "}
                        {data.todayFocus.primaryRepositoryName ?? "projeto"}
                      </Button>
                    ) : null}
                  </div>
                </section>

                {todayStatusChips.length > 0 ? (
                  <div
                    className="todayContextChips todayStatusChips"
                    aria-label="Sinais do dia"
                  >
                    {todayStatusChips.map((chip) => (
                      <Badge key={chip} variant="outline">
                        {chip}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                <div className="dayMetrics">
                  <article className="dayMetric">
                    <span>Prontas para fazer</span>
                    <strong>{data.summary.executableCount}</strong>
                  </article>
                  <article className="dayMetric">
                    <span>Em andamento</span>
                    <strong>{data.summary.doingCount}</strong>
                  </article>
                  <article className="dayMetric">
                    <span>Bloqueadas</span>
                    <strong>{data.summary.blockedCount}</strong>
                  </article>
                </div>

                {deadlineAlerts && deadlineAlerts.items.length > 0 ? (
                  <section
                    className="integrationDeadlines"
                    aria-label="Prazos das integracoes"
                  >
                    <h3 className="subheading">Prazos das integracoes</h3>
                    {groupedDeadlineAlerts.map((group) => (
                      <div
                        key={group.organizationId}
                        className="integrationDeadlineGroup"
                      >
                        <div className="integrationDeadlineGroupHeader">
                          <OrganizationAvatar
                            name={group.organizationName}
                            logoUrl={
                              organizationLogoUrls[group.organizationId] ?? null
                            }
                            size="sm"
                          />
                          <strong>{group.organizationName}</strong>
                        </div>
                        <ul className="historyList integrationDeadlineList">
                          {group.items.map((alert) => (
                            <li key={`${alert.workItemId}-${alert.kind}`}>
                              <div>
                                <strong>{alert.title}</strong>
                                <span>
                                  {formatDeadlineAlertKind(alert.kind)} ·{" "}
                                  {formatDateTime(alert.scheduledFor)}
                                  {alert.externalProvider
                                    ? ` · ${formatPmProviderLabel(alert.externalProvider)}`
                                    : ""}
                                </span>
                              </div>
                              {alert.externalUrl ? (
                                <a
                                  className="externalTaskLink"
                                  href={alert.externalUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Abrir
                                </a>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </section>
                ) : null}

                <div className="quickLinks">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleCommitTodayPlan()}
                  >
                    Montar meu dia
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveView("backlog")}
                  >
                    Ver tarefas
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveView("repos")}
                  >
                    Ver projetos
                  </Button>
                </div>
              </div>
            </section>

            <section
              ref={sessionPanelRef}
              className="panel focusPanel sessionPanel"
            >
              <div className="sessionHeader">
                <div className="panelHeading">
                  <h2>Foco agora</h2>
                  <p className="muted">
                    {data.activeSession
                      ? "Registre o resultado da sessao abaixo."
                      : "Registre o que pretende fazer neste bloco de trabalho."}
                  </p>
                </div>
                <StatusBadge variant={data.activeSession ? "live" : "idle"}>
                  {data.activeSession ? "Em foco" : "Parado"}
                </StatusBadge>
              </div>

              {!data.activeSession ? (
                <div className="sessionForm">
                  <label>
                    O que voce vai fazer?
                    <Textarea
                      value={sessionGoal}
                      onChange={(event) => setSessionGoal(event.target.value)}
                      placeholder="Ex.: corrigir o bug do login antes do deploy"
                    />
                  </label>
                  <div className="actionRow">
                    <Button
                      type="button"
                      onClick={handleStartSession}
                      disabled={sessionBusy || !selectedTaskId}
                    >
                      {sessionBusy ? "Iniciando..." : "Comecar foco"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="sessionForm">
                  <label>
                    O que saiu disso?
                    <Textarea
                      value={sessionResult}
                      onChange={(event) => setSessionResult(event.target.value)}
                      placeholder="Ex.: bug corrigido e testado localmente"
                    />
                  </label>
                  <label>
                    Decisoes importantes
                    <Textarea
                      value={sessionDecisions}
                      onChange={(event) =>
                        setSessionDecisions(event.target.value)
                      }
                      placeholder="Ex.: manter a validacao no backend por enquanto"
                    />
                  </label>
                  <div className="actionRow">
                    <Button
                      type="button"
                      onClick={handleEndSession}
                      disabled={sessionBusy}
                    >
                      {sessionBusy ? "Encerrando..." : "Encerrar foco"}
                    </Button>
                  </div>
                </div>
              )}
            </section>

            {data.todayPlan.length > 0 ? (
              <section className="panel">
                <div className="panelHeading">
                  <h2>Proximos passos</h2>
                  <p className="muted">Sugestoes do que atacar em seguida.</p>
                </div>
                <ul className="taskList">
                  {data.todayPlan.map((item) => {
                    const workItem = planMap.get(item.workItemId);
                    return (
                      <li
                        key={item.id}
                        className={
                          item.isCommitted
                            ? "taskListItem-committed"
                            : undefined
                        }
                      >
                        <div>
                          <strong>
                            {item.position}. {workItem?.title}
                          </strong>
                          <PlanStatusBadge committed={item.isCommitted}>
                            {item.isCommitted
                              ? "Comprometida hoje"
                              : "Sugestao"}
                          </PlanStatusBadge>
                        </div>
                        <span>{formatTaskStatus(workItem?.status ?? "-")}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            <section className="panel softPanel twoCol">
              <div>
                <div className="panelHeading">
                  <h2>Para retomar depois</h2>
                  <p className="muted">
                    Tarefas relacionadas a{" "}
                    <strong>
                      {data.currentTask?.title ??
                        currentTask?.title ??
                        "sua selecao atual"}
                    </strong>
                    .
                  </p>
                </div>
                <ul className="taskList">
                  {todayRecoverableContext.length > 0 ? (
                    todayRecoverableContext.map((candidate) => {
                      const workItem = planMap.get(candidate.workItemId);
                      return (
                        <li key={candidate.workItemId}>
                          <div>
                            <strong>{workItem?.title}</strong>
                            <span>{candidate.reasons.join(" · ")}</span>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setSelectedTaskId(candidate.workItemId);
                              setActiveView("backlog");
                            }}
                          >
                            Abrir
                          </Button>
                        </li>
                      );
                    })
                  ) : (
                    <li>
                      <div>
                        <strong>Nada por aqui</strong>
                        <span>
                          Quando houver sugestoes, elas aparecem nesta lista.
                        </span>
                      </div>
                    </li>
                  )}
                </ul>
              </div>

              <div>
                <div className="panelHeading">
                  <h2>Ambiente Git</h2>
                  <p className="muted">
                    Projeto:{" "}
                    <strong>
                      {data.todayFocus.primaryRepositoryName ??
                        data.guardrail?.repositoryName ??
                        "Nenhum configurado ainda"}
                    </strong>
                  </p>
                </div>
                {dashboardValidation ? (
                  <>
                    <StatusAlert
                      status={dashboardValidation.status}
                      title={formatValidationStatus(dashboardValidation.status)}
                    >
                      Conferencia rapida da identidade local
                    </StatusAlert>
                    <ul className="checkList">
                      {dashboardValidation.checks.map((check) => (
                        <li key={check.key}>
                          <strong>{humanizeCheckKey(check.key)}</strong>
                          <span>{formatValidationCheckDetail(check)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <StatusAlert status="warning" title="Ainda sem conferencia">
                    Abra a aba Projetos para validar o ambiente Git deste repo.
                  </StatusAlert>
                )}
                <div className="quickLinks">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (data.guardrail?.repositoryId) {
                        openContextForRepository(
                          data.guardrail.repositoryId,
                          data.currentTask?.organizationId,
                        );
                      } else {
                        setActiveView("repos");
                      }
                    }}
                  >
                    <ArrowRightLeft className="h-4 w-4" aria-hidden />
                    Abrir troca de contexto
                  </Button>
                </div>
              </div>
            </section>
          </>
        ) : null}

        {activeView === "backlog" ? (
          <section className="panel backlogPanel">
            <div className="backlogLayout">
              <aside className="backlogSidebar">
                <div className="backlogSidebarHeader">
                  <SectionTitle icon={ListTodo}>Suas tarefas</SectionTitle>
                  <Button type="button" size="sm" onClick={openCreateTaskForm}>
                    <Plus className="h-4 w-4" aria-hidden />
                    Nova tarefa
                  </Button>
                </div>

                <SearchField
                  type="search"
                  className="h-10"
                  placeholder="Buscar tarefas..."
                  value={backlogSearchQuery}
                  onChange={(event) =>
                    setBacklogSearchQuery(event.target.value)
                  }
                  aria-label="Buscar tarefas no backlog"
                />

                <div className="backlogFilters">
                  <label className="grid gap-2 text-xs text-muted-foreground">
                    <Label htmlFor="backlog-source-filter">Origem</Label>
                    <select
                      id="backlog-source-filter"
                      value={backlogSourceFilter}
                      onChange={(event) =>
                        setBacklogSourceFilter(event.target.value)
                      }
                    >
                      {BACKLOG_SOURCE_FILTERS.map((filter) => (
                        <option key={filter.value} value={filter.value}>
                          {filter.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-xs text-muted-foreground">
                    <Label htmlFor="backlog-deadline-filter">Prazo</Label>
                    <select
                      id="backlog-deadline-filter"
                      value={backlogDeadlineFilter}
                      onChange={(event) =>
                        setBacklogDeadlineFilter(event.target.value)
                      }
                    >
                      {BACKLOG_DEADLINE_FILTERS.map((filter) => (
                        <option key={filter.value} value={filter.value}>
                          {filter.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-xs text-muted-foreground">
                    <Label htmlFor="backlog-status-filter">Status</Label>
                    <select
                      id="backlog-status-filter"
                      value={backlogStatusFilter}
                      onChange={(event) =>
                        setBacklogStatusFilter(event.target.value)
                      }
                    >
                      {BACKLOG_STATUS_FILTERS.map((filter) => (
                        <option key={filter.value} value={filter.value}>
                          {filter.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-xs text-muted-foreground">
                    <Label htmlFor="backlog-org-filter">Empresa</Label>
                    <select
                      id="backlog-org-filter"
                      value={backlogOrgFilter}
                      onChange={(event) =>
                        setBacklogOrgFilter(event.target.value)
                      }
                    >
                      <option value="all">Todas</option>
                      {organizations.map((organization) => (
                        <option key={organization.id} value={organization.id}>
                          {organization.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-xs text-muted-foreground">
                    <Label htmlFor="backlog-sort">Ordenar</Label>
                    <select
                      id="backlog-sort"
                      value={backlogSort}
                      onChange={(event) =>
                        setBacklogSort(
                          event.target.value as
                            | "priority"
                            | "scheduled_for"
                            | "title"
                            | "status",
                        )
                      }
                    >
                      {BACKLOG_SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="backlogToggleArchived">
                  <input
                    type="checkbox"
                    checked={showArchivedBacklog}
                    onChange={(event) =>
                      setShowArchivedBacklog(event.target.checked)
                    }
                  />
                  Mostrar arquivadas
                </label>

                <label className="backlogToggleArchived">
                  <input
                    type="checkbox"
                    checked={showDismissedBacklog}
                    onChange={(event) =>
                      setShowDismissedBacklog(event.target.checked)
                    }
                  />
                  Mostrar ignoradas
                </label>

                <div className="repoList backlogList">
                  {filteredBacklog.length === 0 ? (
                    <p className="historyEmpty">Nenhuma tarefa neste filtro.</p>
                  ) : null}
                  {filteredBacklog.map((item) => (
                    <SelectableListItem
                      key={item.id}
                      active={selectedTaskId === item.id}
                      linked={relatedDependencyIds.has(item.id)}
                      onClick={() => selectTaskId(item.id)}
                      title={item.title}
                      subtitle={buildTaskPreviewLine(item)}
                    >
                      <Badge variant="outline">P{item.priority ?? 3}</Badge>
                      {item.status === "blocked" ? (
                        <StatusBadge variant="blocked">Bloqueada</StatusBadge>
                      ) : null}
                      {item.resumeSummary ? (
                        <Badge variant="success">Retomada</Badge>
                      ) : null}
                      {item.status === "archived" ? (
                        <Badge variant="secondary">Arquivada</Badge>
                      ) : null}
                      {item.wcpDismissedAt ? (
                        <Badge variant="secondary">Ignorada</Badge>
                      ) : null}
                      {relatedDependencyIds.has(item.id) ? (
                        <Badge variant="outline">Relacionada</Badge>
                      ) : null}
                      {item.sourceType === "imported" &&
                      item.externalProvider ? (
                        <Badge variant="outline">
                          Importado ·{" "}
                          {formatPmProviderLabel(item.externalProvider)}
                          {item.externalKey ? ` · ${item.externalKey}` : ""}
                        </Badge>
                      ) : null}
                      {item.organizationId ? (
                        <Badge variant="secondary">
                          {organizationMap.get(item.organizationId) ??
                            "Empresa"}
                        </Badge>
                      ) : null}
                      {item.scheduledFor ? (
                        <Badge variant="outline">
                          Prazo {formatDateTime(item.scheduledFor)}
                        </Badge>
                      ) : null}
                      <span>{formatTaskStatus(item.status)}</span>
                    </SelectableListItem>
                  ))}
                </div>
              </aside>

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
                          : "Selecione uma tarefa na lista ao lado."}
                    </p>
                  </div>
                  {taskFormMode ? null : currentTask ? (
                    <div className="taskDetailActions">
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
                      <Badge variant="outline">
                        P{currentTask.priority ?? 3}
                      </Badge>
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
                      {currentTask.externalUrl ? (
                        <a
                          className="externalTaskLink"
                          href={currentTask.externalUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir no{" "}
                          {formatPmProviderLabel(
                            currentTask.externalProvider ?? "pm",
                          )}
                        </a>
                      ) : null}
                      {currentTask.sourceType === "imported" &&
                      !currentTask.wcpDismissedAt ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            disabled={taskContextBusy}
                            onClick={() =>
                              void handleApplyWorkItemContext(currentTask)
                            }
                          >
                            Aplicar contexto completo
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={sessionBusy}
                            onClick={() =>
                              void handleStartFocusForTask(currentTask)
                            }
                          >
                            Iniciar foco
                          </Button>
                        </>
                      ) : null}
                      {currentTask.organizationId ? (
                        <Badge variant="secondary">
                          {organizationMap.get(currentTask.organizationId) ??
                            "Empresa"}
                        </Badge>
                      ) : null}
                      {currentTask.wcpDismissedAt ? (
                        <Badge variant="secondary">Ignorada no WCP</Badge>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEditTaskForm()}
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={taskActionBusy}
                        onClick={() => void handleDuplicateTask()}
                      >
                        Duplicar
                      </Button>
                      {currentTask.primaryRepositoryId ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            openContextForRepository(
                              currentTask.primaryRepositoryId!,
                              currentTask.organizationId,
                            )
                          }
                        >
                          Abrir contexto Git
                        </Button>
                      ) : null}
                      {currentTask.wcpDismissedAt ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={taskActionBusy}
                          onClick={() => void handleRestoreDismissedTask()}
                        >
                          Restaurar ignorada
                        </Button>
                      ) : currentTask.sourceType === "imported" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={taskActionBusy}
                          onClick={() => void handleDismissTask()}
                        >
                          Ignorar no WCP
                        </Button>
                      ) : null}
                      {currentTask.status === "archived" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={taskActionBusy}
                          onClick={() => void handleReopenTask()}
                        >
                          Reabrir
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={taskActionBusy}
                          onClick={() => void handleArchiveTask()}
                        >
                          Arquivar
                        </Button>
                      )}
                    </div>
                  ) : null}
                </div>

                {taskContextMessage && currentTask ? (
                  <p className="resultText">{taskContextMessage}</p>
                ) : null}

                {currentTask?.sourceType === "imported" &&
                !currentTask.primaryRepositoryId ? (
                  <div className="sessionForm compactForm">
                    <p className="muted">
                      Vincule um repositorio desta empresa para aplicar contexto
                      Git automaticamente.
                    </p>
                    <label>
                      Repositorio
                      <select
                        defaultValue=""
                        onChange={(event) => {
                          const repositoryId = event.target.value;
                          if (!repositoryId || !currentTask) {
                            return;
                          }
                          void invoke("update_work_item", {
                            workItemId: currentTask.id,
                            title: currentTask.title,
                            description: currentTask.description,
                            status: currentTask.status,
                            priority: currentTask.priority ?? 3,
                            organizationId: currentTask.organizationId,
                            projectId: currentTask.projectId,
                            primaryRepositoryId: repositoryId,
                            blockedReason: currentTask.blockedReason,
                            resumeSummary: currentTask.resumeSummary,
                          }).then(() => refreshDashboard());
                        }}
                      >
                        <option value="">Selecione</option>
                        {repositories
                          .filter(
                            (repo) =>
                              repo.organizationId ===
                              currentTask.organizationId,
                          )
                          .map((repo) => (
                            <option key={repo.id} value={repo.id}>
                              {repo.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                ) : null}

                {resumeSuggestion &&
                selectedTaskId === resumeSuggestion.taskId &&
                !taskFormMode ? (
                  <StatusAlert status="ok" title="Sugestao de retomada">
                    <div className="grid gap-3">
                      <span>{resumeSuggestion.text}</span>
                      <div className="actionRow">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setResumeSuggestion(null)}
                        >
                          Ignorar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={taskActionBusy}
                          onClick={() => void handleApplyResumeSuggestion()}
                        >
                          Usar como retomada
                        </Button>
                      </div>
                    </div>
                  </StatusAlert>
                ) : null}

                {taskFormMode ? (
                  <TaskFormPanel
                    mode={taskFormMode}
                    draft={taskFormDraft}
                    busy={taskFormBusy}
                    error={taskFormError}
                    warnings={taskFormWarnings}
                    organizations={organizations}
                    organizationLogoUrls={organizationLogoUrls}
                    projects={projects}
                    repositories={repositories}
                    onDraftChange={updateTaskFormDraft}
                    onCancel={closeTaskForm}
                    onSave={() => void handleSaveTaskForm()}
                  />
                ) : currentTask ? (
                  <div className="taskDetailGrid">
                    <div className="taskQuickActions">
                      <h3 className="subheading">Status rapido</h3>
                      <div className="timelineFilters">
                        {QUICK_STATUS_OPTIONS.map((option) => (
                          <Button
                            key={option.value}
                            type="button"
                            size="sm"
                            variant={
                              currentTask.status === option.value
                                ? "default"
                                : "outline"
                            }
                            disabled={
                              taskActionBusy ||
                              currentTask.status === option.value
                            }
                            onClick={() =>
                              void handleQuickStatusChange(option.value)
                            }
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
                    <div>
                      <h3 className="subheading">Historico</h3>
                      {taskTimeline.length > 0 ? (
                        <FilterTabs
                          value={timelineFilter}
                          onValueChange={setTimelineFilter}
                          aria-label="Filtrar historico por tipo"
                          items={TIMELINE_FILTERS.map((filter) => ({
                            id: filter.id,
                            label: `${filter.label} (${timelineCounts[filter.id]})`,
                            icon: HISTORY_KIND_ICONS[filter.id],
                          }))}
                        />
                      ) : null}
                      {taskTimeline.length === 0 ? (
                        <StatusAlert status="warning" title="Historico vazio">
                          Comece um foco ou adicione notas para montar o
                          contexto.
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

                      {currentTask?.blockedReason ? (
                        <>
                          <h3 className="subheading">Por que esta parada</h3>
                          <StatusAlert status="mismatch" title="Bloqueio">
                            {currentTask.blockedReason}
                          </StatusAlert>
                        </>
                      ) : null}

                      <h3 className="subheading">Dependencias</h3>
                      <div className="sessionForm compactForm">
                        <p className="muted">
                          Esta tarefa:{" "}
                          <strong>
                            {currentTask?.title ?? "Sem tarefa selecionada"}
                          </strong>
                        </p>
                        <label>
                          Relacao com outra tarefa
                          <select
                            value={dependencyRelation}
                            onChange={(event) => {
                              setDependencyRelation(
                                event.target.value as "depends_on" | "blocks",
                              );
                              setDependencyError(null);
                            }}
                          >
                            <option value="depends_on">depende de</option>
                            <option value="blocks">bloqueia</option>
                          </select>
                        </label>
                        <label>
                          Tarefa
                          <select
                            value={dependencyTargetId}
                            onChange={(event) => {
                              setDependencyTargetId(event.target.value);
                              setDependencyError(null);
                            }}
                          >
                            <option value="">Selecione a tarefa</option>
                            {filteredBacklog
                              .filter((item) => item.id !== selectedTaskId)
                              .map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.title}
                                </option>
                              ))}
                          </select>
                        </label>
                        {dependencyPreviewText ? (
                          <p className="dependencyPreview">
                            {dependencyPreviewText}
                          </p>
                        ) : null}
                        {dependencyError ? (
                          <p className="dependencyError">{dependencyError}</p>
                        ) : null}
                        <div className="actionRow">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleCreateDependency}
                            disabled={
                              dependencyBusy ||
                              !currentTask ||
                              !dependencyTargetId
                            }
                          >
                            Adicionar dependencia
                          </Button>
                        </div>
                      </div>
                      {(taskContext?.dependencies ?? []).length > 0 ? (
                        <ul className="historyList">
                          {(taskContext?.dependencies ?? []).map(
                            (dependency) => (
                              <li key={dependency.id}>
                                <div>
                                  <strong>{dependency.title}</strong>
                                  <span>
                                    {currentTask
                                      ? formatDependencySentence(
                                          currentTask.title,
                                          dependency.relation,
                                          dependency.title,
                                        )
                                      : dependency.relation === "depends_on"
                                        ? "depende de"
                                        : "bloqueia"}
                                  </span>
                                  <code>{dependency.status}</code>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() =>
                                    handleDeleteDependency(dependency.id)
                                  }
                                  disabled={dependencyBusy}
                                >
                                  Remover
                                </Button>
                              </li>
                            ),
                          )}
                        </ul>
                      ) : (
                        <StatusAlert status="ok" title="Tudo livre">
                          Nenhuma dependencia registrada nesta tarefa.
                        </StatusAlert>
                      )}

                      <h3 className="subheading">Notas</h3>
                      <div className="sessionForm compactForm">
                        <label>
                          Titulo
                          <input
                            value={noteTitle}
                            onChange={(event) =>
                              setNoteTitle(event.target.value)
                            }
                            placeholder="Decisao tomada"
                          />
                        </label>
                        <label>
                          Conteudo
                          <Textarea
                            value={noteContent}
                            onChange={(event) =>
                              setNoteContent(event.target.value)
                            }
                            placeholder="Ex.: manter invalidação após persistência do novo token"
                          />
                        </label>
                        <div className="actionRow">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleSaveTaskNote}
                            disabled={contextBusy}
                          >
                            Salvar nota
                          </Button>
                        </div>
                      </div>

                      <ul className="historyList">
                        {(taskContext?.taskNotes ?? []).map((note) => (
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
                    </div>

                    <div>
                      <h3 className="subheading">Ultimos focos</h3>
                      {(taskContext?.recentTaskSessions ?? []).length > 0 ? (
                        <ul className="historyList">
                          {(taskContext?.recentTaskSessions ?? []).map(
                            (session) => (
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
                                      {formatSourceTypeLabel(
                                        session.sourceType,
                                      )}
                                    </Badge>
                                  ) : null}
                                  <span>
                                    {session.branchName ??
                                      "Branch nao registrada"}
                                  </span>
                                  <span>
                                    {session.goal ?? "Sem objetivo registrado"}
                                  </span>
                                </div>
                                <div className="historyMeta">
                                  <code>
                                    {session.result ??
                                      "Ainda sem resultado final"}
                                  </code>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                      handleResumeFromSession(session)
                                    }
                                  >
                                    Retomar
                                  </Button>
                                </div>
                              </li>
                            ),
                          )}
                        </ul>
                      ) : (
                        <StatusAlert
                          status="warning"
                          title="Sem sessoes anteriores"
                        >
                          Quando encerrar um foco, ele aparece aqui.
                        </StatusAlert>
                      )}

                      <h3 className="subheading">Links e anexos</h3>
                      <div className="sessionForm compactForm">
                        <label>
                          Titulo
                          <input
                            value={artifactTitle}
                            onChange={(event) =>
                              setArtifactTitle(event.target.value)
                            }
                            placeholder="PR, doc, link"
                          />
                        </label>
                        <label>
                          URL
                          <input
                            value={artifactUrl}
                            onChange={(event) =>
                              setArtifactUrl(event.target.value)
                            }
                            placeholder="https://..."
                          />
                        </label>
                        <div className="actionRow">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleAttachArtifact}
                            disabled={contextBusy}
                          >
                            Anexar link
                          </Button>
                        </div>
                      </div>

                      <ul className="historyList">
                        {(taskContext?.taskArtifacts ?? []).map((artifact) => (
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
                    </div>
                  </div>
                ) : (
                  <StatusAlert status="warning" title="Escolha uma tarefa">
                    A lista ao lado mostra tudo que esta no seu backlog.
                  </StatusAlert>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {activeView === "organizations" ? (
          <section className="panel orgPanel">
            <div className="orgLayout">
              <aside className="orgSidebar">
                <div className="backlogSidebarHeader">
                  <SectionTitle icon={Building2}>Empresas</SectionTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowNewOrgForm((current) => !current);
                      setOrgSetupError(null);
                    }}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Nova empresa
                  </Button>
                </div>

                {showNewOrgForm ? (
                  <div className="sessionForm compactForm">
                    <label>
                      Nome
                      <input
                        value={newOrgName}
                        onChange={(event) => setNewOrgName(event.target.value)}
                        placeholder="Empresa A"
                      />
                    </label>
                    <label>
                      Tipo
                      <select
                        value={newOrgKind}
                        onChange={(event) => setNewOrgKind(event.target.value)}
                      >
                        <option value="company">Empresa</option>
                        <option value="personal">Pessoal</option>
                        <option value="community">Comunidade</option>
                      </select>
                    </label>
                    <div className="actionRow">
                      <Button
                        type="button"
                        onClick={() => void handleCreateOrganization()}
                        disabled={orgSetupBusy || !newOrgName.trim()}
                      >
                        <Building2 className="h-4 w-4" aria-hidden />
                        Criar empresa
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="repoList orgOrgList">
                  {organizations.map((organization) => (
                    <SelectableListItem
                      key={organization.id}
                      active={orgSetupSelectedId === organization.id}
                      onClick={() => {
                        setOrgSetupSelectedId(organization.id);
                        setOrgSetupError(null);
                      }}
                      leading={
                        <OrganizationAvatar
                          name={organization.name}
                          kind={organization.kind}
                          logoUrl={getOrganizationLogoUrl(organization.id)}
                          size="sm"
                        />
                      }
                      title={organization.name}
                      subtitle={formatOrganizationKind(organization.kind)}
                    >
                      {organization.gitUserName ? (
                        <Badge variant="outline">
                          {organization.gitUserName}
                        </Badge>
                      ) : (
                        <Badge variant="warning">Sem identidade Git</Badge>
                      )}
                      <span>
                        {
                          projects.filter(
                            (project) =>
                              project.organizationId === organization.id,
                          ).length
                        }{" "}
                        projetos
                      </span>
                    </SelectableListItem>
                  ))}
                </div>
              </aside>

              <div className="orgDetail">
                {orgSetupError ? (
                  <p className="errorText">{orgSetupError}</p>
                ) : null}
                {orgSetupSuccess ? (
                  <p className="resultText">{orgSetupSuccess}</p>
                ) : null}

                {orgSetupOrganization ? (
                  <>
                    <FilterTabs
                      items={ORG_DETAIL_TABS.map((tab) => ({
                        id: tab.id,
                        label: tab.label,
                        icon: ORG_TAB_ICONS[tab.id],
                      }))}
                      value={orgDetailTab}
                      onValueChange={(value) => setOrgDetailTab(value)}
                      aria-label="Secoes da empresa"
                    />

                    {orgDetailTab === "company" ? (
                      <div className="orgDetailSection">
                        <div className="orgProfileHeader">
                          <OrganizationAvatar
                            name={orgSetupOrganization.name}
                            kind={orgSetupOrganization.kind}
                            logoUrl={getOrganizationLogoUrl(
                              orgSetupOrganization.id,
                            )}
                            size="lg"
                          />
                          <div className="orgProfileSummary">
                            <strong>{orgSetupOrganization.name}</strong>
                            <span>
                              {formatOrganizationKind(
                                orgSetupOrganization.kind,
                              )}
                            </span>
                            <span>
                              Perfil Git:{" "}
                              {orgSetupOrganization.environmentName ?? "Padrao"}
                            </span>
                          </div>
                        </div>

                        <div className="contextIdentityCard">
                          <article>
                            <span>Empresa</span>
                            <strong>{orgSetupOrganization.name}</strong>
                          </article>
                          <article>
                            <span>Tipo</span>
                            <strong>
                              {formatOrganizationKind(
                                orgSetupOrganization.kind,
                              )}
                            </strong>
                          </article>
                          <article>
                            <span>Perfil Git</span>
                            <strong>
                              {orgSetupOrganization.environmentName ?? "Padrao"}
                            </strong>
                          </article>
                        </div>

                        {orgSetupGaps.length > 0 ? (
                          <div className="todayStatusChips">
                            {orgSetupGaps.map((gap) => (
                              <Badge key={gap} variant="warning">
                                {gap}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <StatusAlert
                            status="ok"
                            title="Contexto basico pronto"
                          >
                            Empresa, perfil Git e repos podem ser usados no
                            fluxo de trabalho.
                          </StatusAlert>
                        )}

                        <div className="sessionForm compactForm">
                          <SectionTitle icon={Image}>
                            Logo da empresa
                          </SectionTitle>
                          <div className="orgLogoField">
                            <OrganizationAvatar
                              name={orgEditName || orgSetupOrganization.name}
                              kind={orgEditKind}
                              logoUrl={getOrganizationLogoUrl(
                                orgSetupOrganization.id,
                              )}
                              size="lg"
                            />
                            <div className="actionRow">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                  void handleUploadOrganizationLogo()
                                }
                                disabled={orgSetupBusy}
                              >
                                <Image className="h-4 w-4" aria-hidden />
                                Escolher imagem
                              </Button>
                              {orgSetupOrganization.logoPath ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() =>
                                    void handleRemoveOrganizationLogo()
                                  }
                                  disabled={orgSetupBusy}
                                >
                                  Remover logo
                                </Button>
                              ) : null}
                            </div>
                          </div>
                          <label>
                            Nome
                            <input
                              value={orgEditName}
                              onChange={(event) =>
                                setOrgEditName(event.target.value)
                              }
                            />
                          </label>
                          <label>
                            Tipo
                            <select
                              value={orgEditKind}
                              onChange={(event) =>
                                setOrgEditKind(event.target.value)
                              }
                            >
                              <option value="company">Empresa</option>
                              <option value="personal">Pessoal</option>
                              <option value="community">Comunidade</option>
                            </select>
                          </label>
                          <div className="actionRow">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => void handleUpdateOrganization()}
                              disabled={orgSetupBusy || !orgEditName.trim()}
                            >
                              <Save className="h-4 w-4" aria-hidden />
                              Salvar empresa
                            </Button>
                          </div>
                        </div>

                        <div className="orgDangerZone sessionForm compactForm">
                          <SectionTitle icon={Trash2}>
                            Zona de perigo
                          </SectionTitle>
                          <p className="muted">
                            Exclui esta empresa e tudo vinculado: projetos,
                            repositorios, tarefas, integracoes e historico.
                          </p>
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => void handleDeleteOrganization()}
                            disabled={orgSetupBusy}
                          >
                            Excluir empresa
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {orgDetailTab === "projects" ? (
                      <div className="orgDetailSection">
                        <div className="sessionForm compactForm">
                          <label>
                            Nome do projeto
                            <input
                              value={newOrgProjectName}
                              onChange={(event) =>
                                setNewOrgProjectName(event.target.value)
                              }
                              placeholder="IAM Platform"
                            />
                          </label>
                          <label>
                            Descricao (opcional)
                            <Textarea
                              value={newOrgProjectDescription}
                              onChange={(event) =>
                                setNewOrgProjectDescription(event.target.value)
                              }
                            />
                          </label>
                          <div className="actionRow">
                            <Button
                              type="button"
                              onClick={() => void handleCreateOrgProject()}
                              disabled={
                                orgSetupBusy || !newOrgProjectName.trim()
                              }
                            >
                              Novo projeto
                            </Button>
                          </div>
                        </div>

                        <ul className="historyList">
                          {orgSetupProjects.map((project) => (
                            <li key={project.id}>
                              <div>
                                <strong>{project.name}</strong>
                                <span>
                                  {project.description?.trim() ||
                                    "Sem descricao"}
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="destructive"
                                onClick={() =>
                                  void handleDeleteOrgProject(project)
                                }
                                disabled={orgSetupBusy}
                              >
                                Excluir
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {orgDetailTab === "repos" ? (
                      <div className="orgDetailSection">
                        <div className="sessionForm compactForm">
                          <label>
                            Projeto (opcional)
                            <select
                              value={orgLinkProjectId}
                              onChange={(event) =>
                                setOrgLinkProjectId(event.target.value)
                              }
                            >
                              <option value="">Sem projeto</option>
                              {orgSetupProjects.map((project) => (
                                <option key={project.id} value={project.id}>
                                  {project.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <LocalPathField
                            path={orgLinkRepoPath}
                            inspecting={orgLinkInspecting}
                            onPathChange={(value) => {
                              setOrgLinkRepoPath(value);
                              setOrgLinkInspection(null);
                            }}
                            onBrowse={async () => {
                              const picked =
                                await pickLocalFolder(orgLinkRepoPath);
                              if (!picked) return;
                              setOrgLinkRepoPath(picked);
                              setOrgLinkInspection(null);
                            }}
                            onInspect={() =>
                              void inspectLocalProjectPath(orgLinkRepoPath, {
                                setInspection: setOrgLinkInspection,
                                setPath: setOrgLinkRepoPath,
                                setError: setOrgSetupError,
                                setInspecting: setOrgLinkInspecting,
                                onDetected: (inspection) => {
                                  if (
                                    !orgLinkRepoName.trim() &&
                                    inspection.suggestedName
                                  ) {
                                    setOrgLinkRepoName(
                                      inspection.suggestedName,
                                    );
                                  }
                                  if (
                                    !orgLinkRepoRemote.trim() &&
                                    inspection.remoteUrl
                                  ) {
                                    setOrgLinkRepoRemote(inspection.remoteUrl);
                                  }
                                },
                              })
                            }
                          />
                          <label>
                            Nome do repositorio
                            <input
                              value={orgLinkRepoName}
                              onChange={(event) =>
                                setOrgLinkRepoName(event.target.value)
                              }
                            />
                          </label>
                          <label>
                            Remoto (opcional)
                            <input
                              value={orgLinkRepoRemote}
                              onChange={(event) =>
                                setOrgLinkRepoRemote(event.target.value)
                              }
                            />
                          </label>
                          <div className="actionRow">
                            <Button
                              type="button"
                              onClick={() => void handleOrgLinkRepository()}
                              disabled={
                                orgSetupBusy ||
                                !orgLinkRepoName.trim() ||
                                !orgLinkRepoPath.trim() ||
                                !orgLinkInspection?.isGitRepo
                              }
                            >
                              Vincular repo
                            </Button>
                          </div>
                        </div>

                        <div className="sessionForm compactForm">
                          <label>
                            Reassociar repositorio
                            <select
                              value={reassignRepoId}
                              onChange={(event) =>
                                setReassignRepoId(event.target.value)
                              }
                            >
                              <option value="">Selecione</option>
                              {orgSetupRepositories.map((repository) => (
                                <option
                                  key={repository.id}
                                  value={repository.id}
                                >
                                  {repository.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Projeto
                            <select
                              value={reassignProjectId}
                              onChange={(event) =>
                                setReassignProjectId(event.target.value)
                              }
                            >
                              <option value="">Sem projeto</option>
                              {orgSetupProjects.map((project) => (
                                <option key={project.id} value={project.id}>
                                  {project.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="actionRow">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => void handleReassignRepository()}
                              disabled={orgSetupBusy || !reassignRepoId}
                            >
                              Reassociar
                            </Button>
                          </div>
                        </div>

                        <ul className="historyList orgRepoMapping">
                          {orgSetupRepositories.map((repository) => (
                            <li key={repository.id}>
                              <div>
                                <strong>{repository.name}</strong>
                                <span>
                                  {repository.projectName ?? "Sem projeto"} ·{" "}
                                  {repository.localPath ?? "Sem pasta local"}
                                </span>
                              </div>
                              <div className="actionRow">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() =>
                                    openGitContextForRepo(repository)
                                  }
                                >
                                  Ir para troca de contexto
                                </Button>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  onClick={() =>
                                    void handleDeleteRepository(repository)
                                  }
                                  disabled={orgSetupBusy}
                                >
                                  Excluir
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {orgDetailTab === "identity" ? (
                      <div className="orgDetailSection">
                        <div className="orgIdentityInfoCard">
                          <SectionTitle icon={Info}>
                            Como funciona o contexto Git
                          </SectionTitle>
                          <ul className="orgIdentityInfoList">
                            <li>
                              <strong>Salvar identidade</strong> grava o perfil
                              da empresa no WCP (alias SSH, user.name, email).
                              Nao altera o repo local.
                            </li>
                            <li>
                              <strong>Aplicar identidade</strong> grava{" "}
                              <code>user.name</code> e <code>user.email</code>{" "}
                              no repo — autor dos commits. Nao muda o remoto
                              SSH.
                            </li>
                            <li>
                              <strong>Corrigir remoto</strong> altera{" "}
                              <code>remote.origin.url</code> para usar o alias
                              SSH do perfil (ex.:{" "}
                              <code>git@github_gok:org/repo.git</code>). Define
                              qual chave/conta autentica no push.
                            </li>
                            <li>
                              <strong>Aplicar contexto completo</strong> faz
                              identidade + remoto num passo. Autenticacao SSH e
                              autor do commit sao camadas diferentes.
                            </li>
                          </ul>
                        </div>

                        <div className="sessionForm compactForm orgIdentityImportPanel">
                          <SectionTitle icon={ScanSearch}>
                            Importar do repositorio
                          </SectionTitle>
                          <p className="muted">
                            Preenche o perfil Git a partir de um repo vinculado.
                            Revise os campos e clique em Salvar identidade.
                          </p>

                          {orgSetupRepositories.filter((repository) =>
                            repository.localPath?.trim(),
                          ).length === 0 ? (
                            <StatusAlert
                              status="warning"
                              title="Nenhum repo inspecionavel"
                            >
                              Vincule um repositorio com pasta local na aba
                              Repos antes de importar a identidade.
                            </StatusAlert>
                          ) : (
                            <>
                              {orgSetupGaps.length > 0 &&
                              !orgIdentityImportPreview ? (
                                <StatusAlert
                                  status="warning"
                                  title="Identidade incompleta"
                                >
                                  Importe automaticamente de um repo vinculado
                                  para preencher user.name, host e alias SSH.
                                </StatusAlert>
                              ) : null}

                              <label>
                                Repositorio
                                <select
                                  value={orgIdentityImportRepoId ?? ""}
                                  onChange={(event) => {
                                    setOrgIdentityImportRepoId(
                                      event.target.value || null,
                                    );
                                    setOrgIdentityImportPreview(null);
                                  }}
                                >
                                  {orgSetupRepositories
                                    .filter((repository) =>
                                      repository.localPath?.trim(),
                                    )
                                    .map((repository) => (
                                      <option
                                        key={repository.id}
                                        value={repository.id}
                                      >
                                        {repository.name}
                                        {repository.localPath
                                          ? ` · ${repository.localPath}`
                                          : ""}
                                      </option>
                                    ))}
                                </select>
                              </label>

                              <div className="actionRow">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() =>
                                    void handleImportOrganizationIdentity()
                                  }
                                  disabled={
                                    orgSetupBusy || !orgIdentityImportRepoId
                                  }
                                >
                                  <ScanSearch className="h-4 w-4" aria-hidden />
                                  Importar identidade
                                </Button>
                              </div>

                              {orgIdentityImportPreview ? (
                                <StatusAlert
                                  status="ok"
                                  title={`Importado de ${orgIdentityImportPreview.repositoryName}`}
                                >
                                  <ul className="identityImportSources">
                                    {orgIdentityImportPreview.sources.map(
                                      (source) => (
                                        <li key={source}>{source}</li>
                                      ),
                                    )}
                                  </ul>
                                  <p className="identityImportHint">
                                    Campos preenchidos abaixo. Clique em{" "}
                                    <strong>Salvar identidade</strong> para
                                    persistir.
                                  </p>
                                </StatusAlert>
                              ) : null}
                            </>
                          )}
                        </div>

                        <div className="orgIdentityGrid sessionForm compactForm">
                          <label>
                            Provider type
                            <select
                              value={orgEnvProviderType}
                              onChange={(event) => {
                                markOrgEnvFormDirty();
                                setOrgEnvProviderType(event.target.value);
                              }}
                            >
                              <option value="">Selecione</option>
                              <option value="github">GitHub</option>
                              <option value="gitlab">GitLab</option>
                              <option value="bitbucket">Bitbucket</option>
                              <option value="gitea">Gitea</option>
                              <option value="azure">Azure</option>
                              <option value="other">Outro</option>
                            </select>
                          </label>
                          <label>
                            Provider host
                            <input
                              value={orgEnvProviderHost}
                              onChange={(event) => {
                                markOrgEnvFormDirty();
                                setOrgEnvProviderHost(event.target.value);
                              }}
                            />
                          </label>
                          <label>
                            Alias SSH
                            {orgIdentitySshInputMode === "selector" ? (
                              <div className="orgIdentitySshSelectorRow">
                                <select
                                  value={orgIdentitySelectedSshHost}
                                  onChange={(event) => {
                                    const entry = sshConfigHosts.find(
                                      (host) =>
                                        host.hostAlias === event.target.value,
                                    );
                                    if (entry) {
                                      applySshConfigHostEntry(entry);
                                    }
                                  }}
                                  disabled={
                                    sshConfigHostsLoading ||
                                    sshConfigHosts.length === 0
                                  }
                                >
                                  <option value="">
                                    {sshConfigHostsLoading
                                      ? "Carregando ~/.ssh/config..."
                                      : "Selecione um host SSH"}
                                  </option>
                                  {Array.from(
                                    groupSshConfigHostsBySection(
                                      sshConfigHosts,
                                    ),
                                  ).map(([sectionLabel, hosts]) => (
                                    <optgroup
                                      key={sectionLabel}
                                      label={sectionLabel}
                                    >
                                      {hosts.map((entry) => (
                                        <option
                                          key={entry.hostAlias}
                                          value={entry.hostAlias}
                                        >
                                          {formatSshConfigHostOptionLabel(
                                            entry,
                                          )}
                                        </option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </select>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() =>
                                    setOrgIdentitySshInputMode("manual")
                                  }
                                >
                                  Digitar manualmente
                                </Button>
                              </div>
                            ) : (
                              <div className="orgIdentitySshSelectorRow">
                                <input
                                  value={orgEnvSshHostAlias}
                                  onChange={(event) => {
                                    markOrgEnvFormDirty();
                                    setOrgEnvSshHostAlias(event.target.value);
                                    setOrgIdentitySelectedSshHost("");
                                  }}
                                  placeholder="github_gok"
                                />
                                {sshConfigHosts.length > 0 ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                      setOrgIdentitySshInputMode("selector");
                                      const match = sshConfigHosts.find(
                                        (entry) =>
                                          entry.hostAlias ===
                                          orgEnvSshHostAlias.trim(),
                                      );
                                      if (match) {
                                        setOrgIdentitySelectedSshHost(
                                          match.hostAlias,
                                        );
                                      }
                                    }}
                                  >
                                    Usar seletor SSH
                                  </Button>
                                ) : null}
                              </div>
                            )}
                            {sshConfigHosts.length === 0 &&
                            !sshConfigHostsLoading ? (
                              <span className="muted fieldHint">
                                Nenhum host encontrado em{" "}
                                <code>~/.ssh/config</code>. Use comentarios{" "}
                                <code># GitHub gok</code> acima de cada bloco{" "}
                                <code>Host</code> para rotular o seletor.
                              </span>
                            ) : (
                              <span className="muted fieldHint">
                                Host do <code>~/.ssh/config</code> usado no
                                remoto (ex.{" "}
                                <code>git@github_gok:org/repo.git</code>). O
                                provider host acima continua sendo o{" "}
                                <code>HostName</code> (ex.{" "}
                                <code>github.com</code>
                                ).
                              </span>
                            )}
                          </label>
                          <label>
                            Git user.name
                            <input
                              value={orgEnvGitUserName}
                              onChange={(event) => {
                                markOrgEnvFormDirty();
                                setOrgEnvGitUserName(event.target.value);
                              }}
                            />
                          </label>
                          <label>
                            Git user.email
                            <input
                              value={orgEnvGitUserEmail}
                              onChange={(event) => {
                                markOrgEnvFormDirty();
                                setOrgEnvGitUserEmail(event.target.value);
                              }}
                            />
                          </label>
                          <label>
                            Padrao de branch
                            <input
                              value={orgEnvBranchPattern}
                              onChange={(event) => {
                                markOrgEnvFormDirty();
                                setOrgEnvBranchPattern(event.target.value);
                              }}
                              placeholder="feature/*"
                            />
                          </label>
                          <label>
                            Convencao de PR
                            <input
                              value={orgEnvPrConvention}
                              onChange={(event) => {
                                markOrgEnvFormDirty();
                                setOrgEnvPrConvention(event.target.value);
                              }}
                            />
                          </label>
                          <label>
                            Convencao de commit
                            <input
                              value={orgEnvCommitConvention}
                              onChange={(event) => {
                                markOrgEnvFormDirty();
                                setOrgEnvCommitConvention(event.target.value);
                              }}
                            />
                          </label>
                        </div>

                        <div className="sessionForm compactForm">
                          <SectionTitle icon={Link2}>Links uteis</SectionTitle>
                          {orgUsefulLinks.map((link, index) => (
                            <div key={index} className="historyFilterRow">
                              <label>
                                Rotulo
                                <input
                                  value={link.label}
                                  onChange={(event) => {
                                    markOrgEnvFormDirty();
                                    const next = [...orgUsefulLinks];
                                    next[index] = {
                                      ...next[index],
                                      label: event.target.value,
                                    };
                                    setOrgUsefulLinks(next);
                                  }}
                                />
                              </label>
                              <label>
                                URL
                                <input
                                  value={link.url}
                                  onChange={(event) => {
                                    markOrgEnvFormDirty();
                                    const next = [...orgUsefulLinks];
                                    next[index] = {
                                      ...next[index],
                                      url: event.target.value,
                                    };
                                    setOrgUsefulLinks(next);
                                  }}
                                />
                              </label>
                            </div>
                          ))}
                          <div className="actionRow">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                markOrgEnvFormDirty();
                                setOrgUsefulLinks((current) => [
                                  ...current,
                                  { label: "", url: "" },
                                ]);
                              }}
                            >
                              Adicionar link
                            </Button>
                            <Button
                              type="button"
                              onClick={() =>
                                void handleSaveOrganizationEnvironment()
                              }
                              disabled={orgSetupBusy}
                            >
                              <Save className="h-4 w-4" aria-hidden />
                              Salvar identidade
                            </Button>
                          </div>
                        </div>

                        <div className="orgRepoMapping">
                          <p className="backlogSidebarTitle">
                            Mapeamento por repositorio
                          </p>
                          <label>
                            Repositorio
                            <select
                              value={orgIdentityRepoId ?? ""}
                              onChange={(event) => {
                                setOrgIdentityRepoId(
                                  event.target.value || null,
                                );
                                setOrgIdentityGuardrail(null);
                                setOrgIdentityResult(null);
                              }}
                            >
                              <option value="">Selecione</option>
                              {orgSetupRepositories.map((repository) => (
                                <option
                                  key={repository.id}
                                  value={repository.id}
                                >
                                  {repository.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          {orgIdentityRemoteFixPreview ? (
                            <StatusAlert
                              status="warning"
                              title="Remoto SSH divergente do perfil"
                            >
                              O <code>origin</code> usa{" "}
                              <code>
                                {parseSshRemoteHostAlias(
                                  orgIdentityRemoteUrl ?? "",
                                ) ?? "?"}
                              </code>
                              , mas o perfil espera{" "}
                              <code>{orgIdentitySshAlias}</code>. Ao corrigir:{" "}
                              <code>{orgIdentityRemoteFixPreview}</code>
                            </StatusAlert>
                          ) : null}
                          <div className="actionRow">
                            <Button
                              type="button"
                              onClick={() =>
                                void handleApplyFullRepositoryContext()
                              }
                              disabled={
                                orgIdentityBusy ||
                                !orgIdentityRepoId ||
                                !orgIdentitySshAlias
                              }
                            >
                              <ArrowRightLeft className="h-4 w-4" aria-hidden />
                              Aplicar contexto completo
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => void handleApplyOrgIdentity()}
                              disabled={orgIdentityBusy || !orgIdentityRepoId}
                            >
                              Aplicar identidade
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => void handleFixRepositoryRemote()}
                              disabled={
                                orgIdentityBusy ||
                                !orgIdentityRepoId ||
                                !orgIdentityRemoteFixPreview
                              }
                            >
                              <GitBranch className="h-4 w-4" aria-hidden />
                              Corrigir remoto
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => void handleValidateOrgIdentity()}
                              disabled={orgIdentityBusy || !orgIdentityRepoId}
                            >
                              Validar contexto
                            </Button>
                          </div>
                          {orgIdentityResult ? (
                            <p className="resultText">{orgIdentityResult}</p>
                          ) : null}
                          {orgIdentityGuardrail?.validation?.checks.map(
                            (check) => (
                              <StatusAlert
                                key={check.key}
                                status={
                                  check.status === "ok" ? "ok" : "warning"
                                }
                                title={check.message}
                              >
                                {formatValidationCheckDetail(check)}
                              </StatusAlert>
                            ),
                          )}
                        </div>
                      </div>
                    ) : null}

                    {orgDetailTab === "integrations" ? (
                      <div className="orgDetailSection orgIntegrationsPanel">
                        <div className="orgIdentityInfoCard">
                          <SectionTitle icon={Info}>
                            Assistente de integracao
                          </SectionTitle>
                          <p className="muted">
                            Passo{" "}
                            {integrationWizardStep === "choose"
                              ? 1
                              : integrationWizardStep === "test"
                                ? 2
                                : integrationWizardStep === "save"
                                  ? 3
                                  : integrationWizardStep === "filters"
                                    ? 4
                                    : integrationWizardStep === "sync"
                                      ? 5
                                      : 6}{" "}
                            de 6
                          </p>
                          <div className="actionRow">
                            <Button
                              type="button"
                              variant={
                                integrationWizardStep === "choose"
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              onClick={() => setIntegrationWizardStep("choose")}
                            >
                              1. Provider
                            </Button>
                            <Button
                              type="button"
                              variant={
                                integrationWizardStep === "test"
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              onClick={() => setIntegrationWizardStep("test")}
                            >
                              2. Testar
                            </Button>
                            <Button
                              type="button"
                              variant={
                                integrationWizardStep === "save"
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              onClick={() => setIntegrationWizardStep("save")}
                            >
                              3. Salvar
                            </Button>
                            <Button
                              type="button"
                              variant={
                                integrationWizardStep === "filters"
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              onClick={() =>
                                setIntegrationWizardStep("filters")
                              }
                            >
                              4. Filtros
                            </Button>
                            <Button
                              type="button"
                              variant={
                                integrationWizardStep === "sync"
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              onClick={() => setIntegrationWizardStep("sync")}
                            >
                              5. Sync
                            </Button>
                            <Button
                              type="button"
                              variant={
                                integrationWizardStep === "review"
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              onClick={() => setIntegrationWizardStep("review")}
                            >
                              6. Revisar
                            </Button>
                          </div>
                          {integrationWizardStep === "choose" ? (
                            <div className="actionRow">
                              <Button
                                type="button"
                                variant={
                                  integrationWizardProvider === "jira"
                                    ? "default"
                                    : "outline"
                                }
                                onClick={() =>
                                  setIntegrationWizardProvider("jira")
                                }
                              >
                                Jira
                              </Button>
                              <Button
                                type="button"
                                variant={
                                  integrationWizardProvider === "clickup"
                                    ? "default"
                                    : "outline"
                                }
                                onClick={() =>
                                  setIntegrationWizardProvider("clickup")
                                }
                              >
                                ClickUp
                              </Button>
                            </div>
                          ) : null}
                          {integrationWizardStep === "filters" ? (
                            <div className="sessionForm compactForm">
                              <label className="backlogToggleArchived">
                                <input
                                  type="checkbox"
                                  checked={
                                    (integrationWizardProvider === "clickup"
                                      ? clickUpSyncFilter
                                      : jiraSyncFilter
                                    ).assigneeOnly
                                  }
                                  onChange={(event) => {
                                    const checked = event.target.checked;
                                    if (
                                      integrationWizardProvider === "clickup"
                                    ) {
                                      setClickUpSyncFilter((current) => ({
                                        ...current,
                                        assigneeOnly: checked,
                                      }));
                                    } else {
                                      setJiraSyncFilter((current) => ({
                                        ...current,
                                        assigneeOnly: checked,
                                      }));
                                    }
                                  }}
                                />
                                Apenas tarefas atribuidas a mim
                              </label>
                              <label className="backlogToggleArchived">
                                <input
                                  type="checkbox"
                                  checked={
                                    (integrationWizardProvider === "clickup"
                                      ? clickUpSyncFilter
                                      : jiraSyncFilter
                                    ).focusCurrentWork
                                  }
                                  onChange={(event) => {
                                    const checked = event.target.checked;
                                    if (
                                      integrationWizardProvider === "clickup"
                                    ) {
                                      setClickUpSyncFilter((current) => ({
                                        ...current,
                                        focusCurrentWork: checked,
                                      }));
                                    } else {
                                      setJiraSyncFilter((current) => ({
                                        ...current,
                                        focusCurrentWork: checked,
                                      }));
                                    }
                                  }}
                                />
                                Focar no trabalho atual (sprint aberta +
                                atividade recente)
                              </label>
                              {(integrationWizardProvider === "clickup"
                                ? clickUpSyncFilter
                                : jiraSyncFilter
                              ).focusCurrentWork ? (
                                <label>
                                  Atividade nos ultimos (dias)
                                  <input
                                    type="number"
                                    min={1}
                                    max={365}
                                    value={
                                      (integrationWizardProvider === "clickup"
                                        ? clickUpSyncFilter
                                        : jiraSyncFilter
                                      ).updatedWithinDays
                                    }
                                    onChange={(event) => {
                                      const days =
                                        Number(event.target.value) || 21;
                                      if (
                                        integrationWizardProvider === "clickup"
                                      ) {
                                        setClickUpSyncFilter((current) => ({
                                          ...current,
                                          updatedWithinDays: days,
                                        }));
                                      } else {
                                        setJiraSyncFilter((current) => ({
                                          ...current,
                                          updatedWithinDays: days,
                                        }));
                                      }
                                    }}
                                  />
                                </label>
                              ) : null}
                              <label className="backlogToggleArchived">
                                <input
                                  type="checkbox"
                                  checked={
                                    (integrationWizardProvider === "clickup"
                                      ? clickUpSyncFilter
                                      : jiraSyncFilter
                                    ).includeClosed
                                  }
                                  onChange={(event) => {
                                    const checked = event.target.checked;
                                    if (
                                      integrationWizardProvider === "clickup"
                                    ) {
                                      setClickUpSyncFilter((current) => ({
                                        ...current,
                                        includeClosed: checked,
                                      }));
                                    } else {
                                      setJiraSyncFilter((current) => ({
                                        ...current,
                                        includeClosed: checked,
                                      }));
                                    }
                                  }}
                                />
                                Incluir fechadas
                              </label>
                              {integrationWizardProvider === "jira" ? (
                                <label>
                                  JQL customizado (opcional)
                                  <input
                                    value={jiraSyncFilter.jql}
                                    onChange={(event) =>
                                      setJiraSyncFilter((current) => ({
                                        ...current,
                                        jql: event.target.value,
                                      }))
                                    }
                                    placeholder="Deixe vazio para usar o filtro padrao"
                                  />
                                </label>
                              ) : null}
                            </div>
                          ) : null}
                          {integrationWizardStep === "sync" ? (
                            <div className="actionRow">
                              <Button
                                type="button"
                                disabled={integrationBusy}
                                onClick={() =>
                                  void handleSyncPmTasks(
                                    integrationWizardProvider ?? undefined,
                                  )
                                }
                              >
                                Executar primeiro sync
                              </Button>
                            </div>
                          ) : null}
                          {integrationWizardStep === "review" ? (
                            <div className="actionRow">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setBacklogSourceFilter("imported");
                                  if (orgSetupSelectedId) {
                                    setBacklogOrgFilter(orgSetupSelectedId);
                                  }
                                  setActiveView("backlog");
                                }}
                              >
                                Ver tarefas importadas
                              </Button>
                            </div>
                          ) : null}
                        </div>

                        <div className="orgIdentityInfoCard">
                          <SectionTitle icon={Info}>
                            Mapeamento Jira project → projeto WCP
                          </SectionTitle>
                          <div className="sessionForm compactForm">
                            <label>
                              Projeto Jira
                              <select
                                value={pmMappingDraft.externalProjectKey}
                                onChange={(event) =>
                                  setPmMappingDraft((current) => ({
                                    ...current,
                                    externalProjectKey: event.target.value,
                                  }))
                                }
                              >
                                <option value="">Selecione</option>
                                {pmExternalProjects.map((projectKey) => (
                                  <option key={projectKey} value={projectKey}>
                                    {projectKey}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Projeto WCP
                              <select
                                value={pmMappingDraft.projectId}
                                onChange={(event) =>
                                  setPmMappingDraft((current) => ({
                                    ...current,
                                    projectId: event.target.value,
                                  }))
                                }
                              >
                                <option value="">Selecione</option>
                                {projects
                                  .filter(
                                    (project) =>
                                      project.organizationId ===
                                      orgSetupSelectedId,
                                  )
                                  .map((project) => (
                                    <option key={project.id} value={project.id}>
                                      {project.name}
                                    </option>
                                  ))}
                              </select>
                            </label>
                            <label>
                              Repo padrao (opcional)
                              <select
                                value={pmMappingDraft.defaultRepositoryId}
                                onChange={(event) =>
                                  setPmMappingDraft((current) => ({
                                    ...current,
                                    defaultRepositoryId: event.target.value,
                                  }))
                                }
                              >
                                <option value="">Nenhum</option>
                                {repositories
                                  .filter(
                                    (repo) =>
                                      repo.organizationId ===
                                      orgSetupSelectedId,
                                  )
                                  .map((repo) => (
                                    <option key={repo.id} value={repo.id}>
                                      {repo.name}
                                    </option>
                                  ))}
                              </select>
                            </label>
                            <Button
                              type="button"
                              disabled={integrationBusy}
                              onClick={() => void handleSavePmProjectMapping()}
                            >
                              Salvar mapeamento
                            </Button>
                          </div>
                          {pmProjectMappings.length > 0 ? (
                            <ul className="historyList">
                              {pmProjectMappings.map((mapping) => (
                                <li key={mapping.id}>
                                  <strong>{mapping.externalProjectKey}</strong>
                                  <span>
                                    → {mapping.projectName ?? mapping.projectId}
                                    {mapping.defaultRepositoryName
                                      ? ` · repo ${mapping.defaultRepositoryName}`
                                      : ""}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>

                        <div className="orgIdentityInfoCard">
                          <SectionTitle icon={Info}>
                            Integracoes desta empresa
                          </SectionTitle>
                          <p className="muted">
                            Configurando integracoes para{" "}
                            <strong>{orgSetupOrganization?.name}</strong>. Cada
                            empresa tem conexoes Jira e ClickUp independentes —
                            trocar de empresa nao compartilha tokens nem sync
                            entre elas.
                          </p>
                          <ul className="orgIdentityInfoList">
                            <li>
                              Tarefas atribuidas a voce sao espelhadas no
                              backlog WCP como <strong>importadas</strong>{" "}
                              (somente leitura na v1).
                            </li>
                            <li>
                              Prazos usam o campo <code>due</code> da ferramenta
                              externa (<code>scheduled_for</code> no WCP).
                            </li>
                            <li>
                              O sync nao altera repositorios Git nem identidade.
                            </li>
                            <li>
                              No sync, o status externo prevalece sobre edicoes
                              locais em tarefas importadas.
                            </li>
                          </ul>
                        </div>

                        {integrationMessage ? (
                          <p className="resultText">{integrationMessage}</p>
                        ) : null}

                        <div className="sessionForm compactForm orgIntegrationCard">
                          <SectionTitle icon={Plug}>Jira Cloud</SectionTitle>
                          {getPmConnection("jira")?.hasCredentials ? (
                            <Badge variant="success">
                              Conectado nesta empresa
                            </Badge>
                          ) : getPmConnection("jira") ? (
                            <Badge variant="warning">
                              Token pendente — salve novamente
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              Nao conectado nesta empresa
                            </Badge>
                          )}
                          <p className="muted">
                            Email + API token da Atlassian.{" "}
                            <a
                              href="https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/"
                              target="_blank"
                              rel="noreferrer"
                            >
                              Como gerar token
                            </a>
                          </p>
                          {getPmConnection("jira")?.lastSyncAt ? (
                            <p className="muted">
                              Ultima sync:{" "}
                              {formatDateTime(
                                getPmConnection("jira")?.lastSyncAt,
                              )}
                              {getPmConnection("jira")?.lastSyncError
                                ? ` · Erro: ${getPmConnection("jira")?.lastSyncError}`
                                : ""}
                            </p>
                          ) : null}
                          <label>
                            Site URL
                            <input
                              value={jiraSiteUrl}
                              onChange={(event) =>
                                setJiraSiteUrl(event.target.value)
                              }
                              placeholder="https://sua-empresa.atlassian.net"
                            />
                          </label>
                          <label>
                            Email
                            <input
                              type="email"
                              value={jiraEmail}
                              onChange={(event) =>
                                setJiraEmail(event.target.value)
                              }
                              placeholder="voce@empresa.com"
                            />
                          </label>
                          <label>
                            API token
                            <input
                              type="password"
                              value={jiraApiToken}
                              onChange={(event) =>
                                setJiraApiToken(event.target.value)
                              }
                              placeholder={
                                getPmConnection("jira")?.hasCredentials
                                  ? "Deixe vazio no teste para usar salvo"
                                  : "Cole o token"
                              }
                            />
                          </label>
                          <div className="orgIntegrationFilterBlock">
                            <p className="muted orgIntegrationFilterTitle">
                              Filtros de sincronizacao
                            </p>
                            <label className="backlogToggleArchived">
                              <input
                                type="checkbox"
                                checked={jiraSyncFilter.focusCurrentWork}
                                onChange={(event) =>
                                  setJiraSyncFilter((current) => ({
                                    ...current,
                                    focusCurrentWork: event.target.checked,
                                  }))
                                }
                              />
                              Sprint aberta + atividade recente
                            </label>
                            {jiraSyncFilter.focusCurrentWork ? (
                              <label>
                                Ultimos (dias)
                                <input
                                  type="number"
                                  min={1}
                                  max={365}
                                  value={jiraSyncFilter.updatedWithinDays}
                                  onChange={(event) =>
                                    setJiraSyncFilter((current) => ({
                                      ...current,
                                      updatedWithinDays:
                                        Number(event.target.value) || 21,
                                    }))
                                  }
                                />
                              </label>
                            ) : null}
                            <label className="backlogToggleArchived">
                              <input
                                type="checkbox"
                                checked={jiraSyncFilter.includeClosed}
                                onChange={(event) =>
                                  setJiraSyncFilter((current) => ({
                                    ...current,
                                    includeClosed: event.target.checked,
                                  }))
                                }
                              />
                              Incluir fechadas
                            </label>
                            <label>
                              JQL customizado (opcional)
                              <input
                                value={jiraSyncFilter.jql}
                                onChange={(event) =>
                                  setJiraSyncFilter((current) => ({
                                    ...current,
                                    jql: event.target.value,
                                  }))
                                }
                                placeholder="Deixe vazio para o filtro padrao"
                              />
                            </label>
                            <p className="muted orgIntegrationFilterPreview">
                              {describeJiraSyncFilter(jiraSyncFilter)}
                            </p>
                            {getPmConnection("jira") ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={integrationBusy}
                                onClick={() =>
                                  void handleSavePmSyncFilter("jira")
                                }
                              >
                                Salvar filtros
                              </Button>
                            ) : null}
                          </div>
                          <div className="actionRow">
                            <Button
                              type="button"
                              variant="outline"
                              disabled={integrationBusy}
                              onClick={() => void handleTestJiraConnection()}
                            >
                              Testar
                            </Button>
                            <Button
                              type="button"
                              disabled={integrationBusy}
                              onClick={() => void handleSaveJiraConnection()}
                            >
                              Salvar
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={
                                integrationBusy ||
                                !getPmConnection("jira")?.hasCredentials
                              }
                              onClick={() => void handleSyncPmTasks("jira")}
                            >
                              Sincronizar Jira
                            </Button>
                            {getPmConnection("jira") ? (
                              <Button
                                type="button"
                                variant="destructive"
                                disabled={integrationBusy}
                                onClick={() => handleDeletePmConnection("jira")}
                              >
                                Remover integracao
                              </Button>
                            ) : null}
                          </div>
                        </div>

                        <div className="sessionForm compactForm orgIntegrationCard">
                          <SectionTitle icon={Plug}>ClickUp</SectionTitle>
                          {getPmConnection("clickup")?.hasCredentials ? (
                            <Badge variant="success">
                              Conectado nesta empresa
                            </Badge>
                          ) : getPmConnection("clickup") ? (
                            <Badge variant="warning">
                              Token pendente — salve novamente
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              Nao conectado nesta empresa
                            </Badge>
                          )}
                          <p className="muted">
                            Personal API token.{" "}
                            <a
                              href="https://clickup.com/api/developer-portal/authentication/"
                              target="_blank"
                              rel="noreferrer"
                            >
                              Documentacao
                            </a>
                          </p>
                          {getPmConnection("clickup")?.lastSyncAt ? (
                            <p className="muted">
                              Ultima sync:{" "}
                              {formatDateTime(
                                getPmConnection("clickup")?.lastSyncAt,
                              )}
                              {getPmConnection("clickup")?.lastSyncError
                                ? ` · Erro: ${getPmConnection("clickup")?.lastSyncError}`
                                : ""}
                            </p>
                          ) : null}
                          <label>
                            API token
                            <input
                              type="password"
                              value={clickUpApiToken}
                              onChange={(event) =>
                                setClickUpApiToken(event.target.value)
                              }
                              placeholder={
                                getPmConnection("clickup")?.hasCredentials
                                  ? "Deixe vazio no teste para usar salvo"
                                  : "Cole o token e clique em Salvar"
                              }
                            />
                          </label>
                          {clickUpTeams.length > 0 ? (
                            <label>
                              Workspace (team)
                              <select
                                value={clickUpTeamId}
                                onChange={(event) =>
                                  setClickUpTeamId(event.target.value)
                                }
                              >
                                <option value="">Selecione</option>
                                {clickUpTeams.map((team) => (
                                  <option key={team.id} value={team.id}>
                                    {team.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : (
                            <p className="muted">
                              Clique em Testar para carregar os workspaces.
                            </p>
                          )}
                          <div className="orgIntegrationFilterBlock">
                            <p className="muted orgIntegrationFilterTitle">
                              Filtros de sincronizacao
                            </p>
                            <label className="backlogToggleArchived">
                              <input
                                type="checkbox"
                                checked={clickUpSyncFilter.focusCurrentWork}
                                onChange={(event) =>
                                  setClickUpSyncFilter((current) => ({
                                    ...current,
                                    focusCurrentWork: event.target.checked,
                                  }))
                                }
                              />
                              Apenas tarefas com atividade recente
                            </label>
                            {clickUpSyncFilter.focusCurrentWork ? (
                              <label>
                                Ultimos (dias)
                                <input
                                  type="number"
                                  min={1}
                                  max={365}
                                  value={clickUpSyncFilter.updatedWithinDays}
                                  onChange={(event) =>
                                    setClickUpSyncFilter((current) => ({
                                      ...current,
                                      updatedWithinDays:
                                        Number(event.target.value) || 21,
                                    }))
                                  }
                                />
                              </label>
                            ) : null}
                            <label className="backlogToggleArchived">
                              <input
                                type="checkbox"
                                checked={clickUpSyncFilter.includeClosed}
                                onChange={(event) =>
                                  setClickUpSyncFilter((current) => ({
                                    ...current,
                                    includeClosed: event.target.checked,
                                  }))
                                }
                              />
                              Incluir fechadas
                            </label>
                            {getPmConnection("clickup") ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={integrationBusy}
                                onClick={() =>
                                  void handleSavePmSyncFilter("clickup")
                                }
                              >
                                Salvar filtros
                              </Button>
                            ) : null}
                          </div>
                          <div className="actionRow">
                            <Button
                              type="button"
                              variant="outline"
                              disabled={integrationBusy}
                              onClick={() => void handleTestClickUpConnection()}
                            >
                              Testar
                            </Button>
                            <Button
                              type="button"
                              disabled={integrationBusy}
                              onClick={() => void handleSaveClickUpConnection()}
                            >
                              Salvar
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={
                                integrationBusy ||
                                !getPmConnection("clickup")?.hasCredentials
                              }
                              onClick={() => void handleSyncPmTasks("clickup")}
                            >
                              Sincronizar ClickUp
                            </Button>
                            {getPmConnection("clickup") ? (
                              <Button
                                type="button"
                                variant="destructive"
                                disabled={integrationBusy}
                                onClick={() =>
                                  handleDeletePmConnection("clickup")
                                }
                              >
                                Remover integracao
                              </Button>
                            ) : null}
                          </div>
                        </div>

                        <div className="actionRow">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={
                              integrationBusy ||
                              integrationConnections.length === 0
                            }
                            onClick={() => void handleSyncPmTasks()}
                          >
                            Sincronizar todas as integracoes
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <StatusAlert status="warning" title="Nenhuma empresa">
                    Crie a primeira empresa para organizar projetos e repos.
                  </StatusAlert>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {activeView === "repos" ? (
          <section className="panel repoPanel">
            <div className="repoHeader">
              <div className="panelHeading">
                <h2>Seus projetos</h2>
                <p className="muted">
                  Prepare o ambiente Git antes de comecar a codar.
                </p>
              </div>
              <div className="resultStack">
                {applyResult ? (
                  <p className="resultText">{applyResult}</p>
                ) : null}
                {hookResult ? <p className="resultText">{hookResult}</p> : null}
                {contextReady ? (
                  <Badge variant="success">Pronto para trabalhar</Badge>
                ) : null}
              </div>
            </div>

            <section className="contextSwitchPanel">
              <div className="panelHeading">
                <h3 className="subheading">Troca de contexto</h3>
                <p className="muted">
                  Siga os passos para evitar erro de identidade ou host errado.
                </p>
              </div>

              <ContextStepsBar
                steps={CONTEXT_STEPS}
                currentStep={contextStep}
                completedSteps={completedContextSteps}
                onStepClick={goToContextStep}
              />

              <p className="contextStepHint">
                {CONTEXT_STEP_HINTS[contextStep]}
              </p>

              {contextChainLabel && contextStep >= 1 && contextStep <= 3 ? (
                <div className="contextChainCard">
                  <SectionTitle icon={GitBranch}>
                    Cadeia de contexto
                  </SectionTitle>
                  {selectedOrganization ? (
                    <div className="contextChainHeader">
                      <OrganizationAvatar
                        name={selectedOrganization.name}
                        kind={selectedOrganization.kind}
                        logoUrl={getOrganizationLogoUrl(
                          selectedOrganization.id,
                        )}
                        size="sm"
                      />
                      <p className="dayBriefLine dayBriefLine-strong">
                        {contextChainLabel}
                      </p>
                    </div>
                  ) : (
                    <p className="dayBriefLine dayBriefLine-strong">
                      {contextChainLabel}
                    </p>
                  )}
                </div>
              ) : null}

              <div className="contextStepContent">
                {contextStep === 1 ? (
                  <>
                    <div className="historyFilterRow">
                      <label>
                        Empresa
                        <select
                          value={selectedOrganizationId}
                          onChange={(event) =>
                            handleOrganizationChange(event.target.value)
                          }
                        >
                          <option value="all">Selecione uma empresa</option>
                          {organizations.map((organization) => (
                            <option
                              key={organization.id}
                              value={organization.id}
                            >
                              {organization.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    {selectedOrganization ? (
                      <div className="contextIdentityCard">
                        <article className="contextIdentityHero">
                          <OrganizationAvatar
                            name={selectedOrganization.name}
                            kind={selectedOrganization.kind}
                            logoUrl={getOrganizationLogoUrl(
                              selectedOrganization.id,
                            )}
                            size="md"
                          />
                          <div>
                            <span>Empresa / ambiente</span>
                            <strong>
                              {selectedOrganization.name}
                              {selectedOrganization.environmentName
                                ? ` · ${selectedOrganization.environmentName}`
                                : ""}
                            </strong>
                          </div>
                        </article>
                        <article>
                          <span>Provider host</span>
                          <strong>
                            {selectedOrganization.providerHost ??
                              "Nao configurado"}
                          </strong>
                        </article>
                        <article>
                          <span>Git user.name</span>
                          <strong>
                            {selectedOrganization.gitUserName ??
                              "Nao configurado"}
                          </strong>
                        </article>
                        <article>
                          <span>Git user.email</span>
                          <strong>
                            {selectedOrganization.gitUserEmail ??
                              "Nao configurado"}
                          </strong>
                        </article>
                        <article>
                          <span>Alias SSH</span>
                          <strong>
                            {selectedOrganization.sshHostAlias ??
                              "Nao configurado"}
                          </strong>
                        </article>
                        <article>
                          <span>Padrao de branch</span>
                          <strong>
                            {selectedOrganization.branchPattern ??
                              "Nao configurado"}
                          </strong>
                        </article>
                      </div>
                    ) : organizations.length === 0 ? (
                      <StatusAlert
                        status="warning"
                        title="Nenhuma empresa cadastrada"
                      >
                        Cadastre uma empresa antes de preparar o contexto Git.
                        <div className="actionRow">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => switchActiveView("organizations")}
                          >
                            Cadastrar empresa
                          </Button>
                        </div>
                      </StatusAlert>
                    ) : (
                      <StatusAlert status="warning" title="Escolha a empresa">
                        Selecione acima qual contexto voce quer preparar.
                      </StatusAlert>
                    )}

                    <div className="actionRow">
                      <Button
                        type="button"
                        disabled={selectedOrganizationId === "all"}
                        onClick={() => setContextStep(2)}
                      >
                        Continuar para repositorio
                      </Button>
                    </div>
                  </>
                ) : null}

                {contextStep === 2 ? (
                  <>
                    <p className="muted contextOrgLine">
                      <OrganizationAvatar
                        name={selectedOrganization?.name ?? "Empresa"}
                        kind={selectedOrganization?.kind}
                        logoUrl={getOrganizationLogoUrl(
                          selectedOrganization?.id,
                        )}
                        size="sm"
                      />
                      <span>
                        Empresa:{" "}
                        <strong>
                          {selectedOrganization?.name ?? "Nao selecionada"}
                        </strong>
                      </span>
                    </p>

                    <div className="addProjectPanel">
                      <div className="panelHeading">
                        <h4 className="subheading">
                          Adicionar repositorio local
                        </h4>
                        <p className="muted">
                          Aponte para uma pasta Git real da sua maquina para
                          conseguir conferir o ambiente.
                        </p>
                      </div>

                      {!showAddProjectForm ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            resetAddProjectForm();
                            setShowAddProjectForm(true);
                          }}
                        >
                          Cadastrar pasta Git
                        </Button>
                      ) : (
                        <div className="sessionForm compactForm">
                          <LocalPathField
                            path={newProjectPath}
                            inspecting={newProjectInspecting}
                            onPathChange={(value) => {
                              setNewProjectPath(value);
                              setNewProjectInspection(null);
                              setNewProjectError(null);
                            }}
                            onBrowse={() => void browseNewProjectPath()}
                            onInspect={() => void inspectNewProjectPath()}
                          />
                          <label>
                            Projeto (opcional)
                            <select
                              value={newRepoProjectId}
                              onChange={(event) =>
                                setNewRepoProjectId(event.target.value)
                              }
                            >
                              <option value="">Sem projeto</option>
                              {projects
                                .filter(
                                  (project) =>
                                    project.organizationId ===
                                    selectedOrganizationId,
                                )
                                .map((project) => (
                                  <option key={project.id} value={project.id}>
                                    {project.name}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <label>
                            Nome do repositorio
                            <input
                              value={newProjectName}
                              onChange={(event) =>
                                setNewProjectName(event.target.value)
                              }
                              placeholder="auth-api"
                            />
                          </label>
                          <label>
                            Remoto (opcional)
                            <input
                              value={newProjectRemoteUrl}
                              onChange={(event) =>
                                setNewProjectRemoteUrl(event.target.value)
                              }
                              placeholder="git@host:org/repo.git"
                            />
                          </label>

                          {newProjectIdentityWarning ? (
                            <StatusAlert
                              status="warning"
                              title="Identidade local diferente"
                            >
                              {newProjectIdentityWarning}
                            </StatusAlert>
                          ) : null}

                          {newProjectInspection?.isGitRepo ? (
                            <StatusAlert
                              status="ok"
                              title="Repositorio Git detectado"
                            >
                              {newProjectInspection.remoteUrl ??
                                "Sem remote.origin.url configurado"}
                              {newProjectInspection.defaultBranch
                                ? ` · branch ${newProjectInspection.defaultBranch}`
                                : ""}
                            </StatusAlert>
                          ) : null}

                          {newProjectError ? (
                            <p className="errorText">{newProjectError}</p>
                          ) : null}

                          <div className="actionRow">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setShowAddProjectForm(false);
                                resetAddProjectForm();
                              }}
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="button"
                              onClick={() => void handleCreateProject()}
                              disabled={
                                newProjectSaving ||
                                !newProjectName.trim() ||
                                !newProjectPath.trim() ||
                                !newProjectInspection?.isGitRepo
                              }
                            >
                              {newProjectSaving
                                ? "Salvando..."
                                : "Salvar repositorio"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    <p className="contextSectionLabel">
                      Repositorios cadastrados
                    </p>
                    <div className="contextRepoPicker">
                      {contextOrganizationRepos.length > 0 ? (
                        contextOrganizationRepos.map((repository) => (
                          <SelectableListItem
                            key={repository.id}
                            active={selectedRepoId === repository.id}
                            onClick={() => handleSelectRepository(repository)}
                            title={repository.name}
                            subtitle={formatRepositoryContextLine(repository)}
                          >
                            {repository.providerHost ?? "Servico nao informado"}
                          </SelectableListItem>
                        ))
                      ) : (
                        <StatusAlert status="warning" title="Sem repositorios">
                          Nenhum repositorio cadastrado para esta empresa.
                        </StatusAlert>
                      )}
                    </div>

                    {selectedRepo ? (
                      <div className="addProjectPanel">
                        <div className="panelHeading">
                          <h4 className="subheading">
                            Pasta local do repositorio
                          </h4>
                          <p className="muted">
                            Ajuste o caminho se o repositorio mudou de pasta ou
                            ainda aponta para um seed de exemplo.
                          </p>
                        </div>

                        {!showEditProjectPathForm ? (
                          <>
                            <div className="contextIdentityCard">
                              <article>
                                <span>Repositorio selecionado</span>
                                <strong>{selectedRepo.name}</strong>
                              </article>
                              <article>
                                <span>Pasta local</span>
                                <strong>{selectedRepo.localPath ?? "-"}</strong>
                              </article>
                            </div>

                            {selectedRepoPathIssue ? (
                              <StatusAlert
                                status="warning"
                                title="Pasta indisponivel"
                              >
                                {selectedRepoPathIssue}
                              </StatusAlert>
                            ) : null}

                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                resetEditProjectPathForm(selectedRepo);
                                setShowEditProjectPathForm(true);
                              }}
                            >
                              Alterar pasta local
                            </Button>
                          </>
                        ) : (
                          <div className="sessionForm compactForm">
                            <LocalPathField
                              path={editProjectPath}
                              inspecting={editProjectInspecting}
                              onPathChange={(value) => {
                                setEditProjectPath(value);
                                setEditProjectInspection(null);
                                setEditProjectError(null);
                              }}
                              onBrowse={() => void browseEditProjectPath()}
                              onInspect={() => void inspectEditProjectPath()}
                            />
                            <label>
                              Remoto (opcional)
                              <input
                                value={editProjectRemoteUrl}
                                onChange={(event) =>
                                  setEditProjectRemoteUrl(event.target.value)
                                }
                                placeholder="git@host:org/repo.git"
                              />
                            </label>

                            {editProjectInspection?.isGitRepo ? (
                              <StatusAlert
                                status="ok"
                                title="Repositorio Git detectado"
                              >
                                {editProjectInspection.remoteUrl ??
                                  "Sem remote.origin.url configurado"}
                                {editProjectInspection.defaultBranch
                                  ? ` · branch ${editProjectInspection.defaultBranch}`
                                  : ""}
                              </StatusAlert>
                            ) : null}

                            {editProjectError ? (
                              <p className="errorText">{editProjectError}</p>
                            ) : null}

                            <div className="actionRow">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setShowEditProjectPathForm(false);
                                  resetEditProjectPathForm(selectedRepo);
                                }}
                              >
                                Cancelar
                              </Button>
                              <Button
                                type="button"
                                onClick={() => void handleUpdateProjectPath()}
                                disabled={
                                  editProjectSaving ||
                                  !editProjectPath.trim() ||
                                  !editProjectInspection?.isGitRepo
                                }
                              >
                                {editProjectSaving
                                  ? "Salvando..."
                                  : "Salvar pasta local"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}

                    <div className="actionRow">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setContextStep(1)}
                      >
                        Voltar
                      </Button>
                      <Button
                        type="button"
                        disabled={!selectedRepoId}
                        onClick={() => setContextStep(3)}
                      >
                        Continuar para conferir
                      </Button>
                    </div>
                  </>
                ) : null}

                {contextStep === 3 ? (
                  <>
                    <p className="muted">
                      Conferindo:{" "}
                      <strong>{selectedRepo?.name ?? "Nenhum projeto"}</strong>
                    </p>

                    {selectedRepoPathIssue ? (
                      <StatusAlert
                        status="warning"
                        title="Pasta local indisponivel"
                      >
                        {selectedRepoPathIssue}
                        {" — "}
                        Volte ao passo Projeto e cadastre uma pasta Git real, ou
                        escolha outro repositorio.
                      </StatusAlert>
                    ) : null}

                    {repoError ? (
                      <p className="errorText">{repoError}</p>
                    ) : null}

                    <ul className="contextChecklist">
                      {contextSwitchChecks.map((check) => (
                        <li
                          key={check.id}
                          className={`contextCheckItem contextCheckItem-${check.status}`}
                        >
                          <strong>{check.label}</strong>
                          <span>{check.message}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="actionRow">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setContextStep(2)}
                      >
                        Voltar
                      </Button>
                      <Button
                        type="button"
                        onClick={() => void refreshRepositoryContext(true)}
                        disabled={
                          refreshingRepo ||
                          !selectedRepo?.localPath ||
                          Boolean(selectedRepoPathIssue)
                        }
                      >
                        {refreshingRepo ? "Conferindo..." : "Conferir ambiente"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!selectedValidation}
                        onClick={() => setContextStep(4)}
                      >
                        Continuar
                      </Button>
                    </div>
                  </>
                ) : null}

                {contextStep === 4 ? (
                  <>
                    {selectedValidation ? (
                      <StatusAlert
                        status={selectedValidation.status}
                        title={formatValidationStatus(
                          selectedValidation.status,
                        )}
                      >
                        Resultado da conferencia local
                      </StatusAlert>
                    ) : (
                      <StatusAlert
                        status="warning"
                        title="Conferencia pendente"
                      >
                        Volte ao passo anterior e confira o ambiente.
                      </StatusAlert>
                    )}
                    <ul className="contextChecklist">
                      {selectedValidation?.checks.map((check) => (
                        <li
                          key={check.key}
                          className={`contextCheckItem contextCheckItem-${check.status}`}
                        >
                          <strong>{humanizeCheckKey(check.key)}</strong>
                          <span>{formatValidationCheckDetail(check)}</span>
                        </li>
                      )) ?? null}
                    </ul>
                    <div className="actionRow">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setContextStep(3)}
                      >
                        Voltar
                      </Button>
                      <Button
                        type="button"
                        onClick={() => void handleApplyIdentity()}
                        disabled={
                          applyingIdentity ||
                          preparingContext ||
                          !selectedRepo?.localPath
                        }
                      >
                        {applyingIdentity
                          ? "Aplicando..."
                          : "Ajustar identidade Git"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!selectedValidation}
                        onClick={() => setContextStep(5)}
                      >
                        Continuar
                      </Button>
                    </div>
                  </>
                ) : null}

                {contextStep === 5 ? (
                  <>
                    <StatusAlert
                      status={hookStatus?.managedByApp ? "ok" : "warning"}
                      title="Protecao antes do push"
                    >
                      {!hookStatus?.installed
                        ? "Nenhum hook pre-push instalado ainda."
                        : hookStatus.managedByApp
                          ? "Hook pre-push ativo e gerenciado pelo app."
                          : "Ha um hook pre-push manual neste projeto."}
                    </StatusAlert>
                    <div className="actionRow">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setContextStep(4)}
                      >
                        Voltar
                      </Button>
                      <Button
                        type="button"
                        onClick={() => void handleInstallPrePushHook()}
                        disabled={
                          installingHook ||
                          preparingContext ||
                          !selectedRepo?.localPath ||
                          hookStatus?.managedByApp
                        }
                      >
                        {installingHook
                          ? "Instalando..."
                          : hookStatus?.managedByApp
                            ? "Protecao ativa"
                            : "Instalar protecao"}
                      </Button>
                      {hookStatus?.managedByApp ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void handleRemovePrePushHook()}
                          disabled={removingHook || preparingContext}
                        >
                          {removingHook ? "Removendo..." : "Remover protecao"}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!hookStatus?.managedByApp}
                        onClick={() => setContextStep(6)}
                      >
                        Continuar
                      </Button>
                    </div>
                  </>
                ) : null}

                {contextStep === 6 ? (
                  <>
                    <StatusAlert status="ok" title="Contexto preparado">
                      <span className="contextReadySummary">
                        {selectedOrganization ? (
                          <OrganizationAvatar
                            name={selectedOrganization.name}
                            kind={selectedOrganization.kind}
                            logoUrl={getOrganizationLogoUrl(
                              selectedOrganization.id,
                            )}
                            size="sm"
                          />
                        ) : selectedRepo?.organizationId ? (
                          <OrganizationAvatar
                            name={
                              findOrganizationById(selectedRepo.organizationId)
                                ?.name ??
                              selectedRepo.organizationName ??
                              "Empresa"
                            }
                            kind={
                              findOrganizationById(selectedRepo.organizationId)
                                ?.kind
                            }
                            logoUrl={getOrganizationLogoUrl(
                              selectedRepo.organizationId,
                            )}
                            size="sm"
                          />
                        ) : null}
                        <span>
                          {selectedOrganization?.name ??
                            selectedRepo?.organizationName}
                          {" · "}
                          {selectedRepo?.name ?? "projeto"}
                        </span>
                      </span>
                    </StatusAlert>
                    <ul className="contextChecklist">
                      {contextSwitchChecks.map((check) => (
                        <li
                          key={`ready-${check.id}`}
                          className={`contextCheckItem contextCheckItem-${check.status}`}
                        >
                          <strong>{check.label}</strong>
                          <span>{check.message}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="actionRow">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setContextStep(5)}
                      >
                        Revisar protecao
                      </Button>
                      <Button
                        type="button"
                        onClick={() => void handlePrepareContext()}
                        disabled={
                          preparingContext ||
                          applyingIdentity ||
                          installingHook ||
                          refreshingRepo ||
                          !selectedRepo?.localPath
                        }
                      >
                        {preparingContext
                          ? "Preparando..."
                          : "Repreparar contexto"}
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>
            </section>

            <div className="repoLayout">
              {contextStep >= 2 ? (
                <>
                  <aside className="repoList">
                    <SectionTitle icon={FolderGit2}>
                      Repositorios por empresa
                    </SectionTitle>
                    {groupedRepositories.map((group) => (
                      <div key={group.organizationName} className="repoGroup">
                        <p className="repoGroupTitle">
                          <OrganizationAvatar
                            name={group.organizationName}
                            kind={
                              findOrganizationById(group.organizationId)?.kind
                            }
                            logoUrl={getOrganizationLogoUrl(
                              group.organizationId,
                            )}
                            size="sm"
                          />
                          <span>{group.organizationName}</span>
                        </p>
                        {group.repositories.map((repository) => (
                          <SelectableListItem
                            key={repository.id}
                            active={
                              selectedRepoId === repository.id &&
                              contextStep >= 2
                            }
                            onClick={() => handleSelectRepository(repository)}
                            title={repository.name}
                            subtitle={formatRepositoryContextLine(repository)}
                          >
                            {repository.providerHost ?? "Servico nao informado"}
                          </SelectableListItem>
                        ))}
                      </div>
                    ))}
                  </aside>

                  <div className="repoDetails">
                    {selectedRepo ? (
                      <>
                        <div className="repoDetailHeader">
                          <div className="panelHeading">
                            <h3 className="subheading">{selectedRepo.name}</h3>
                            <p className="muted">
                              {selectedRepo.organizationName ?? "Sem empresa"}
                              {selectedRepo.projectName
                                ? ` · ${selectedRepo.projectName}`
                                : ""}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              void handleDeleteRepository(selectedRepo)
                            }
                            disabled={orgSetupBusy || preparingContext}
                          >
                            Excluir repositorio
                          </Button>
                        </div>

                        <div className="repoMeta">
                          <article>
                            <span>Remoto</span>
                            <strong>{selectedRepo.remoteUrl ?? "-"}</strong>
                          </article>
                          <article>
                            <span>Pasta local</span>
                            <strong>{selectedRepo.localPath ?? "-"}</strong>
                          </article>
                          <article>
                            <span>Branch padrao</span>
                            <strong>{selectedRepo.defaultBranch ?? "-"}</strong>
                          </article>
                        </div>

                        {contextStep >= 6 ? (
                          <>
                            {repoLoading ? (
                              <StatusAlert
                                status="warning"
                                title="Conferindo..."
                              >
                                Validando o ambiente deste projeto.
                              </StatusAlert>
                            ) : selectedValidation ? (
                              <>
                                <StatusAlert
                                  status={selectedValidation.status}
                                  title={formatValidationStatus(
                                    selectedValidation.status,
                                  )}
                                >
                                  Conferencia da identidade local
                                </StatusAlert>
                                <ul className="checkList">
                                  {selectedValidation.checks.map((check) => (
                                    <li key={check.key}>
                                      <strong>
                                        {humanizeCheckKey(check.key)}
                                      </strong>
                                      <span>
                                        {formatValidationCheckDetail(check)}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </>
                            ) : (
                              <StatusAlert
                                status="warning"
                                title="Ainda sem conferencia"
                              >
                                Este projeto ainda nao tem dados Git suficientes
                                para validar.
                              </StatusAlert>
                            )}

                            <StatusAlert
                              status={
                                hookStatus?.installed && hookStatus.managedByApp
                                  ? "ok"
                                  : "warning"
                              }
                              title="Protecao antes do push"
                            >
                              <div className="grid gap-2">
                                <span>
                                  {!hookStatus?.installed
                                    ? "Nenhum hook pre-push instalado ainda."
                                    : hookStatus.managedByApp
                                      ? "Hook pre-push ativo e gerenciado pelo app."
                                      : "Ha um hook pre-push manual neste projeto."}
                                </span>
                                {hookStatus?.installed &&
                                !hookStatus.managedByApp ? (
                                  <code className="text-xs">
                                    O app nao altera hooks que voce instalou
                                    manualmente.
                                  </code>
                                ) : null}
                                {hookStatus?.hookPath ? (
                                  <code className="text-xs">
                                    {hookStatus.hookPath}
                                  </code>
                                ) : null}
                              </div>
                            </StatusAlert>

                            <div className="actionRow">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => refreshRepositoryContext(true)}
                                disabled={
                                  refreshingRepo || !selectedRepo.localPath
                                }
                              >
                                {refreshingRepo
                                  ? "Conferindo..."
                                  : "Conferir ambiente"}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleInstallPrePushHook}
                                disabled={
                                  installingHook ||
                                  removingHook ||
                                  refreshingRepo ||
                                  !selectedRepo.localPath
                                }
                              >
                                {installingHook
                                  ? "Instalando..."
                                  : hookStatus?.managedByApp
                                    ? "Reparar protecao"
                                    : "Instalar protecao"}
                              </Button>
                              {hookStatus?.managedByApp ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={handleRemovePrePushHook}
                                  disabled={
                                    removingHook ||
                                    installingHook ||
                                    refreshingRepo ||
                                    !selectedRepo.localPath
                                  }
                                >
                                  {removingHook
                                    ? "Removendo..."
                                    : "Remover protecao"}
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                onClick={handleApplyIdentity}
                                disabled={
                                  applyingIdentity ||
                                  removingHook ||
                                  refreshingRepo ||
                                  !selectedRepo.localPath
                                }
                              >
                                {applyingIdentity
                                  ? "Aplicando..."
                                  : "Ajustar identidade Git"}
                              </Button>
                            </div>

                            <h3 className="subheading">Checklist detalhado</h3>
                            <ul className="contextChecklist">
                              {contextSwitchChecks.map((check) => (
                                <li
                                  key={`detail-${check.id}`}
                                  className={`contextCheckItem contextCheckItem-${check.status}`}
                                >
                                  <strong>{check.label}</strong>
                                  <span>{check.message}</span>
                                </li>
                              ))}
                            </ul>

                            <h3 className="subheading">Anotacoes do projeto</h3>
                            <div className="sessionForm compactForm">
                              <label>
                                Titulo
                                <input
                                  value={repoNoteTitle}
                                  onChange={(event) =>
                                    setRepoNoteTitle(event.target.value)
                                  }
                                  placeholder="Padrao, comando util ou problema recorrente"
                                />
                              </label>
                              <label>
                                Conteudo
                                <Textarea
                                  value={repoNoteContent}
                                  onChange={(event) =>
                                    setRepoNoteContent(event.target.value)
                                  }
                                  placeholder="Ex.: rodar migrate antes do worker subir em dev"
                                />
                              </label>
                              <div className="actionRow">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={handleSaveRepositoryNote}
                                  disabled={contextBusy}
                                >
                                  Salvar anotacao
                                </Button>
                              </div>
                            </div>

                            <ul className="historyList">
                              {(repoMemory?.notes ?? []).map((note) => (
                                <li key={note.id}>
                                  <div>
                                    <strong>{note.title}</strong>
                                    <span>{note.noteType}</span>
                                    <code>{note.content}</code>
                                  </div>
                                </li>
                              ))}
                            </ul>

                            {repoError ? (
                              <p className="errorText">{repoError}</p>
                            ) : null}
                          </>
                        ) : (
                          <StatusAlert
                            status="warning"
                            title="Detalhes completos no passo Pronto"
                          >
                            Siga os passos acima para conferir e preparar o
                            ambiente.
                          </StatusAlert>
                        )}
                      </>
                    ) : (
                      <StatusAlert status="warning" title="Escolha um projeto">
                        Selecione um repositorio no passo Projeto ou na lista ao
                        lado.
                      </StatusAlert>
                    )}
                  </div>
                </>
              ) : (
                <div className="contextStepPlaceholder">
                  <strong>Passo 1 — Empresa</strong>
                  <span>
                    Escolha a empresa acima para ver os projetos e detalhes do
                    ambiente.
                  </span>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {activeView === "history" ? (
          <section className="panel historyPanel">
            <div className="historyFilters">
              <div className="historyFilterRow">
                <SearchField
                  type="search"
                  placeholder="Filtrar por texto no historico..."
                  value={historyTextQuery}
                  onChange={(event) => setHistoryTextQuery(event.target.value)}
                  aria-label="Busca textual no historico"
                />
              </div>
              <FilterTabs
                value={historyKindFilter}
                onValueChange={setHistoryKindFilter}
                aria-label="Filtrar historico por tipo"
                items={HISTORY_KIND_FILTERS.map((filter) => ({
                  id: filter.id,
                  label: `${filter.label} (${historyKindCounts[filter.id]})`,
                  icon: HISTORY_KIND_ICONS[filter.id],
                }))}
              />
              <div className="historyFilterRow">
                <label className="grid gap-2 text-sm text-muted-foreground">
                  <Label htmlFor="history-task-filter">Tarefa</Label>
                  <select
                    id="history-task-filter"
                    value={historyTaskFilter}
                    onChange={(event) =>
                      setHistoryTaskFilter(event.target.value)
                    }
                  >
                    <option value="all">Todas</option>
                    {historyTaskOptions.map(([id, title]) => (
                      <option key={id} value={id}>
                        {title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm text-muted-foreground">
                  <Label htmlFor="history-repo-filter">Projeto</Label>
                  <select
                    id="history-repo-filter"
                    value={historyRepoFilter}
                    onChange={(event) =>
                      setHistoryRepoFilter(event.target.value)
                    }
                  >
                    <option value="all">Todos</option>
                    {historyRepoOptions.map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm text-muted-foreground">
                  <Label htmlFor="history-org-filter">Empresa</Label>
                  <select
                    id="history-org-filter"
                    value={historyOrgFilter}
                    onChange={(event) =>
                      setHistoryOrgFilter(event.target.value)
                    }
                  >
                    <option value="all">Todas</option>
                    {historyOrgOptions.map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {historyLoading ? (
              <p className="historyEmpty">Carregando historico...</p>
            ) : historySearchBusy ? (
              <p className="historyEmpty">Buscando no historico...</p>
            ) : historyError ? (
              <p className="historyEmpty">{historyError}</p>
            ) : historyEvents.length === 0 && !historyTextQuery.trim() ? (
              <div className="historyEmpty">
                <p>Nenhum evento registrado ainda.</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveView("backlog")}
                >
                  Ir para tarefas
                </Button>
              </div>
            ) : filteredHistoryEvents.length === 0 ? (
              <p className="historyEmpty">
                {historyUsesDeepSearch
                  ? `Nenhum resultado para "${historyTextQuery.trim()}".`
                  : "Nenhum evento com esses filtros."}
              </p>
            ) : (
              <ul className="historyGroupedList">
                {groupedHistoryEvents.map((group) => (
                  <li key={group.dayKey} className="historyDayGroup">
                    <h3 className="historyDayHeading">{group.label}</h3>
                    <ul className="historyEventList">
                      {group.events.map((event) => (
                        <li key={`${event.kind}-${event.id}`}>
                          <HistoryEventButton
                            kind={event.kind}
                            onClick={() => handleContextEventClick(event)}
                            meta={`${normalizeContextEventLabel(event.kind)} · ${formatDateTime(event.createdAt)}`}
                            title={event.title}
                            detail={
                              event.detail
                                ? truncateSearchDetail(event.detail)
                                : undefined
                            }
                            context={
                              formatHistoryEventMeta(event) ? (
                                <span className="historyEventContext">
                                  {event.organizationId ? (
                                    <OrganizationAvatar
                                      name={
                                        findOrganizationById(
                                          event.organizationId,
                                        )?.name ??
                                        event.organizationName ??
                                        "Empresa"
                                      }
                                      kind={
                                        findOrganizationById(
                                          event.organizationId,
                                        )?.kind
                                      }
                                      logoUrl={getOrganizationLogoUrl(
                                        event.organizationId,
                                      )}
                                      size="sm"
                                    />
                                  ) : null}
                                  <span>{formatHistoryEventMeta(event)}</span>
                                </span>
                              ) : undefined
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </main>

      <ConfirmDialog
        open={confirmDialog !== null}
        title={confirmDialog?.title ?? ""}
        description={confirmDialog?.description ?? ""}
        confirmLabel={confirmDialog?.confirmLabel}
        destructive={confirmDialog?.destructive}
        busy={confirmDialogBusy}
        onConfirm={() => void handleConfirmDialog()}
        onCancel={closeConfirmDialog}
        cancelLabel="Cancelar"
      />
    </>
  );
}

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const DAY_HEADING_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

interface TodayDayBrief {
  line1: string;
  line2: string;
}

function truncateBriefText(value: string, maxChars: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxChars)}...`;
}

function getFocusKindLabel(focusKind: string): string {
  switch (focusKind) {
    case "session_active":
      return "Sessao ativa";
    case "unblock":
      return "Desbloquear";
    case "continue_doing":
      return "Continuar";
    case "committed":
      return "Prioridade do dia";
    case "pick_task":
      return "Escolher tarefa";
    default:
      return "Foco";
  }
}

function resolveTodayFocusTask(
  data: DashboardDto | null,
  planMap: Map<string, WorkItemDto>,
): WorkItemDto | null {
  if (!data) {
    return null;
  }

  const taskId = data.todayFocus.taskId;
  if (taskId) {
    return planMap.get(taskId) ?? data.currentTask ?? null;
  }

  return data.currentTask ?? null;
}

function resolveTodayCommittedTask(
  data: DashboardDto | null,
  planMap: Map<string, WorkItemDto>,
): WorkItemDto | null {
  if (!data) {
    return null;
  }

  const committed = data.todayPlan.find((item) => item.isCommitted);
  if (!committed) {
    return null;
  }

  return planMap.get(committed.workItemId) ?? null;
}

function buildTodayDayBrief(
  data: DashboardDto,
  focusTask: WorkItemDto | null,
  committedTask: WorkItemDto | null,
): TodayDayBrief {
  const { todayFocus, activeSession } = data;
  const greeting = getGreeting();

  if (activeSession) {
    const goal = todayFocus.sessionGoal?.trim() || activeSession.goal?.trim();
    const contextParts = [
      todayFocus.primaryRepositoryName,
      activeSession.branchName ? `branch ${activeSession.branchName}` : null,
    ].filter(Boolean);

    return {
      line1: `${greeting}. Foco em andamento.`,
      line2: truncateBriefText(
        [goal || todayFocus.headline, contextParts.join(" · ")]
          .filter(Boolean)
          .join(" · "),
        120,
      ),
    };
  }

  if (todayFocus.focusKind === "unblock") {
    const blocker = todayFocus.blockerLabel || todayFocus.dependencyLabel;

    return {
      line1: `${greeting}. Bloqueio na frente.`,
      line2: blocker
        ? truncateBriefText(`Resolva antes de avancar: ${blocker}`, 120)
        : truncateBriefText(todayFocus.nextStep, 120),
    };
  }

  if (committedTask) {
    return {
      line1: `${greeting}. Prioridade do dia.`,
      line2: truncateBriefText(
        `P${committedTask.priority ?? 3} · ${committedTask.title}`,
        120,
      ),
    };
  }

  if (focusTask && todayFocus.focusKind === "continue_doing") {
    return {
      line1: `${greeting}. Retome de onde parou.`,
      line2: truncateBriefText(
        `P${focusTask.priority ?? 3} · ${focusTask.title}`,
        120,
      ),
    };
  }

  return {
    line1: `${greeting}.`,
    line2: truncateBriefText(todayFocus.nextStep, 120),
  };
}

function buildTodayStatusChips(
  data: DashboardDto,
  focusTask: WorkItemDto | null,
  committedTask: WorkItemDto | null,
): string[] {
  const chips: string[] = [];
  const { todayFocus, activeSession, summary } = data;

  if (activeSession) {
    chips.push("Em foco");
  }

  if (summary.blockedCount > 0) {
    chips.push(`${summary.blockedCount} bloqueada(s)`);
  }

  if (todayFocus.primaryRepositoryName) {
    chips.push(todayFocus.primaryRepositoryName);
  }

  if (committedTask) {
    chips.push(`Comprometida: ${truncateBriefText(committedTask.title, 40)}`);
  } else if (focusTask) {
    chips.push(`P${focusTask.priority ?? 3}`);
  }

  for (const signal of todayFocus.deadlineSignals ?? []) {
    chips.push(signal);
  }

  return chips.slice(0, 6);
}

function formatValidationCheckDetail(check: ValidationCheckDto): string {
  if (check.expected && check.actual) {
    return `${check.message} · Esperado: ${check.expected} · Atual: ${check.actual}`;
  }
  if (check.expected) {
    return `${check.message} · Esperado: ${check.expected}`;
  }
  if (check.actual) {
    return `${check.message} · Atual: ${check.actual}`;
  }
  return check.message;
}

function formatRepositoryContextLine(
  repository: RepositoryListItemDto,
): string | undefined {
  const identity =
    repository.expectedGitUserName && repository.expectedGitUserEmail
      ? `${repository.expectedGitUserName} <${repository.expectedGitUserEmail}>`
      : (repository.expectedGitUserName ??
        repository.expectedGitUserEmail ??
        undefined);

  const parts = [
    repository.organizationName,
    repository.environmentName,
    identity ? `git: ${identity}` : undefined,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function formatContextChain(
  organization: OrganizationListItemDto | null,
  repository: RepositoryListItemDto | null,
  guardrail: RepositoryGuardrailDto | null | undefined,
): string | null {
  if (!organization && !repository && !guardrail) {
    return null;
  }

  const identitySource = guardrail?.identitySource
    ? guardrail.identitySource === "override"
      ? "override"
      : guardrail.identitySource === "profile"
        ? "profile"
        : null
    : null;

  return buildContextChainLabel({
    organizationName: organization?.name ?? guardrail?.organizationName ?? null,
    environmentName:
      repository?.environmentName ??
      organization?.environmentName ??
      guardrail?.environmentName ??
      null,
    repositoryName: repository?.name ?? guardrail?.repositoryName ?? null,
    effectiveIdentity: {
      gitUserName:
        guardrail?.expectedGitUserName ??
        repository?.expectedGitUserName ??
        organization?.gitUserName ??
        null,
      gitUserEmail:
        guardrail?.expectedGitUserEmail ??
        repository?.expectedGitUserEmail ??
        organization?.gitUserEmail ??
        null,
    },
    identitySource,
  });
}

function buildInspectIdentityWarning(
  organization: OrganizationListItemDto | null,
  inspection: LocalRepositoryInspectionDto | null,
): string | null {
  if (!organization || !inspection?.isGitRepo) {
    return null;
  }

  const mismatches: string[] = [];

  if (
    organization.gitUserName &&
    inspection.gitUserName &&
    organization.gitUserName !== inspection.gitUserName
  ) {
    mismatches.push(
      `user.name local (${inspection.gitUserName}) difere do perfil (${organization.gitUserName})`,
    );
  }

  if (
    organization.gitUserEmail &&
    inspection.gitUserEmail &&
    organization.gitUserEmail !== inspection.gitUserEmail
  ) {
    mismatches.push(
      `user.email local (${inspection.gitUserEmail}) difere do perfil (${organization.gitUserEmail})`,
    );
  }

  return mismatches.length > 0 ? mismatches.join(" · ") : null;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) {
    return "Bom dia";
  }
  if (hour < 18) {
    return "Boa tarde";
  }
  return "Boa noite";
}

function emptyTaskFormDraft(): TaskFormDraft {
  return {
    title: "",
    description: "",
    status: "todo",
    priority: 3,
    organizationId: "",
    projectId: "",
    primaryRepositoryId: "",
    blockedReason: "",
    resumeSummary: "",
  };
}

function taskToFormDraft(task: WorkItemDto): TaskFormDraft {
  return {
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    priority: task.priority ?? 3,
    organizationId: task.organizationId ?? "",
    projectId: task.projectId ?? "",
    primaryRepositoryId: task.primaryRepositoryId ?? "",
    blockedReason: task.blockedReason ?? "",
    resumeSummary: task.resumeSummary ?? "",
  };
}

function optionalFormValue(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildTaskPreviewLine(task: WorkItemDto): string | undefined {
  const parts: string[] = [];
  if (task.resumeSummary?.trim()) {
    parts.push(task.resumeSummary.trim());
  } else if (task.description?.trim()) {
    parts.push(task.description.trim());
  }
  if (task.scheduledFor) {
    parts.push(`Prazo ${formatDateTime(task.scheduledFor)}`);
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function formatPmProviderLabel(provider: string): string {
  switch (provider) {
    case "jira":
      return "Jira";
    case "clickup":
      return "ClickUp";
    default:
      return provider;
  }
}

function formatDeadlineAlertKind(kind: string): string {
  switch (kind) {
    case "overdue":
      return "Vencido";
    case "due_today":
      return "Entrega hoje";
    case "due_soon":
      return "Em breve";
    default:
      return kind;
  }
}

function classifyWorkItemDeadlineFilter(item: WorkItemDto): string {
  if (!item.scheduledFor?.trim()) {
    return "no_deadline";
  }
  if (
    item.status === "done" ||
    item.status === "archived" ||
    item.wcpDismissedAt
  ) {
    return "no_deadline";
  }

  const due = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(item.scheduledFor.trim())
      ? `${item.scheduledFor.trim()}T23:59:59`
      : item.scheduledFor.trim(),
  );
  if (Number.isNaN(due.getTime())) {
    return "no_deadline";
  }

  const now = new Date();
  const hoursUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntilDue < 0) {
    return "overdue";
  }

  const isSameDay =
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate();
  if (isSameDay) {
    return "due_today";
  }
  if (hoursUntilDue <= 168) {
    return "due_soon";
  }
  return "no_deadline";
}

function groupDeadlineAlertsByOrganization(
  alerts: DeadlineAlertItemDto[],
): Array<{
  organizationId: string;
  organizationName: string;
  items: DeadlineAlertItemDto[];
}> {
  const groups = new Map<
    string,
    {
      organizationId: string;
      organizationName: string;
      items: DeadlineAlertItemDto[];
    }
  >();

  for (const alert of alerts) {
    const organizationId = alert.organizationId ?? "sem-org";
    const organizationName = alert.organizationName ?? "Sem empresa";
    const existing = groups.get(organizationId);
    if (existing) {
      existing.items.push(alert);
    } else {
      groups.set(organizationId, {
        organizationId,
        organizationName,
        items: [alert],
      });
    }
  }

  return [...groups.values()];
}

function getTaskFormWarnings(
  draft: TaskFormDraft,
  projects: ProjectListItemDto[],
  repositories: RepositoryListItemDto[],
  organizations: OrganizationListItemDto[],
): string[] {
  const warnings: string[] = [];

  if (draft.status === "blocked" && !draft.blockedReason.trim()) {
    warnings.push("Informe o motivo do bloqueio.");
  }

  const refs = buildWorkContextEntityRefs({
    projects: projects.map((project) => ({
      id: project.id,
      organizationId: project.organizationId,
      name: project.name,
      isActive: project.isActive ?? true,
    })),
    repositories: repositories.map((repository) => ({
      id: repository.id,
      organizationId: repository.organizationId,
      projectId: repository.projectId,
      name: repository.name,
      isActive: repository.isActive,
    })),
    organizations: organizations.map((organization) => ({
      id: organization.id,
      name: organization.name,
      isActive: organization.isActive ?? true,
    })),
  });

  warnings.push(
    ...validateWorkContextLinks(
      {
        organizationId: draft.organizationId || null,
        projectId: draft.projectId || null,
        repositoryId: draft.primaryRepositoryId || null,
      },
      refs,
    ).map((issue) => issue.message),
  );

  if (
    draft.organizationId &&
    !organizations.some((entry) => entry.id === draft.organizationId)
  ) {
    warnings.push("Empresa selecionada nao esta mais disponivel.");
  }

  return warnings;
}

function formatTaskStatus(status: string): string {
  switch (status) {
    case "blocked":
      return "Bloqueada";
    case "doing":
      return "Em andamento";
    case "todo":
      return "A fazer";
    case "done":
      return "Concluida";
    case "archived":
      return "Arquivada";
    case "executable":
      return "Pronta";
    default:
      return status.replace(/_/g, " ");
  }
}

function inferProviderTypeFromHost(host: string): string {
  const normalized = host.trim().toLowerCase();
  if (normalized.includes("github")) {
    return "github";
  }
  if (normalized.includes("gitlab")) {
    return "gitlab";
  }
  if (normalized.includes("bitbucket")) {
    return "bitbucket";
  }
  if (
    normalized.includes("dev.azure.com") ||
    normalized.includes("visualstudio.com")
  ) {
    return "azure";
  }
  return "other";
}

function formatSshConfigHostOptionLabel(entry: SshConfigHostEntryDto): string {
  const hostName = entry.hostName ?? entry.hostAlias;
  const lineRef =
    entry.lineStart > 0
      ? ` · L${entry.lineStart}${entry.lineEnd > entry.lineStart ? `–${entry.lineEnd}` : ""}`
      : "";
  return `${entry.hostAlias} → ${hostName}${lineRef}`;
}

function groupSshConfigHostsBySection(
  hosts: SshConfigHostEntryDto[],
): Array<[string, SshConfigHostEntryDto[]]> {
  const groups = new Map<string, SshConfigHostEntryDto[]>();

  for (const entry of hosts) {
    const label = entry.sectionLabel?.trim() || "Outros hosts";
    const current = groups.get(label) ?? [];
    current.push(entry);
    groups.set(label, current);
  }

  return Array.from(groups.entries());
}

function parseSshRemoteHostAlias(remoteUrl: string): string | null {
  if (!remoteUrl.startsWith("git@")) {
    return null;
  }

  return remoteUrl.replace(/^git@/, "").split(":")[0] ?? null;
}

function previewSshRemoteWithAlias(
  remoteUrl: string,
  sshHostAlias: string,
): string | null {
  if (!remoteUrl.startsWith("git@")) {
    return null;
  }

  const path = remoteUrl.replace(/^git@/, "").split(":").slice(1).join(":");
  const alias = sshHostAlias.trim();
  if (!path || !alias) {
    return null;
  }

  return `git@${alias}:${path}`;
}

function needsSshRemoteAliasFix(
  remoteUrl: string | null | undefined,
  sshHostAlias: string | null | undefined,
): boolean {
  const alias = sshHostAlias?.trim();
  if (!alias || !remoteUrl?.startsWith("git@")) {
    return false;
  }

  return parseSshRemoteHostAlias(remoteUrl) !== alias;
}

function formatValidationStatus(status: string): string {
  switch (status) {
    case "ok":
      return "Tudo certo";
    case "warning":
      return "Atencao";
    case "mismatch":
      return "Diferente do esperado";
    default:
      return status;
  }
}

function humanizeCheckKey(key: string): string {
  switch (key) {
    case "git_user_name":
    case "gitUserName":
      return "Nome no Git";
    case "git_user_email":
    case "gitUserEmail":
      return "Email no Git";
    case "ssh_host_alias":
    case "sshHostAlias":
      return "Alias SSH";
    case "provider_host":
    case "providerHost":
      return "Servico Git";
    case "localPath":
      return "Pasta local";
    case "remote_url":
      return "Endereco remoto";
    case "branch_pattern":
    case "branchPattern":
      return "Padrao de branch";
    default:
      return key.replace(/_/g, " ");
  }
}

function buildContextSwitchChecks(
  selectedRepo: RepositoryListItemDto | null,
  validation: IdentityValidationDto | null | undefined,
  hookStatus: RepositoryHookStatusDto | null,
): ContextSwitchCheck[] {
  const checks: ContextSwitchCheck[] = [
    {
      id: "repo-selected",
      label: "Repositorio selecionado",
      message: selectedRepo?.name ?? "Nenhum projeto escolhido",
      status: selectedRepo ? "ok" : "warning",
    },
  ];

  if (validation) {
    for (const check of validation.checks) {
      checks.push({
        id: check.key,
        label: humanizeCheckKey(check.key),
        message: check.message,
        status:
          check.status === "ok" ||
          check.status === "warning" ||
          check.status === "mismatch"
            ? check.status
            : "warning",
      });
    }
  } else if (selectedRepo) {
    checks.push({
      id: "validation-pending",
      label: "Conferencia local",
      message: "Ainda nao foi possivel validar este repositorio.",
      status: "warning",
    });
  }

  checks.push({
    id: "pre-push",
    label: "Protecao pre-push",
    message: hookStatus?.managedByApp
      ? "Hook ativo e gerenciado pelo app"
      : hookStatus?.installed
        ? "Hook manual detectado neste projeto"
        : "Nenhum hook instalado ainda",
    status: hookStatus?.managedByApp ? "ok" : "warning",
  });

  return checks;
}

function groupRepositoriesByOrg(
  repositories: RepositoryListItemDto[],
  organizationFilter: string,
): {
  organizationId?: string | null;
  organizationName: string;
  repositories: RepositoryListItemDto[];
}[] {
  const filtered =
    organizationFilter === "all"
      ? repositories
      : repositories.filter(
          (repository) => repository.organizationId === organizationFilter,
        );
  const groups = new Map<string, RepositoryListItemDto[]>();

  for (const repository of filtered) {
    const key = repository.organizationName ?? "Sem empresa";
    const current = groups.get(key) ?? [];
    current.push(repository);
    groups.set(key, current);
  }

  return Array.from(groups.entries()).map(
    ([organizationName, groupedRepositories]) => ({
      organizationId: groupedRepositories[0]?.organizationId ?? null,
      organizationName,
      repositories: groupedRepositories,
    }),
  );
}

function buildTaskTimelineEntries(
  currentTask: WorkItemDto | null | undefined,
  taskContext: TaskContextDto | null | undefined,
): TimelineEntryDto[] {
  const entries: TimelineEntryDto[] = [];

  for (const session of taskContext?.recentTaskSessions ?? []) {
    entries.push({
      id: `session-${session.id}`,
      kind: "session",
      title: session.goal ?? "Sessao sem objetivo",
      detail: `${formatDateTime(session.startedAt)}${session.branchName ? ` · ${session.branchName}` : ""}${session.result ? ` · ${session.result}` : ""}`,
      createdAt: session.startedAt,
    });
  }

  for (const note of taskContext?.taskNotes ?? []) {
    const isChangeNote = note.title === "Alteracao da tarefa";
    entries.push({
      id: `note-${note.id}`,
      kind: isChangeNote ? "change" : "note",
      title: note.title,
      detail: note.content,
      createdAt: note.createdAt,
    });
  }

  for (const artifact of taskContext?.taskArtifacts ?? []) {
    entries.push({
      id: `artifact-${artifact.id}`,
      kind: "artifact",
      title: artifact.title ?? artifact.artifactType,
      detail: artifact.url ?? artifact.artifactType,
      createdAt: artifact.createdAt,
    });
  }

  for (const dependency of taskContext?.dependencies ?? []) {
    entries.push({
      id: `dependency-${dependency.relatedWorkItemId}-${dependency.relation}`,
      kind: "dependency",
      title: dependency.title,
      detail: currentTask
        ? formatDependencySentence(
            currentTask.title,
            dependency.relation,
            dependency.title,
          )
        : `${dependency.relation === "depends_on" ? "depende de" : "bloqueia"} · ${dependency.status}`,
      createdAt: currentTask?.blockedReason ? "z-bloqueio" : "z-dependency",
    });
  }

  if (currentTask?.blockedReason) {
    entries.push({
      id: `block-${currentTask.id}`,
      kind: "block",
      title: "Bloqueio atual",
      detail: currentTask.blockedReason,
      createdAt: "z-block",
    });
  }

  return entries.sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

function normalizeContextEventLabel(kind: ContextEventKind): string {
  switch (kind) {
    case "session":
      return "Sessao";
    case "decision":
      return "Decisao";
    case "note":
      return "Nota";
    case "artifact":
      return "Artefato";
    case "task":
      return "Tarefa";
    case "block":
      return "Bloqueio";
    case "dependency":
      return "Dependencia";
    case "repository":
      return "Projeto";
    default:
      return kind;
  }
}

function searchResultToContextEvent(
  result: SearchResultDto,
  backlog: WorkItemDto[],
  repositories: RepositoryListItemDto[],
  organizations: OrganizationListItemDto[],
): ContextEventDto {
  const task = result.workItemId
    ? backlog.find((item) => item.id === result.workItemId)
    : null;
  const repository = result.repositoryId
    ? repositories.find((item) => item.id === result.repositoryId)
    : null;
  const organizationId =
    task?.organizationId ?? repository?.organizationId ?? null;
  const organization = organizationId
    ? organizations.find((item) => item.id === organizationId)
    : null;

  return {
    id: result.id,
    kind: result.kind as ContextEventKind,
    title: result.title,
    detail: result.detail,
    createdAt: result.createdAt ?? new Date(0).toISOString(),
    workItemId: result.workItemId ?? task?.id ?? null,
    workItemTitle: task?.title ?? null,
    repositoryId: result.repositoryId ?? repository?.id ?? null,
    repositoryName: repository?.name ?? null,
    organizationId,
    organizationName: organization?.name ?? null,
  };
}

function groupHistoryByDay(events: ContextEventDto[]) {
  const groups = new Map<string, ContextEventDto[]>();

  for (const event of events) {
    const dayKey = event.createdAt.slice(0, 10);
    const bucket = groups.get(dayKey);
    if (bucket) {
      bucket.push(event);
    } else {
      groups.set(dayKey, [event]);
    }
  }

  return Array.from(groups.entries())
    .sort((left, right) => right[0].localeCompare(left[0]))
    .map(([dayKey, dayEvents]) => ({
      dayKey,
      label: formatDayHeading(dayKey),
      events: dayEvents,
    }));
}

function formatDayHeading(dayKey: string): string {
  const parsed = new Date(`${dayKey}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dayKey;
  }

  return DAY_HEADING_FORMATTER.format(parsed);
}

function formatDependencySentence(
  currentTitle: string,
  relation: string,
  relatedTitle: string,
): string {
  if (relation === "depends_on") {
    return `${currentTitle} depende de ${relatedTitle}`;
  }

  return `${relatedTitle} bloqueia ${currentTitle}`;
}

function formatDependencyPreview(
  currentTitle: string,
  relation: "depends_on" | "blocks",
  targetTitle: string,
): string {
  if (relation === "depends_on") {
    return `${currentTitle} depende de ${targetTitle}`;
  }

  return `${currentTitle} bloqueia ${targetTitle}`;
}

function normalizeSearchLabel(kind: SearchResultKind): string {
  switch (kind) {
    case "task":
      return "Tarefas";
    case "note":
      return "Notas";
    case "session":
      return "Sessoes";
    case "artifact":
      return "Artefatos";
    case "repository":
      return "Repositorios";
    case "dependency":
      return "Dependencias";
    default:
      return kind;
  }
}

function truncateSearchDetail(value: string, maxLength = 120): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 1)}…`;
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  manual: "Manual",
  imported: "Importado",
  inferred: "Inferido",
  captured: "Capturado",
};

function formatSourceTypeLabel(sourceType: string): string {
  return SOURCE_TYPE_LABELS[sourceType] ?? sourceType;
}

function formatOrganizationKind(kind?: string | null): string {
  switch (kind) {
    case "personal":
      return "Pessoal";
    case "community":
      return "Comunidade";
    case "company":
    default:
      return "Empresa";
  }
}

function parseUsefulLinks(
  notesJson?: string | null,
): Array<{ label: string; url: string }> {
  if (!notesJson?.trim()) {
    return [{ label: "", url: "" }];
  }

  try {
    const parsed = JSON.parse(notesJson) as {
      links?: Array<{ label?: string; url?: string }>;
    };
    const links = parsed.links ?? [];
    if (links.length === 0) {
      return [{ label: "", url: "" }];
    }
    return links.map((link) => ({
      label: link.label?.trim() ?? "",
      url: link.url?.trim() ?? "",
    }));
  } catch {
    return [{ label: "", url: "" }];
  }
}

function serializeUsefulLinks(
  links: Array<{ label: string; url: string }>,
): string | null {
  const filtered = links.filter((link) => link.label.trim() || link.url.trim());
  if (filtered.length === 0) {
    return null;
  }
  return JSON.stringify({
    links: filtered.map((link) => ({
      label: link.label.trim(),
      url: link.url.trim(),
    })),
  });
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return DATE_TIME_FORMATTER.format(parsed);
}

function formatTimelineWhen(createdAt: string): string {
  if (createdAt.startsWith("z-")) {
    return "—";
  }

  return formatDateTime(createdAt);
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  if (typeof error === "object" && error !== null) {
    const candidate = error as { message?: unknown; error?: unknown };
    if (
      typeof candidate.message === "string" &&
      candidate.message.trim().length > 0
    ) {
      return candidate.message;
    }
    if (
      typeof candidate.error === "string" &&
      candidate.error.trim().length > 0
    ) {
      return candidate.error;
    }
  }

  return fallback;
}
