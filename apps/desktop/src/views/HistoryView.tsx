import {
  FilterTabs,
  HistoryEventButton,
  SearchField,
} from "@/components/app-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldSelect } from "@/components/ui/form-fields";
import { HISTORY_KIND_ICONS } from "@/lib/app-icons";
import {
  formatSessionBranchLabel,
  formatSessionTimeRange,
  parseSessionGitActivity,
} from "@/lib/session-git";
import type { ReactNode } from "react";

export type HistoryKindFilter = {
  id: string;
  label: string;
};

export type HistoryEventViewModel = {
  id: string;
  kind: string;
  title: string;
  detail?: string | null;
  createdAt: string;
  endedAt?: string | null;
  payloadJson?: string | null;
  organizationId?: string | null;
  organizationName?: string | null;
};

export type HistoryDayGroup = {
  dayKey: string;
  label: string;
  events: HistoryEventViewModel[];
};

export type HistoryViewProps = {
  historyTextQuery: string;
  onHistoryTextQueryChange: (value: string) => void;
  historyKindFilter: string;
  onHistoryKindFilterChange: (value: string) => void;
  historyAdvancedFiltersOpen: boolean;
  onHistoryAdvancedFiltersOpenChange: (open: boolean) => void;
  historyTaskFilter: string;
  onHistoryTaskFilterChange: (value: string) => void;
  historyRepoFilter: string;
  onHistoryRepoFilterChange: (value: string) => void;
  historyOrgFilter: string;
  onHistoryOrgFilterChange: (value: string) => void;
  historyTaskOptions: Array<[string, string]>;
  historyRepoOptions: Array<[string, string]>;
  historyOrgOptions: Array<[string, string]>;
  historyKindFilters: HistoryKindFilter[];
  historyKindCounts: Record<string, number>;
  historyLoading: boolean;
  historySearchBusy: boolean;
  historyError: string | null;
  historyEventsCount: number;
  historyUsesDeepSearch: boolean;
  filteredHistoryEventsCount: number;
  groupedHistoryEvents: HistoryDayGroup[];
  onOpenBacklog: () => void;
  onEventClick: (event: HistoryEventViewModel) => void;
  formatEventKind: (kind: string) => string;
  formatDateTime: (value: string) => string;
  formatTime: (value: string) => string;
  truncateDetail: (value: string) => string;
  formatEventMeta: (event: HistoryEventViewModel) => string;
  renderOrganizationAvatar: (
    organizationId: string,
    fallbackName?: string | null,
  ) => ReactNode;
};

function extractSessionNote(detail?: string | null): string | null {
  const raw = detail?.trim();
  if (!raw) {
    return null;
  }
  const first = raw.split(" · ")[0]?.trim() ?? "";
  if (!first) {
    return null;
  }
  // Skip detail that is only a branch-like token.
  if (first.includes("/") && first.length < 80 && !first.includes(" ")) {
    return null;
  }
  return first;
}

