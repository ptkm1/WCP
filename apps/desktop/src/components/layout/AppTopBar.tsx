import { SearchField, SearchResultButton } from "@/components/app-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSearchKindIcon } from "@/lib/app-icons";
import { cn } from "@/lib/utils";
import { GitBranch, History, Search, X } from "lucide-react";
import type { ReactNode } from "react";

export type SearchResultGroup = {
  kind: string;
  label: string;
  items: Array<{
    id: string;
    kind: string;
    title: string;
    detail?: string | null;
    createdAt?: string | null;
    meta?: string;
  }>;
};

export function AppTopBar({
  searchQuery,
  onSearchQueryChange,
  searchOpen,
  searchBusy,
  groupedSearchResults,
  onSearchResultClick,
  onOpenHistory,
  onClearSearch,
  focusTitle,
  focusActive,
  onFocusContextClick,
  className,
}: {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchOpen: boolean;
  searchBusy: boolean;
  groupedSearchResults: SearchResultGroup[];
  onSearchResultClick: (item: SearchResultGroup["items"][number]) => void;
  onOpenHistory: () => void;
  onClearSearch?: () => void;
  focusTitle?: string | null;
  focusActive?: boolean;
  onFocusContextClick?: () => void;
  className?: string;
}) {
  const searchExpanded = searchOpen || searchQuery.trim().length > 0;

  return (
    <header className={cn("app-topbar", className)}>
      <div className="app-topbar-start">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 lg:hidden"
          aria-label="Buscar"
          onClick={() => {
            if (!searchExpanded) {
              onSearchQueryChange(" ");
              onSearchQueryChange("");
            }
          }}
        >
          <Search className="h-4 w-4" aria-hidden />
        </Button>

        <div
          className={cn(
            "app-topbar-search",
            searchExpanded && "app-topbar-search-expanded",
          )}
        >
          <SearchField
            type="search"
            className="h-9 rounded-xl bg-background/80"
            placeholder="Buscar tarefas, notas, sessoes..."
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            aria-label="Busca global no historico local"
          />
          {searchQuery.trim() ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Limpar busca"
              onClick={onClearSearch}
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          ) : null}

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
                    onClick={onOpenHistory}
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
                        onClick={() => onSearchResultClick(item)}
                        title={item.title}
                        detail={item.detail ?? undefined}
                        meta={item.meta ?? item.kind}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {focusTitle ? (
        <FocusChip
          title={focusTitle}
          active={focusActive}
          onContextClick={onFocusContextClick}
        />
      ) : null}
    </header>
  );
}

function FocusChip({
  title,
  active,
  onContextClick,
}: {
  title: string;
  active?: boolean;
  onContextClick?: () => void;
}) {
  return (
    <div className="app-topbar-focus">
      <Badge
        variant={active ? "success" : "secondary"}
        className="shrink-0 text-[10px] uppercase tracking-wide"
      >
        {active ? "Em foco" : "Foco"}
      </Badge>
      <span className="app-topbar-focus-title" title={title}>
        {title}
      </span>
      {onContextClick ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 px-2"
          onClick={onContextClick}
        >
          <GitBranch className="h-3.5 w-3.5" aria-hidden />
          Git
        </Button>
      ) : null}
    </div>
  );
}

export function ViewHeader({
  title,
  hint,
  actions,
}: {
  title: string;
  hint?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="view-header">
      <div className="view-header-copy">
        <h1 className="view-header-title">{title}</h1>
        {hint ? <p className="view-header-hint">{hint}</p> : null}
      </div>
      {actions ? <div className="view-header-actions">{actions}</div> : null}
    </header>
  );
}
