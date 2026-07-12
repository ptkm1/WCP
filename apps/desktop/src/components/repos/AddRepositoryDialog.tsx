import { StatusAlert } from "@/components/app-ui";
import { LocalPathField } from "@/components/repos/LocalPathField";
import { FormDialog } from "@/components/ui/form-dialog";
import {
  SessionFieldInput,
  SessionFieldSelect,
  type FieldSelectOption,
} from "@/components/ui/form-fields";

export function AddRepositoryDialog({
  open,
  onOpenChange,
  busy = false,
  projectId,
  onProjectIdChange,
  projectOptions,
  path,
  inspecting,
  name,
  remoteUrl,
  inspection,
  identityWarning,
  error,
  onPathChange,
  onBrowse,
  onInspect,
  onNameChange,
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
  name: string;
  remoteUrl: string;
  inspection: {
    isGitRepo?: boolean;
    remoteUrl?: string | null;
    defaultBranch?: string | null;
  } | null;
  identityWarning?: string | null;
  error?: string | null;
  onPathChange: (value: string) => void;
  onBrowse: () => void;
  onInspect: () => void;
  onNameChange: (value: string) => void;
  onRemoteChange: (value: string) => void;
  onSubmit: () => boolean | Promise<boolean>;
}) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Cadastrar pasta Git"
      description="Aponte para uma pasta Git real da sua maquina."
      submitLabel="Cadastrar"
      busy={busy}
      submitDisabled={!name.trim() || !path.trim() || !inspection?.isGitRepo}
      onSubmit={async () => {
        const success = await onSubmit();
        if (success) {
          onOpenChange(false);
        }
      }}
    >
      <LocalPathField
        path={path}
        inspecting={inspecting}
        onPathChange={onPathChange}
        onBrowse={onBrowse}
        onInspect={onInspect}
      />
      <SessionFieldSelect
        label="Projeto (opcional)"
        value={projectId}
        onValueChange={onProjectIdChange}
        allowEmpty
        emptyLabel="Sem projeto"
        options={projectOptions}
      />
      <SessionFieldInput
        label="Nome do repositorio"
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        placeholder="auth-api"
      />
      <SessionFieldInput
        label="Remoto (opcional)"
        value={remoteUrl}
        onChange={(event) => onRemoteChange(event.target.value)}
        placeholder="git@host:org/repo.git"
      />
      {identityWarning ? (
        <StatusAlert status="warning" title="Identidade local diferente">
          {identityWarning}
        </StatusAlert>
      ) : null}
      {inspection?.isGitRepo ? (
        <StatusAlert status="ok" title="Repositorio Git detectado">
          {inspection.remoteUrl ?? "Sem remote.origin.url configurado"}
          {inspection.defaultBranch
            ? ` · branch ${inspection.defaultBranch}`
            : ""}
        </StatusAlert>
      ) : null}
      {error ? <p className="errorText">{error}</p> : null}
    </FormDialog>
  );
}
