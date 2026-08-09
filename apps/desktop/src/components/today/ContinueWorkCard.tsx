import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRightLeft } from "lucide-react";

export interface ContinueWorkDto {
  workItemId: string;
  title: string;
  externalKey?: string | null;
  organizationId?: string | null;
  organizationName?: string | null;
  repositoryId?: string | null;
  repositoryName?: string | null;
  branchName?: string | null;
  lastActivityAt: string;
  resumeSummary?: string | null;
  stoppedHere?: string | null;
  nextStep?: string | null;
  sessionId?: string | null;
  sessionGoal?: string | null;
  sessionDecisions?: string | null;
  sessionResult?: string | null;
  sessionActive: boolean;
  handoffFromYesterday?: boolean;
}

export function ContinueWorkCard({
  continueWork,
  busy = false,
  formatDateTime,
  onResume,
}: {
  continueWork: ContinueWorkDto;
  busy?: boolean;
  formatDateTime: (value: string | null | undefined) => string;
  onResume: () => void;
}) {
  const ticketLabel = continueWork.externalKey?.trim() || null;
  const stoppedHere = continueWork.stoppedHere?.trim() || null;
  const nextStep = continueWork.nextStep?.trim() || null;
  const hasHandoffNotes = Boolean(stoppedHere || nextStep);
  const eyebrow = continueWork.sessionActive
    ? "Continuar de onde parei"
    : continueWork.handoffFromYesterday
      ? "Ontem voce parou aqui"
      : hasHandoffNotes
        ? "Voce parou aqui"
        : "Continuar de onde parei";

  return (
    <Card className="continueWorkCard border-primary/25 bg-card/95">
      <CardContent className="grid gap-4 p-5">
        <div className="continueWorkHeader flex items-start justify-between gap-3">
          <div className="panelHeading">
            <span className="nextActionEyebrow">{eyebrow}</span>
            <h2 className="text-lg font-semibold leading-snug">
              {ticketLabel
                ? `${ticketLabel} · ${continueWork.title}`
                : continueWork.title}
            </h2>
          </div>
          <Badge variant={continueWork.sessionActive ? "secondary" : "outline"}>
            {continueWork.sessionActive ? "Sessao ativa" : "Ultima sessao"}
          </Badge>
        </div>

        <div className="contextIdentityCard">
          {continueWork.organizationName ? (
            <article>
              <span>Empresa</span>
              <strong>{continueWork.organizationName}</strong>
            </article>
          ) : null}
          {continueWork.repositoryName ? (
            <article>
              <span>Repo</span>
              <strong>{continueWork.repositoryName}</strong>
            </article>
          ) : null}
          {continueWork.branchName ? (
            <article>
              <span>Branch</span>
              <strong>
                <code>{continueWork.branchName}</code>
              </strong>
            </article>
          ) : null}
          <article>
            <span>Ultima atividade</span>
            <strong>{formatDateTime(continueWork.lastActivityAt)}</strong>
          </article>
        </div>

        {hasHandoffNotes ? (
          <div className="grid gap-1">
            {stoppedHere ? (
              <p className="continueWorkResume">{stoppedHere}</p>
            ) : null}
            {nextStep ? (
              <p className="muted continueWorkResume">
                Proximo passo: {nextStep}
              </p>
            ) : null}
          </div>
        ) : continueWork.resumeSummary ? (
          <p className="muted continueWorkResume">
            Retomada: {continueWork.resumeSummary}
          </p>
        ) : continueWork.sessionGoal ? (
          <p className="muted continueWorkResume">
            Objetivo: {continueWork.sessionGoal}
          </p>
        ) : null}

        <div className="actionRow">
          <Button type="button" onClick={onResume} disabled={busy}>
            <ArrowRightLeft className="h-4 w-4" aria-hidden />
            {busy ? "Retomando..." : "Retomar contexto"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
