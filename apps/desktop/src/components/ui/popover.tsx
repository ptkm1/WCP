import { useFloatingMenuPosition } from "@/lib/use-floating-menu-position";
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
import { createPortal } from "react-dom";

export function Popover({
  open,
  onOpenChange,
  trigger,
  children,
  align = "start",
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const position = useFloatingMenuPosition(open, rootRef, contentRef, align);

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

  const content =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={contentRef}
            data-floating-menu=""
            style={position ?? undefined}
            className={cn(
              "z-[250] min-w-[280px] max-w-[calc(100vw-24px)] rounded-2xl border border-border bg-popover p-4 shadow-xl",
              !position && "pointer-events-none opacity-0",
              className,
            )}
          >
            {children}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="relative inline-flex">
      {triggerNode}
      {content}
    </div>
  );
}
