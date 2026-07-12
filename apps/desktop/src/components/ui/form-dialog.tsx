import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  submitLabel = "Salvar",
  cancelLabel = "Cancelar",
  onSubmit,
  onClose,
  busy = false,
  submitDisabled = false,
  className,
  contentClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit: () => void;
  onClose?: () => void;
  busy?: boolean;
  submitDisabled?: boolean;
  className?: string;
  contentClassName?: string;
}) {
  function handleOpenChange(next: boolean) {
    if (!next) {
      onClose?.();
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={contentClassName}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <div
          className={cn(
            "grid w-full min-w-[min(90vw,18rem)] max-w-[90vw] gap-4 py-1",
            className,
          )}
        >
          {children}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => handleOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            disabled={busy || submitDisabled}
            onClick={onSubmit}
          >
            {busy ? "Salvando..." : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
