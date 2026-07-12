import type { ReactNode } from "react";

export function ReposView({ children }: { children: ReactNode }) {
  return <section className="panel repoPanel">{children}</section>;
}
