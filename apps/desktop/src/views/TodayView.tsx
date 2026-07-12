import type { ReactNode } from "react";

export function TodayView({ children }: { children: ReactNode }) {
  return <div className="today-view">{children}</div>;
}
