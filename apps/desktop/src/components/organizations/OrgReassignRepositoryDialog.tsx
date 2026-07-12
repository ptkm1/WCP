import { FormDialog } from "@/components/ui/form-dialog";
import {
  SessionFieldSelect,
  type FieldSelectOption,
} from "@/components/ui/form-fields";
import { useEffect, useState } from "react";

export function OrgReassignRepositoryDialog({
  open,
  onOpenChange,
  busy = false,
  repositoryOptions,
  projectOptions,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy?: boolean;
  repositoryOptions: FieldSelectOption[];
  projectOptions: FieldSelectOption[];
  onSubmit: (
    repositoryId: string,
    projectId: string,
  ) => boolean | Promise<boolean>;
}) {
  const [repositoryId, setRepositoryId] = useState("");
  const [projectId, setProjectId] = useState("");

  useEffect(() => {
    if (!open) {
      setRepositoryId("");
      setProjectId("");
    }
  }, [open]);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Reassociar repositorio"
      description="Mova um repositorio para outro projeto desta empresa."
      submitLabel="Reassociar"
      busy={busy}
      submitDisabled={!repositoryId}
      onSubmit={async () => {
        const success = await onSubmit(repositoryId, projectId);
        if (success) {
          onOpenChange(false);
        }
      }}
    >
      <SessionFieldSelect
        label="Repositorio"
        value={repositoryId}
        onValueChange={setRepositoryId}
        allowEmpty
        emptyLabel="Selecione"
        options={repositoryOptions}
      />
      <SessionFieldSelect
        label="Projeto"
        value={projectId}
        onValueChange={setProjectId}
        allowEmpty
        emptyLabel="Sem projeto"
        options={projectOptions}
      />
    </FormDialog>
  );
}
