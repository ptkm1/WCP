import { StatusAlert } from "@/components/app-ui";
import { LocalPathField } from "@/components/repos/LocalPathField";
import { FormDialog } from "@/components/ui/form-dialog";
import {
  SessionFieldInput,
  SessionFieldSelect,
  type FieldSelectOption,
} from "@/components/ui/form-fields";

export function OrgLinkRepositoryDialog({
  open,
  onOpenChange,
  busy = false,
  projectId,
  onProjectIdChange,
  projectOptions,
  path,
  inspecting,
  repoName,
  remote,
  inspection,
  onPathChange,
  onBrowse,
  onInspect,
  onRepoNameChange,
  onRemoteChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy?: boolean;
  projectId: string;
  onProjectIdChange: (value: string) => void;
  projectOptions: FieldSelectOption[];
  path: string;
  inspecting: boolean;
  repoName: string;
  remote: string;
  inspection: { isGitRepo?: boolean; remoteUrl?: string | null } | null;
  onPathChange: (value: string) => void;
  onBrowse: () => void;
  onInspect: () => void;
  onRepoNameChange: (value: string) => void;
  onRemoteChange: (value: string) => void;
  onSubmit: () => boolean | Promise<boolean>;
}) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Vincular repositorio"
      description="Aponte para uma pasta Git local desta empresa."
      submitLabel="Vincular repo"
      busy={busy}
      submitDisabled={
        !repoName.trim() || !path.trim() || !inspection?.isGitRepo
      }
      onSubmit={async () => {
        const success = await onSubmit();
        if (success) {
          onOpenChange(false);
        }
      }}
    >
      <SessionFieldSelect
        label="Projeto (opcional)"
        value={projectId}
        onValueChange={onProjectIdChange}
        allowEmpty
        emptyLabel="Sem projeto"
        options={projectOptions}
      />
      <LocalPathField
        path={path}
        inspecting={inspecting}
        onPathChange={onPathChange}
        onBrowse={onBrowse}
        onInspect={onInspect}
      />
      <SessionFieldInput
        label="Nome do repositorio"
        value={repoName}
        onChange={(event) => onRepoNameChange(event.target.value)}
      />
      <SessionFieldInput
        label="Remoto (opcional)"
        value={remote}
        onChange={(event) => onRemoteChange(event.target.value)}
      />
      {inspection?.isGitRepo ? (
        <StatusAlert status="ok" title="Repositorio Git detectado">
          {inspection.remoteUrl ?? "Sem remote.origin.url configurado"}
        </StatusAlert>
      ) : null}
    </FormDialog>
  );
}
