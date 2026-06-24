import { cn } from "@/lib/utils";
import * as React from "react";

const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.ComponentProps<"select">
>(({ className, ...props }, ref) => {
  return <select ref={ref} className={cn("appSelect", className)} {...props} />;
});
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
