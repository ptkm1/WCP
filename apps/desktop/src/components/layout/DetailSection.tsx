import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function DetailSection({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("detailSection", className)}>
      <div className="detailSectionHeader">
        <h3 className="subheading">{title}</h3>
        {action ? <div className="detailSectionAction">{action}</div> : null}
      </div>
      <div className="detailSectionBody">{children}</div>
    </section>
  );
}
