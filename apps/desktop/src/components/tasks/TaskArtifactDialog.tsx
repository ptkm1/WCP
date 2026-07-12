import { FormDialog } from "@/components/ui/form-dialog";
import { SessionFieldInput } from "@/components/ui/form-fields";
import { useEffect, useState } from "react";

export function TaskArtifactDialog({
  open,
  onOpenChange,
  busy = false,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy?: boolean;
  onSubmit: (title: string, url: string) => void | Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!open) {
      setTitle("");
      setUrl("");
    }
  }, [open]);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Anexar link"
      description="Adicione PRs, documentos ou outros links uteis."
      submitLabel="Anexar link"
      busy={busy}
      submitDisabled={!url.trim()}
      onSubmit={() => void onSubmit(title, url)}
    >
      <SessionFieldInput
        label="Titulo"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="PR, doc, link"
      />
      <SessionFieldInput
        label="URL"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://..."
      />
    </FormDialog>
  );
}
