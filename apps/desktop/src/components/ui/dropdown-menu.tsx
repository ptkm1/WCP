import { cn } from "@/lib/utils";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  type ReactElement,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

export type DropdownMenuItem = {
  id: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

export function DropdownMenu({
  open,
  onOpenChange,
  trigger,
  items,
  align = "end",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  items: DropdownMenuItem[];
  align?: "start" | "end";
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        contentRef.current?.contains(target)
      ) {
        return;
      }
      onOpenChange(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onOpenChange(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onOpenChange]);

  const triggerNode = isValidElement(trigger)
    ? cloneElement(
        trigger as ReactElement<{ onClick?: (event: ReactMouseEvent) => void }>,
        {
          onClick: (event: ReactMouseEvent) => {
            (
              trigger as ReactElement<{
                onClick?: (event: ReactMouseEvent) => void;
              }>
            ).props.onClick?.(event);
            if (!event.defaultPrevented) {
              onOpenChange(!open);
            }
          },
        },
      )
    : trigger;

  return (
    <div ref={rootRef} className="relative inline-flex">
      {triggerNode}
      {open ? (
        <div
          ref={contentRef}
          data-floating-menu=""
          className={cn(
            "absolute top-[calc(100%+6px)] z-[250] min-w-[180px] max-w-[min(280px,calc(100vw-24px))] overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-xl",
            align === "end" ? "right-0" : "left-0",
          )}
          role="menu"
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={cn(
                "flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50",
                item.destructive && "text-destructive hover:bg-destructive/10",
              )}
              onClick={() => {
                if (item.disabled) {
                  return;
                }
                onOpenChange(false);
                item.onClick();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
