import { OrganizationAvatar } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import { MAIN_VIEW_ICONS, type MainView } from "@/lib/app-icons";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

const NAV_ITEMS: Array<{ view: MainView; label: string }> = [
  { view: "today", label: "Hoje" },
  { view: "backlog", label: "Tarefas" },
  { view: "organizations", label: "Empresa" },
  { view: "repos", label: "Projetos" },
  { view: "history", label: "Historico" },
];

export function AppSidebar({
  value,
  onChange,
  organizationName,
  organizationKind,
  organizationLogoUrl,
  onOrganizationClick,
}: {
  value: MainView;
  onChange: (view: MainView) => void;
  organizationName?: string | null;
  organizationKind?: string | null;
  organizationLogoUrl?: string | null;
  onOrganizationClick?: () => void;
}) {
  return (
    <aside className="app-sidebar" aria-label="Navegacao principal">
      <div className="app-sidebar-brand" title="Contexto">
        <Sparkles className="h-5 w-5 text-primary" aria-hidden />
        <span className="app-sidebar-brand-label">Contexto</span>
      </div>

      <nav className="app-sidebar-nav">
        {NAV_ITEMS.map(({ view, label }) => {
          const Icon = MAIN_VIEW_ICONS[view];
          const active = value === view;

          return (
            <Button
              key={view}
              type="button"
              variant="ghost"
              size="icon"
              title={label}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "app-sidebar-nav-item",
                active && "app-sidebar-nav-item-active",
              )}
              onClick={() => onChange(view)}
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span className="app-sidebar-nav-label">{label}</span>
            </Button>
          );
        })}
      </nav>

      {organizationName && onOrganizationClick ? (
        <div className="app-sidebar-footer">
          <Button
            type="button"
            variant="ghost"
            className="app-sidebar-org-button"
            title={`Empresa: ${organizationName}`}
            onClick={onOrganizationClick}
          >
            <OrganizationAvatar
              name={organizationName}
              kind={organizationKind}
              logoUrl={organizationLogoUrl}
              size="sm"
            />
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
