import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function SplitLayout({
  sidebar,
  children,
  className,
  sidebarClassName,
  mainClassName,
}: {
  sidebar: ReactNode;
  children: ReactNode;
  className?: string;
  sidebarClassName?: string;
  mainClassName?: string;
}) {
  return (
    <div className={cn("split-layout", className)}>
      <aside className={cn("split-layout-sidebar", sidebarClassName)}>
        {sidebar}
      </aside>
      <div className={cn("split-layout-main", mainClassName)}>{children}</div>
    </div>
  );
}
