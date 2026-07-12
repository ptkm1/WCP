import { FormDialog } from "@/components/ui/form-dialog";
import {
  SessionFieldInput,
  SessionFieldTextarea,
} from "@/components/ui/form-fields";
import { useEffect, useState } from "react";

export function TaskNoteDialog({
  open,
  onOpenChange,
  busy = false,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy?: boolean;
  onSubmit: (title: string, content: string) => void | Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (!open) {
      setTitle("");
      setContent("");
    }
  }, [open]);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nova nota"
      description="Registre uma decisao ou contexto importante desta tarefa."
      submitLabel="Salvar nota"
      busy={busy}
      submitDisabled={!title.trim() || !content.trim()}
      onSubmit={() => void onSubmit(title, content)}
    >
      <SessionFieldInput
        label="Titulo"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Decisao tomada"
      />
      <SessionFieldTextarea
        label="Conteudo"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Ex.: manter invalidação após persistência do novo token"
      />
    </FormDialog>
  );
}