function SessionHistoryDetail({
  event,
  formatTime,
}: {
  event: HistoryEventViewModel;
  formatTime: (value: string) => string;
}) {
  const git = parseSessionGitActivity(event.payloadJson);
  const branch = formatSessionBranchLabel(git);
  const commits = git?.commits ?? [];
  const note = extractSessionNote(event.detail);

  return (
    <div className="grid w-full gap-2 text-left">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>
          {formatSessionTimeRange(event.createdAt, event.endedAt, formatTime)}
        </span>
        {event.organizationName ? (
          <span>· {event.organizationName}</span>
        ) : null}
      </div>
      {branch ? (
        <p>
          <span className="font-medium text-foreground">Branch</span>{" "}
          <code>{branch}</code>
        </p>
      ) : null}
      {commits.length > 0 ? (
        <div className="grid gap-1">
          <span className="font-medium text-foreground">Commits</span>
          <ul className="grid gap-0.5">
            {commits.slice(0, 8).map((commit) => (
              <li key={`${commit.sha}-${commit.subject}`}>
                <code>{commit.sha}</code> {commit.subject}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {note ? (
        <p>
          <span className="font-medium text-foreground">Nota</span> {note}
        </p>
      ) : null}
    </div>
  );
}

export function HistoryView({
  historyTextQuery,
  onHistoryTextQueryChange,
  historyKindFilter,
  onHistoryKindFilterChange,
  historyAdvancedFiltersOpen,
  onHistoryAdvancedFiltersOpenChange,
  historyTaskFilter,
  onHistoryTaskFilterChange,
  historyRepoFilter,
  onHistoryRepoFilterChange,
  historyOrgFilter,
  onHistoryOrgFilterChange,
  historyTaskOptions,
  historyRepoOptions,
  historyOrgOptions,
  historyKindFilters,
  historyKindCounts,
  historyLoading,
  historySearchBusy,
  historyError,
  historyEventsCount,
  historyUsesDeepSearch,
  filteredHistoryEventsCount,
  groupedHistoryEvents,
  onOpenBacklog,
  onEventClick,
  formatEventKind,
  formatDateTime,
  formatTime,
  truncateDetail,
  formatEventMeta,
  renderOrganizationAvatar,
}: HistoryViewProps) {
  return (
    <section className="panel historyPanel">
      <div className="historyFilters">
        <div className="historyFilterRow">
          <SearchField
            type="search"
            placeholder="Filtrar por texto no historico..."
            value={historyTextQuery}
            onChange={(event) => onHistoryTextQueryChange(event.target.value)}
            aria-label="Busca textual no historico"
          />
        </div>
        <FilterTabs
          value={historyKindFilter}
          onValueChange={onHistoryKindFilterChange}
          aria-label="Filtrar historico por tipo"
          items={historyKindFilters.map((filter) => ({
            id: filter.id,
            label: `${filter.label} (${historyKindCounts[filter.id] ?? 0})`,
            icon: HISTORY_KIND_ICONS[filter.id],
          }))}
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onHistoryAdvancedFiltersOpenChange(!historyAdvancedFiltersOpen)
            }
          >
            {historyAdvancedFiltersOpen ? "Ocultar filtros" : "Mais filtros"}
          </Button>
          {historyTaskFilter !== "all" ||
          historyRepoFilter !== "all" ||
          historyOrgFilter !== "all" ? (
            <Badge variant="secondary">Filtros ativos</Badge>
          ) : null}
        </div>
        {historyAdvancedFiltersOpen ? (
          <div className="historyFilterRow grid gap-3 lg:grid-cols-3">
            <FieldSelect
              id="history-task-filter"
              label="Tarefa"
              value={historyTaskFilter}
              onValueChange={onHistoryTaskFilterChange}
              options={[
                { value: "all", label: "Todas" },
                ...historyTaskOptions.map(([id, title]) => ({
                  value: id,
                  label: title,
                })),
              ]}
            />
            <FieldSelect
              id="history-repo-filter"
              label="Projeto"
              value={historyRepoFilter}
              onValueChange={onHistoryRepoFilterChange}
              options={[
                { value: "all", label: "Todos" },
                ...historyRepoOptions.map(([id, name]) => ({
                  value: id,
                  label: name,
                })),
              ]}
            />
            <FieldSelect
              id="history-org-filter"
              label="Empresa"
              value={historyOrgFilter}
              onValueChange={onHistoryOrgFilterChange}
              options={[
                { value: "all", label: "Todas" },
                ...historyOrgOptions.map(([id, name]) => ({
                  value: id,
                  label: name,
                })),
              ]}
            />
          </div>
        ) : null}
      </div>

      {historyLoading ? (
        <p className="historyEmpty">Carregando historico...</p>
      ) : historySearchBusy ? (
        <p className="historyEmpty">Buscando no historico...</p>
      ) : historyError ? (
        <p className="historyEmpty">{historyError}</p>
      ) : historyEventsCount === 0 && !historyTextQuery.trim() ? (
        <div className="historyEmpty">
          <p>Nenhum evento registrado ainda.</p>
          <Button type="button" variant="outline" onClick={onOpenBacklog}>
            Ir para tarefas
          </Button>
        </div>
      ) : filteredHistoryEventsCount === 0 ? (
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
                {group.events.map((event) => {
                  const isSession = event.kind === "session";
                  return (
                    <li key={`${event.kind}-${event.id}`}>
                      <HistoryEventButton
                        kind={event.kind}
                        onClick={() => onEventClick(event)}
                        meta={
                          isSession
                            ? formatEventKind(event.kind)
                            : `${formatEventKind(event.kind)} · ${formatDateTime(event.createdAt)}`
                        }
                        title={event.title}
                        detail={
                          isSession ? (
                            <SessionHistoryDetail
                              event={event}
                              formatTime={formatTime}
                            />
                          ) : event.detail ? (
                            truncateDetail(event.detail)
                          ) : undefined
                        }
                        context={
                          formatEventMeta(event) ? (
                            <span className="historyEventContext">
                              {event.organizationId
                                ? renderOrganizationAvatar(
                                    event.organizationId,
                                    event.organizationName,
                                  )
                                : null}
                              <span>{formatEventMeta(event)}</span>
                            </span>
                          ) : undefined
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
