import { FormDialog } from "@/components/ui/form-dialog";
import {
  SessionFieldSelect,
  type FieldSelectOption,
} from "@/components/ui/form-fields";
import { useEffect, useMemo, useState } from "react";

function formatDependencyPreview(
  currentTitle: string,
  relation: "depends_on" | "blocks",
  targetTitle: string,
): string {
  if (relation === "depends_on") {
    return `${currentTitle} depende de ${targetTitle}`;
  }

  return `${currentTitle} bloqueia ${targetTitle}`;
}

export function TaskDependencyDialog({
  open,
  onOpenChange,
  taskTitle,
  taskOptions,
  busy = false,
  error,
  onSubmit,
  onClearError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle: string;
  taskOptions: FieldSelectOption[];
  busy?: boolean;
  error?: string | null;
  onSubmit: (
    relation: "depends_on" | "blocks",
    targetId: string,
  ) => void | Promise<void>;
  onClearError?: () => void;
}) {
  const [relation, setRelation] = useState<"depends_on" | "blocks">(
    "depends_on",
  );
  const [targetId, setTargetId] = useState("");

  useEffect(() => {
    if (!open) {
      setRelation("depends_on");
      setTargetId("");
      onClearError?.();
    }
  }, [onClearError, open]);

  const previewText = useMemo(() => {
    if (!targetId) {
      return null;
    }

    const targetTitle = taskOptions.find(
      (option) => option.value === targetId,
    )?.label;
    if (!targetTitle) {
      return null;
    }

    return formatDependencyPreview(taskTitle, relation, targetTitle);
  }, [relation, targetId, taskOptions, taskTitle]);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Adicionar dependencia"
      description={`Relacione outra tarefa com "${taskTitle}".`}
      submitLabel="Adicionar"
      busy={busy}
      submitDisabled={!targetId}
      onSubmit={() => void onSubmit(relation, targetId)}
    >
      <p className="muted text-sm">
        Esta tarefa: <strong>{taskTitle}</strong>
      </p>
      <SessionFieldSelect
        id="dependency-relation"
        label="Relacao com outra tarefa"
        value={relation}
        onValueChange={(next) => {
          setRelation(next as "depends_on" | "blocks");
          onClearError?.();
        }}
        options={[
          { value: "depends_on", label: "depende de" },
          { value: "blocks", label: "bloqueia" },
        ]}
      />
      <SessionFieldSelect
        id="dependency-target"
        label="Tarefa"
        value={targetId}
        allowEmpty
        emptyLabel="Selecione a tarefa"
        onValueChange={(next) => {
          setTargetId(next);
          onClearError?.();
        }}
        options={taskOptions}
      />
      {previewText ? (
        <p className="dependencyPreview text-sm">{previewText}</p>
      ) : null}
      {error ? <p className="dependencyError text-sm">{error}</p> : null}
    </FormDialog>
  );
}
