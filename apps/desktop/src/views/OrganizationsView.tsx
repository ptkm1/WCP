import type { ReactNode } from "react";

export function OrganizationsView({ children }: { children: ReactNode }) {
  return <section className="panel orgPanel">{children}</section>;
}
