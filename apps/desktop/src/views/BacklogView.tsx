import type { ReactNode } from "react";

export function BacklogView({ children }: { children: ReactNode }) {
  return <section className="panel backlogPanel">{children}</section>;
}
