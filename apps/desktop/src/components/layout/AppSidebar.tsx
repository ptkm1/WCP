import { OrganizationAvatar } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { MAIN_VIEW_ICONS, type MainView } from "@/lib/app-icons";
import { cn } from "@/lib/utils";
import { Building2, Check, Settings2 } from "lucide-react";
import { useState } from "react";

const NAV_ITEMS: Array<{ view: MainView; label: string }> = [
  { view: "today", label: "Hoje" },
  { view: "backlog", label: "Tarefas" },
  { view: "organizations", label: "Empresa" },
  { view: "repos", label: "Projetos" },
  { view: "history", label: "Historico" },
];

export type CompanyProfileOption = {
  id: string;
  name: string;
  kind?: string | null;
  logoUrl?: string | null;
};

const ALL_COMPANIES_ID = "all";
const ALL_COMPANIES_LABEL = "Todas as empresas";

export function AppSidebar({
  value,
  onChange,
  todayBadgeCount = 0,
  companyProfileId = ALL_COMPANIES_ID,
  organizations = [],
  onCompanyProfileChange,
  onManageOrganization,
}: {
  value: MainView;
  onChange: (view: MainView) => void;
  todayBadgeCount?: number;
  companyProfileId?: string;
  organizations?: CompanyProfileOption[];
  onCompanyProfileChange?: (organizationId: string) => void;
  onManageOrganization?: (organizationId: string | null) => void;
}) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const selectedOrganization =
    companyProfileId === ALL_COMPANIES_ID
      ? null
      : (organizations.find((org) => org.id === companyProfileId) ?? null);

  const profileLabel = selectedOrganization?.name ?? ALL_COMPANIES_LABEL;
  const showProfileMenu = Boolean(onCompanyProfileChange);

  function selectProfile(nextId: string) {
    onCompanyProfileChange?.(nextId);
    setProfileMenuOpen(false);
  }

  function manageOrganization() {
    const targetId =
      selectedOrganization?.id ?? organizations[0]?.id ?? null;
    onManageOrganization?.(targetId);
    setProfileMenuOpen(false);
  }

  return (
    <aside className="app-sidebar" aria-label="Navegacao principal">
      <div className="app-sidebar-brand" title="Work Context Platform">
        <img
          src="/favicon.png"
          alt=""
          className="app-sidebar-brand-logo"
          width={28}
          height={28}
          aria-hidden
        />
        <span className="app-sidebar-brand-label">WCP</span>
      </div>

      <nav className="app-sidebar-nav">
        {NAV_ITEMS.map(({ view, label }) => {
          const Icon = MAIN_VIEW_ICONS[view];
          const active = value === view;
          const badge =
            view === "today" && todayBadgeCount > 0 ? todayBadgeCount : null;

          return (
            <Button
              key={view}
              type="button"
              variant="ghost"
              size="icon"
              title={badge ? `${label} · ${badge} na Inbox` : label}
              aria-label={badge ? `${label}, ${badge} na Inbox` : label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "app-sidebar-nav-item",
                active && "app-sidebar-nav-item-active",
              )}
              onClick={() => onChange(view)}
            >
              <span className="relative">
                <Icon className="h-5 w-5" aria-hidden />
                {badge ? (
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                    {badge > 9 ? "9+" : badge}
                  </span>
                ) : null}
              </span>
              <span className="app-sidebar-nav-label">{label}</span>
            </Button>
          );
        })}
      </nav>

      {showProfileMenu ? (
        <div className="app-sidebar-footer">
          <Popover
            open={profileMenuOpen}
            onOpenChange={setProfileMenuOpen}
            align="start"
            className="w-[260px] p-2"
            trigger={
              <Button
                type="button"
                variant="ghost"
                className="app-sidebar-org-button"
                title={`Perfil de empresa: ${profileLabel}`}
                aria-label={`Perfil de empresa: ${profileLabel}`}
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
              >
                {selectedOrganization ? (
                  <OrganizationAvatar
                    name={selectedOrganization.name}
                    kind={selectedOrganization.kind}
                    logoUrl={selectedOrganization.logoUrl}
                    size="sm"
                  />
                ) : (
                  <span
                    className="orgAvatar orgAvatar-sm orgAvatar-company flex items-center justify-center"
                    aria-hidden
                    title={ALL_COMPANIES_LABEL}
                  >
                    <Building2 className="h-4 w-4" />
                  </span>
                )}
              </Button>
            }
          >
            <div className="grid gap-1" role="menu" aria-label="Perfil de empresa">
              <p className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Perfil de empresa
              </p>

              <button
                type="button"
                role="menuitemradio"
                aria-checked={companyProfileId === ALL_COMPANIES_ID}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm transition-colors hover:bg-accent",
                  companyProfileId === ALL_COMPANIES_ID && "bg-accent/70",
                )}
                onClick={() => selectProfile(ALL_COMPANIES_ID)}
              >
                <span className="orgAvatar orgAvatar-sm orgAvatar-company flex items-center justify-center">
                  <Building2 className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {ALL_COMPANIES_LABEL}
                </span>
                {companyProfileId === ALL_COMPANIES_ID ? (
                  <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                ) : null}
              </button>

              {organizations.map((organization) => {
                const selected = companyProfileId === organization.id;
                return (
                  <button
                    key={organization.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm transition-colors hover:bg-accent",
                      selected && "bg-accent/70",
                    )}
                    onClick={() => selectProfile(organization.id)}
                  >
                    <OrganizationAvatar
                      name={organization.name}
                      kind={organization.kind}
                      logoUrl={organization.logoUrl}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {organization.name}
                    </span>
                    {selected ? (
                      <Check
                        className="h-4 w-4 shrink-0 text-primary"
                        aria-hidden
                      />
                    ) : null}
                  </button>
                );
              })}

              {onManageOrganization ? (
                <>
                  <div className="my-1 border-t border-border" />
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    onClick={manageOrganization}
                  >
                    <Settings2 className="h-4 w-4 shrink-0" aria-hidden />
                    <span>Gerenciar empresa</span>
                  </button>
                </>
              ) : null}
            </div>
          </Popover>
        </div>
      ) : null}
    </aside>
  );
}
