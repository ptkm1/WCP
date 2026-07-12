import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import * as React from "react";

export interface CheckboxProps extends Omit<
  React.ComponentProps<"input">,
  "type"
> {}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <span className="relative inline-flex h-[18px] w-[18px] shrink-0">
        <input
          type="checkbox"
          ref={ref}
          className={cn("peer sr-only", className)}
          {...props}
        />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 flex items-center justify-center rounded-md border border-input bg-background/90 shadow-sm transition-colors",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
            "peer-checked:border-primary peer-checked:bg-primary",
            "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
            "peer-checked:[&_svg]:opacity-100",
          )}
        >
          <Check className="h-3 w-3 text-primary-foreground opacity-0 transition-opacity" />
        </span>
      </span>
    );
  },
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
