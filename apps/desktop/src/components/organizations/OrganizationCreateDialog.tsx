import { FormDialog } from "@/components/ui/form-dialog";
import {
  ORG_KIND_OPTIONS,
  SessionFieldInput,
  SessionFieldSelect,
} from "@/components/ui/form-fields";
import { useEffect, useState } from "react";

export function OrganizationCreateDialog({
  open,
  onOpenChange,
  busy = false,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy?: boolean;
  onSubmit: (name: string, kind: string) => boolean | Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState("company");

  useEffect(() => {
    if (!open) {
      setName("");
      setKind("company");
    }
  }, [open]);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nova empresa"
      description="Cadastre uma empresa para organizar projetos e repositorios."
      submitLabel="Criar empresa"
      busy={busy}
      submitDisabled={!name.trim()}
      onSubmit={async () => {
        const success = await onSubmit(name, kind);
        if (success) {
          onOpenChange(false);
        }
      }}
    >
      <SessionFieldInput
        label="Nome"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Empresa A"
      />
      <SessionFieldSelect
        label="Tipo"
        value={kind}
        onValueChange={setKind}
        options={[...ORG_KIND_OPTIONS]}
      />
    </FormDialog>
  );
}
