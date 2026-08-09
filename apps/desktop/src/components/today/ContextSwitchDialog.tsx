import { StatusAlert } from "@/components/app-ui";
import type { ContinueWorkDto } from "@/components/today/ContinueWorkCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SessionFieldSelect,
  SessionFieldTextarea,
} from "@/components/ui/form-fields";
import { useEffect, useState } from "react";

export type ContextSwitchOriginDto = {
  organizationId?: string | null;
  organizationName?: string | null;
  workItemId?: string | null;
  workItemTitle?: string | null;
  externalKey?: string | null;
  repositoryId?: string | null;
  repositoryName?: string | null;
  branchName?: string | null;
  sessionId?: string | null;
  sessionActive: boolean;
  lastNote?: string | null;
  hasUncommittedChanges: boolean;
  uncommittedCount: number;
};

export type ContextSwitchOrgOption = {
  id: string;
  name: string;
};

export function ContextSwitchDialog({
  open,
  onOpenChange,
  step,
  origin,
  originLoading = false,
  destinationOrgId,
  onDestinationOrgChange,
  organizations,
  destination,
  destinationLoading = false,
  busy = false,
  onRegisterAndSwitch,
  onResume,
  onOpenProjects,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: "origin" | "destination";
  origin: ContextSwitchOriginDto | null;
  originLoading?: boolean;
  destinationOrgId: string;
  onDestinationOrgChange: (orgId: string) => void;
  organizations: ContextSwitchOrgOption[];
  destination: ContinueWorkDto | null;
  destinationLoading?: boolean;
  busy?: boolean;
  onRegisterAndSwitch: (payload: {
    stoppedHere: string;
    nextStep: string;
  }) => void;
  onResume: () => void;
  onOpenProjects: () => void;
}) {
  const [stoppedHere, setStoppedHere] = useState("");
  const [nextStep, setNextStep] = useState("");

  useEffect(() => {
    if (!open) {
      setStoppedHere("");
      setNextStep("");
      return;
    }
    setStoppedHere(origin?.lastNote?.trim() ?? "");
    setNextStep("");
  }, [open, origin?.lastNote, origin?.sessionId]);

  const originTaskLabel = origin
    ? [origin.externalKey?.trim(), origin.workItemTitle?.trim()]
        .filter(Boolean)
        .join(" · ") || null
    : null;

  const destinationTaskLabel = destination
    ? [destination.externalKey?.trim(), destination.title.trim()]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-5 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Trocar contexto</DialogTitle>
          <DialogDescription>
            {step === "origin"
              ? "Registre onde parou antes de mudar de empresa."
              : "Retome o ultimo trabalho na empresa destino."}
          </DialogDescription>
        </DialogHeader>

        {step === "origin" ? (
          originLoading || !origin ? (
            <p className="muted">Montando contexto de origem...</p>
          ) : (
            <div className="grid gap-4">
              <div className="contextIdentityCard">
                {origin.organizationName ? (
                  <article>
                    <span>Empresa</span>
                    <strong>{origin.organizationName}</strong>
                  </article>
                ) : null}
                {originTaskLabel ? (
                  <article>
                    <span>Tarefa</span>
                    <strong>{originTaskLabel}</strong>
                  </article>
                ) : null}
                {origin.repositoryName ? (
                  <article>
                    <span>Repo</span>
                    <strong>{origin.repositoryName}</strong>
                  </article>
                ) : null}
                {origin.branchName ? (
                  <article>
                    <span>Branch</span>
                    <strong>
                      <code>{origin.branchName}</code>
                    </strong>
                  </article>
                ) : null}
              </div>

              {origin.hasUncommittedChanges ? (
                <StatusAlert status="warning" title="Working tree sujo">
                  Ha alteracoes nao commitadas
                  {origin.uncommittedCount > 0
                    ? ` (${origin.uncommittedCount})`
                    : ""}
                  . A troca nao e bloqueada — apenas um aviso.
                </StatusAlert>
              ) : null}

              {origin.lastNote ? (
                <p className="muted text-sm">Ultima nota: {origin.lastNote}</p>
              ) : null}

              <SessionFieldSelect
                label="Empresa destino"
                value={destinationOrgId}
                onValueChange={onDestinationOrgChange}
                allowEmpty
                emptyLabel="Selecione a empresa"
                options={organizations.map((org) => ({
                  value: org.id,
                  label: org.name,
                }))}
              />

              {origin.sessionActive ? (
                <>
                  <SessionFieldTextarea
                    label="Onde voce parou?"
                    value={stoppedHere}
                    onChange={(event) => setStoppedHere(event.target.value)}
                    placeholder="Ex.: Validar Android"
                  />
                  <SessionFieldTextarea
                    label="Proximo passo"
                    value={nextStep}
                    onChange={(event) => setNextStep(event.target.value)}
                    placeholder="Opcional"
                  />
                </>
              ) : null}
            </div>
          )
        ) : destinationLoading ? (
          <p className="muted">Buscando ultimo trabalho na empresa...</p>
        ) : (
          <div className="grid gap-4">
            <SessionFieldSelect
              label="Empresa destino"
              value={destinationOrgId}
              onValueChange={onDestinationOrgChange}
              options={organizations.map((org) => ({
                value: org.id,
                label: org.name,
              }))}
            />

            {destination ? (
              <div className="grid gap-3">
                <div className="contextIdentityCard">
                  {destination.organizationName ? (
                    <article>
                      <span>Empresa</span>
                      <strong>{destination.organizationName}</strong>
                    </article>
                  ) : null}
                  <article>
                    <span>Ultimo trabalho</span>
                    <strong>{destinationTaskLabel}</strong>
                  </article>
                  {destination.repositoryName ? (
                    <article>
                      <span>Repo</span>
                      <strong>{destination.repositoryName}</strong>
                    </article>
                  ) : null}
                  {destination.branchName ? (
                    <article>
                      <span>Branch</span>
                      <strong>
                        <code>{destination.branchName}</code>
                      </strong>
                    </article>
                  ) : null}
                </div>
                {destination.nextStep ? (
                  <p className="text-sm">
                    <span className="font-medium">Proximo passo:</span>{" "}
                    {destination.nextStep}
                  </p>
                ) : destination.resumeSummary ? (
                  <p className="text-sm">
                    <span className="font-medium">Retomada:</span>{" "}
                    {destination.resumeSummary}
                  </p>
                ) : destination.stoppedHere ? (
                  <p className="text-sm">
                    <span className="font-medium">Onde parou:</span>{" "}
                    {destination.stoppedHere}
                  </p>
                ) : null}
              </div>
            ) : (
              <StatusAlert status="warning" title="Sem historico nesta empresa">
                Nao ha sessao ou tarefa recente para retomar. Abra Projetos para
                preparar o contexto.
              </StatusAlert>
            )}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          {step === "origin" ? (
            <Button
              type="button"
              disabled={
                busy ||
                originLoading ||
                !origin ||
                !destinationOrgId.trim() ||
                destinationOrgId === (origin.organizationId ?? "")
              }
              onClick={() =>
                onRegisterAndSwitch({
                  stoppedHere: stoppedHere.trim(),
                  nextStep: nextStep.trim(),
                })
              }
            >
              {busy ? "Trocando..." : "Registrar e trocar"}
            </Button>
          ) : destination ? (
            <Button type="button" disabled={busy} onClick={onResume}>
              {busy ? "Retomando..." : "Retomar"}
            </Button>
          ) : (
            <Button type="button" onClick={onOpenProjects}>
              Abrir Projetos
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
