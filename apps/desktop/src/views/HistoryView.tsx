import {
  FilterTabs,
  HistoryEventButton,
  SearchField,
} from "@/components/app-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldSelect } from "@/components/ui/form-fields";
import { HISTORY_KIND_ICONS } from "@/lib/app-icons";
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
  truncateDetail: (value: string) => string;
  formatEventMeta: (event: HistoryEventViewModel) => string;
  renderOrganizationAvatar: (
    organizationId: string,
    fallbackName?: string | null,
  ) => ReactNode;
};

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
                {group.events.map((event) => (
                  <li key={`${event.kind}-${event.id}`}>
                    <HistoryEventButton
                      kind={event.kind}
                      onClick={() => onEventClick(event)}
                      meta={`${formatEventKind(event.kind)} · ${formatDateTime(event.createdAt)}`}
                      title={event.title}
                      detail={
                        event.detail ? truncateDetail(event.detail) : undefined
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
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
