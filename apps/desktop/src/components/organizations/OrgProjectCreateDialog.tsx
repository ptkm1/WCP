import { FormDialog } from "@/components/ui/form-dialog";
import {
  SessionFieldInput,
  SessionFieldTextarea,
} from "@/components/ui/form-fields";
import { useEffect, useState } from "react";

export function OrgProjectCreateDialog({
  open,
  onOpenChange,
  busy = false,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy?: boolean;
  onSubmit: (name: string, description: string) => boolean | Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
    }
  }, [open]);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Novo projeto"
      description="Agrupe repositorios relacionados dentro da empresa."
      submitLabel="Criar projeto"
      busy={busy}
      submitDisabled={!name.trim()}
      onSubmit={async () => {
        const success = await onSubmit(name, description);
        if (success) {
          onOpenChange(false);
        }
      }}
    >
      <SessionFieldInput
        label="Nome do projeto"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="IAM Platform"
      />
      <SessionFieldTextarea
        label="Descricao (opcional)"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
    </FormDialog>
  );
}
