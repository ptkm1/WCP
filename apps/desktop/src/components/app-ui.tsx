import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CONTEXT_STEP_ICONS,
  getHistoryKindIcon,
  getSearchKindIcon,
  MAIN_VIEW_ICONS,
  type MainView,
} from "@/lib/app-icons";
import { getOrganizationAccent } from "@/lib/org-accent";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Search,
  type LucideIcon,
} from "lucide-react";
import { useEffect, type ComponentProps, type ReactNode } from "react";

export type StatusKind = "ok" | "warning" | "mismatch" | string;

const STATUS_ALERT_VARIANT: Record<
  string,
  "success" | "warning" | "mismatch" | "destructive"
> = {
  ok: "success",
  warning: "warning",
  mismatch: "mismatch",
};

const STATUS_ALERT_ICON: Record<string, LucideIcon> = {
  ok: CheckCircle2,
  warning: AlertTriangle,
  mismatch: AlertTriangle,
};

export function StatusAlert({
  status,
  title,
  children,
  className,
}: {
  status: StatusKind;
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const variant = STATUS_ALERT_VARIANT[status] ?? "warning";
  const Icon = STATUS_ALERT_ICON[status] ?? AlertTriangle;

  return (
    <Alert variant={variant} className={className}>
      <Icon className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

export function StatusBadge({
  variant,
  children,
  className,
}: {
  variant: "live" | "idle" | "blocked";
  children: ReactNode;
  className?: string;
}) {
  const badgeVariant =
    variant === "live"
      ? "success"
      : variant === "blocked"
        ? "destructive"
        : "secondary";

  return (
    <Badge
      variant={badgeVariant}
      className={cn("rounded-full px-2.5", className)}
    >
      {children}
    </Badge>
  );
}

export function PlanStatusBadge({
  committed,
  children,
}: {
  committed: boolean;
  children: ReactNode;
}) {
  return (
    <Badge variant={committed ? "success" : "outline"} className="mt-1">
      {children}
    </Badge>
  );
}

export function SectionTitle({
  icon: Icon,
  children,
  className,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "backlogSidebarTitle inline-flex items-center gap-2",
        className,
      )}
    >
      {Icon ? (
        <Icon className="h-4 w-4 shrink-0 text-primary/75" aria-hidden />
      ) : null}
      <span>{children}</span>
    </p>
  );
}

export function SearchField({
  wrapperClassName,
  className,
  ...props
}: ComponentProps<"input"> & { wrapperClassName?: string }) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input {...props} className={cn("globalSearchInput pl-9", className)} />
    </div>
  );
}

export function PageHeader({
  view,
  title,
  hint,
}: {
  view: MainView;
  title: string;
  hint: string;
}) {
  const Icon = MAIN_VIEW_ICONS[view];

  return (
    <header className="pageHeader mb-5">
      <h1 className="mb-1.5 flex items-center gap-3 text-3xl font-semibold tracking-tight">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        {title}
      </h1>
      <p className="text-sm leading-relaxed text-muted-foreground">{hint}</p>
    </header>
  );
}

