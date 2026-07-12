import { StatusAlert } from "@/components/app-ui";
import { LocalPathField } from "@/components/repos/LocalPathField";
import { FormDialog } from "@/components/ui/form-dialog";
import { SessionFieldInput } from "@/components/ui/form-fields";

export function EditRepositoryPathDialog({
  open,
  onOpenChange,
  busy = false,
  path,
  inspecting,
  remoteUrl,
  inspection,
  error,
  onPathChange,
  onBrowse,
  onInspect,
  onRemoteChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy?: boolean;
  path: string;
  inspecting: boolean;
  remoteUrl: string;
  inspection: {
    isGitRepo?: boolean;
    remoteUrl?: string | null;
    defaultBranch?: string | null;
  } | null;
  error?: string | null;
  onPathChange: (value: string) => void;
  onBrowse: () => void;
  onInspect: () => void;
  onRemoteChange: (value: string) => void;
  onSubmit: () => boolean | Promise<boolean>;
}) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Alterar pasta local"
      description="Atualize o caminho local deste repositorio."
      submitLabel="Salvar pasta"
      busy={busy}
      submitDisabled={!path.trim() || !inspection?.isGitRepo}
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
      <SessionFieldInput
        label="Remoto (opcional)"
        value={remoteUrl}
        onChange={(event) => onRemoteChange(event.target.value)}
        placeholder="git@host:org/repo.git"
      />
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
