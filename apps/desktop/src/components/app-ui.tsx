import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

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

export function FilterTabs<T extends string>({
  value,
  onValueChange,
  items,
  className,
  "aria-label": ariaLabel,
}: {
  value: T;
  onValueChange: (value: T) => void;
  items: Array<{ id: T; label: string }>;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <Tabs value={value} onValueChange={(next) => onValueChange(next as T)}>
      <div className="filterTabsScroll">
        <TabsList
          className={cn(
            "inline-flex h-auto w-max max-w-none flex-nowrap gap-0.5 rounded-xl border border-border/80 bg-muted/25 p-1",
            className,
          )}
          aria-label={ariaLabel}
        >
          {items.map((item) => (
            <TabsTrigger
              key={item.id}
              value={item.id}
              className="shrink-0 whitespace-nowrap rounded-lg border border-transparent px-3 py-1.5 text-xs sm:px-3.5 sm:py-2 sm:text-sm data-[state=active]:border-primary/45 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-glow"
            >
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </Tabs>
  );
}

type MainView = "today" | "backlog" | "repos" | "history";

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
    ["repos", "Projetos", "Git e ambiente"],
    ["history", "Historico", "Retomada transversal"],
  ];

  return (
    <Tabs
      value={value}
      onValueChange={(next) => onValueChange(next as MainView)}
    >
      <TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-transparent p-0 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([view, label, hint]) => (
          <TabsTrigger
            key={view}
            value={view}
            className="h-auto flex-col items-start rounded-2xl border border-border bg-card/60 px-3.5 py-3 text-left data-[state=active]:border-primary/45 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-glow"
          >
            <span className="block text-[15px] font-semibold">{label}</span>
            <span className="block text-xs opacity-80">{hint}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export function SelectableListItem({
  active,
  linked,
  onClick,
  title,
  subtitle,
  children,
}: {
  active?: boolean;
  linked?: boolean;
  onClick: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
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
      <span className="min-w-0 font-semibold text-foreground">{title}</span>
      {subtitle ? (
        <span className="min-w-0 line-clamp-2 text-xs text-muted-foreground">
          {subtitle}
        </span>
      ) : null}
      {children ? (
        <div className="flex min-w-0 w-full flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
      <span className="font-semibold text-foreground">{title}</span>
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
  onClick,
  title,
  detail,
  meta,
}: {
  onClick: () => void;
  title: ReactNode;
  detail?: ReactNode;
  meta: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      role="option"
      className="h-auto w-full flex-col items-start gap-1 rounded-xl px-3 py-2.5 text-left font-normal hover:bg-accent/60"
      onClick={onClick}
    >
      <span className="font-semibold text-foreground">{title}</span>
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
              variant={done ? "success" : active ? "default" : "outline"}
              className="h-5 min-w-5 justify-center rounded-full px-1.5"
            >
              {done ? "✓" : step}
            </Badge>
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
  return (
    <li className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card/40 px-4 py-3">
      <div className="grid gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={TIMELINE_KIND_VARIANT[kind] ?? "outline"}>
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
