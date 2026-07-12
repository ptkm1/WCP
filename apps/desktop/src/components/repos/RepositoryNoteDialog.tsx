import { FormDialog } from "@/components/ui/form-dialog";
import {
  SessionFieldInput,
  SessionFieldTextarea,
} from "@/components/ui/form-fields";
import { useEffect, useState } from "react";

export function RepositoryNoteDialog({
  open,
  onOpenChange,
  busy = false,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy?: boolean;
  onSubmit: (title: string, content: string) => boolean | Promise<boolean>;
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
      title="Nova anotacao"
      description="Registre padroes, comandos uteis ou problemas recorrentes deste repo."
      submitLabel="Salvar anotacao"
      busy={busy}
      submitDisabled={!title.trim() || !content.trim()}
      onSubmit={async () => {
        const success = await onSubmit(title, content);
        if (success) {
          onOpenChange(false);
        }
      }}
    >
      <SessionFieldInput
        label="Titulo"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Padrao, comando util ou problema recorrente"
      />
      <SessionFieldTextarea
        label="Conteudo"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Ex.: rodar migrate antes do worker subir em dev"
      />
    </FormDialog>
  );
}