export function FilterTabs<T extends string>({
  value,
  onValueChange,
  items,
  className,
  "aria-label": ariaLabel,
}: {
  value: T;
  onValueChange: (value: T) => void;
  items: Array<{ id: T; label: string; icon?: LucideIcon }>;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <Tabs value={value} onValueChange={(next) => onValueChange(next as T)}>
      <div className="filterTabsScroll">
        <TabsList
          className={cn(
            "inline-flex h-auto w-full max-w-full flex-wrap gap-1 rounded-xl border border-border/80 bg-muted/25 p-1",
            className,
          )}
          aria-label={ariaLabel}
        >
          {items.map((item) => {
            const Icon = item.icon;

            return (
              <TabsTrigger
                key={item.id}
                value={item.id}
                className="shrink-0 gap-1.5 whitespace-nowrap rounded-lg border border-transparent px-3 py-1.5 text-xs sm:px-3.5 sm:py-2 sm:text-sm data-[state=active]:border-primary/45 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-glow"
              >
                {Icon ? (
                  <Icon
                    className="h-3.5 w-3.5 shrink-0 opacity-80"
                    aria-hidden
                  />
                ) : null}
                {item.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>
    </Tabs>
  );
}

export function MainViewTabs({
  value,
  onValueChange,
}: {
  value: MainView;
  onValueChange: (view: MainView) => void;
}) {
  const items: Array<[MainView, string, string]> = [
    ["today", "Hoje", "Resumo e foco"],
    ["backlog", "Tarefas", "Historico e contexto"],
    ["organizations", "Empresa", "Cadastro e contexto"],
    ["repos", "Projetos", "Git e ambiente"],
    ["history", "Historico", "Retomada transversal"],
  ];

  return (
    <Tabs
      value={value}
      onValueChange={(next) => onValueChange(next as MainView)}
    >
      <TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-transparent p-0 sm:grid-cols-2 lg:grid-cols-5">
        {items.map(([view, label, hint]) => {
          const Icon = MAIN_VIEW_ICONS[view];

          return (
            <TabsTrigger
              key={view}
              value={view}
              className="h-auto flex-col items-start rounded-2xl border border-border bg-card/60 px-3.5 py-3 text-left data-[state=active]:border-primary/45 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-glow"
            >
              <span className="mb-1 flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                <span className="block text-[15px] font-semibold">{label}</span>
              </span>
              <span className="block pl-6 text-xs opacity-80">{hint}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}

export function OrganizationAvatar({
  name,
  kind,
  logoUrl,
  size = "md",
  className,
}: {
  name: string;
  kind?: string | null;
  logoUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const initials = buildOrganizationInitials(name);
  const sizeClass =
    size === "xs"
      ? "orgAvatar-xs"
      : size === "sm"
        ? "orgAvatar-sm"
        : size === "lg"
          ? "orgAvatar-lg"
          : "orgAvatar-md";

  return (
    <span
      className={cn(
        "orgAvatar",
        sizeClass,
        `orgAvatar-${kind ?? "company"}`,
        className,
      )}
      aria-hidden={logoUrl ? undefined : true}
      title={name}
    >
      {logoUrl ? (
        <img src={logoUrl} alt="" className="orgAvatarImage" />
      ) : (
        <span className="orgAvatarFallback">{initials}</span>
      )}
    </span>
  );
}

function buildOrganizationInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function OrganizationBadge({
  name,
  organizationId,
  kind,
  logoUrl,
  className,
}: {
  name: string;
  organizationId?: string | null;
  kind?: string | null;
  logoUrl?: string | null;
  className?: string;
}) {
  const accent = organizationId ? getOrganizationAccent(organizationId) : null;

  return (
    <span
      className={cn(
        "inline-flex max-w-[132px] min-w-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none",
        accent
          ? [accent.bg, accent.border, accent.text]
          : "border-border bg-muted/40 text-muted-foreground",
        className,
      )}
      title={name}
    >
      <OrganizationAvatar
        name={name}
        kind={kind}
        logoUrl={logoUrl}
        size="xs"
        className="shrink-0"
      />
      <span className="truncate">{name}</span>
    </span>
  );
}

export function SelectableListItem({
  active,
  linked,
  onClick,
  title,
  subtitle,
  leading,
  children,
}: {
  active?: boolean;
  linked?: boolean;
  onClick: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "h-auto w-full min-w-0 flex-col items-start gap-1.5 rounded-2xl border px-4 py-3 text-left font-normal whitespace-normal hover:bg-accent/40",
        active &&
          "border-primary/45 bg-primary/10 shadow-glow hover:bg-primary/10",
        linked && !active && "border-dashed border-primary/25",
      )}
      onClick={onClick}
    >
      <div className="flex min-w-0 w-full items-start gap-3">
        {leading}
        <div className="min-w-0 flex-1">
          <span className="block min-w-0 truncate font-semibold text-foreground">
            {title}
          </span>
          {subtitle ? (
            <span className="mt-1 block min-w-0 truncate text-xs text-muted-foreground">
              {subtitle}
            </span>
          ) : null}
        </div>
      </div>
      {children ? (
        <div className="flex min-w-0 w-full flex-wrap items-center gap-2 pl-0 text-xs text-muted-foreground">
          {leading ? <span className="orgAvatar-spacer" aria-hidden /> : null}
          {children}
        </div>
      ) : null}
    </Button>
  );
}

const HISTORY_KIND_STYLES: Record<string, string> = {
  session: "border-l-primary/70",
  decision: "border-l-blue-400/70",
  note: "border-l-zinc-400/70",
  artifact: "border-l-emerald-400/70",
  block: "border-l-purple-400/70",
  dependency: "border-l-red-400/70",
  repository: "border-l-cyan-400/70",
  task: "border-l-amber-400/70",
};

export function HistoryEventButton({
  kind,
  onClick,
  meta,
  title,
  detail,
  context,
}: {
  kind: string;
  onClick: () => void;
  meta: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  context?: ReactNode;
}) {
  const KindIcon = getHistoryKindIcon(kind);

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "h-auto w-full flex-col items-start gap-1 rounded-xl border border-border bg-card/50 px-4 py-3 text-left font-normal hover:bg-accent/50",
        "border-l-4",
        HISTORY_KIND_STYLES[kind] ?? "border-l-muted-foreground/40",
      )}
      onClick={onClick}
    >
      <span className="text-xs text-muted-foreground">{meta}</span>
      <span className="flex items-start gap-2 font-semibold text-foreground">
        <KindIcon
          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <span className="min-w-0">{title}</span>
      </span>
      {detail ? (
        <span className="text-sm text-muted-foreground">{detail}</span>
      ) : null}
      {context ? (
        <span className="text-xs text-primary/80">{context}</span>
      ) : null}
    </Button>
  );
}

export function SearchResultButton({
  kind,
  onClick,
  title,
  detail,
  meta,
}: {
  kind?: string;
  onClick: () => void;
  title: ReactNode;
  detail?: ReactNode;
  meta: ReactNode;
}) {
  const KindIcon = kind ? getSearchKindIcon(kind) : null;

  return (
    <Button
      type="button"
      variant="ghost"
      role="option"
      className="h-auto w-full flex-col items-start gap-1 rounded-xl px-3 py-2.5 text-left font-normal hover:bg-accent/60"
      onClick={onClick}
    >
      <span className="flex items-start gap-2 font-semibold text-foreground">
        {KindIcon ? (
          <KindIcon
            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        ) : null}
        <span className="min-w-0">{title}</span>
      </span>
      {detail ? (
        <span className="text-sm text-muted-foreground">{detail}</span>
      ) : null}
      <span className="text-xs text-muted-foreground">{meta}</span>
    </Button>
  );
}

export function ContextStepsBar({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
}: {
  steps: ReadonlyArray<{ step: number; label: string }>;
  currentStep: number;
  completedSteps: Set<number>;
  onStepClick: (step: number) => void;
}) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="list"
      aria-label="Passos de troca de contexto"
    >
      {steps.map(({ step, label }) => {
        const done = completedSteps.has(step);
        const active = currentStep === step;
        const StepIcon = CONTEXT_STEP_ICONS[step];

        return (
          <Button
            key={step}
            type="button"
            role="listitem"
            variant={active ? "default" : done ? "secondary" : "outline"}
            size="sm"
            className="gap-2 rounded-full"
            onClick={() => onStepClick(step)}
          >
            <Badge
              variant="outline"
              className={cn(
                "h-5 min-w-5 justify-center rounded-full px-1.5",
                active &&
                  "border-transparent bg-background text-primary shadow-none",
                done &&
                  !active &&
                  "border-transparent bg-primary/15 text-primary shadow-none",
                !done &&
                  !active &&
                  "border-border bg-transparent text-muted-foreground",
              )}
            >
              {done ? <Check className="h-3 w-3" aria-hidden /> : step}
            </Badge>
            {StepIcon ? (
              <StepIcon
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  active
                    ? "text-primary-foreground"
                    : "text-current opacity-80",
                )}
                aria-hidden
              />
            ) : null}
            {label}
          </Button>
        );
      })}
    </div>
  );
}

const TIMELINE_KIND_LABEL: Record<string, string> = {
  session: "Sessao",
  note: "Nota",
  artifact: "Artefato",
  dependency: "Dependencia",
  block: "Bloqueio",
  change: "Alteracao",
};

const TIMELINE_KIND_VARIANT: Record<
  string,
  "default" | "secondary" | "success" | "warning" | "destructive" | "outline"
> = {
  session: "success",
  note: "secondary",
  artifact: "outline",
  dependency: "warning",
  block: "destructive",
  change: "outline",
};

export function TimelineEntry({
  kind,
  title,
  detail,
  when,
}: {
  kind: string;
  title: ReactNode;
  detail: ReactNode;
  when: ReactNode;
}) {
  const KindIcon = getHistoryKindIcon(kind);

  return (
    <li className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card/40 px-4 py-3">
      <div className="grid gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={TIMELINE_KIND_VARIANT[kind] ?? "outline"}
            className="gap-1"
          >
            <KindIcon className="h-3 w-3" aria-hidden />
            {TIMELINE_KIND_LABEL[kind] ?? kind}
          </Badge>
          <strong className="text-sm">{title}</strong>
        </div>
        <span className="text-sm text-muted-foreground">{detail}</span>
      </div>
      <code className="shrink-0 text-xs text-muted-foreground">{when}</code>
    </li>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [busy, onCancel, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="confirmDialogOverlay"
      role="presentation"
      onClick={() => {
        if (!busy) {
          onCancel();
        }
      }}
    >
      <div
        className="confirmDialogPanel panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirmDialogHeader">
          <AlertTriangle
            className={cn(
              "h-5 w-5",
              destructive ? "text-destructive" : "text-primary",
            )}
            aria-hidden
          />
          <h2 id="confirm-dialog-title" className="confirmDialogTitle">
            {title}
          </h2>
        </div>
        <div
          id="confirm-dialog-description"
          className="confirmDialogDescription"
        >
          {description}
        </div>
        <div className="confirmDialogActions">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Excluindo..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
