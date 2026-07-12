import { FormDialog } from "@/components/ui/form-dialog";
import {
  SessionFieldSelect,
  type FieldSelectOption,
} from "@/components/ui/form-fields";
import { useEffect, useState } from "react";

export function PmProjectMappingDialog({
  open,
  onOpenChange,
  busy = false,
  jiraProjectOptions,
  wcpProjectOptions,
  repositoryOptions,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy?: boolean;
  jiraProjectOptions: FieldSelectOption[];
  wcpProjectOptions: FieldSelectOption[];
  repositoryOptions: FieldSelectOption[];
  onSubmit: (draft: {
    externalProjectKey: string;
    projectId: string;
    defaultRepositoryId: string;
  }) => boolean | Promise<boolean>;
}) {
  const [externalProjectKey, setExternalProjectKey] = useState("");
  const [projectId, setProjectId] = useState("");
  const [defaultRepositoryId, setDefaultRepositoryId] = useState("");

  useEffect(() => {
    if (!open) {
      setExternalProjectKey("");
      setProjectId("");
      setDefaultRepositoryId("");
    }
  }, [open]);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Mapear projeto Jira"
      description="Associe um projeto externo a um projeto WCP e repo padrao."
      submitLabel="Salvar mapeamento"
      busy={busy}
      submitDisabled={!externalProjectKey || !projectId}
      onSubmit={async () => {
        const success = await onSubmit({
          externalProjectKey,
          projectId,
          defaultRepositoryId,
        });
        if (success) {
          onOpenChange(false);
        }
      }}
    >
      <SessionFieldSelect
        label="Projeto Jira"
        value={externalProjectKey}
        onValueChange={setExternalProjectKey}
        allowEmpty
        emptyLabel="Selecione"
        options={jiraProjectOptions}
      />
      <SessionFieldSelect
        label="Projeto WCP"
        value={projectId}
        onValueChange={setProjectId}
        allowEmpty
        emptyLabel="Selecione"
        options={wcpProjectOptions}
      />
      <SessionFieldSelect
        label="Repo padrao (opcional)"
        value={defaultRepositoryId}
        onValueChange={setDefaultRepositoryId}
        allowEmpty
        emptyLabel="Nenhum"
        options={repositoryOptions}
      />
    </FormDialog>
  );
}
