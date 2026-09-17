import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function AppShell({
  sidebar,
  topBar,
  children,
  className,
}: {
  sidebar: ReactNode;
  topBar?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("app-shell", className)}>
      <div
        className="app-titlebar-drag"
        data-tauri-drag-region
        aria-hidden="true"
      />
      {sidebar}
      <div className="app-main">
        {topBar}
        <div className="app-main-content">{children}</div>
      </div>
    </div>
  );
}
