import { StatusAlert } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  buildRepoPreflightRows,
  summarizePreflight,
  type PreflightRow,
} from "@/lib/repo-preflight";
import { AlertTriangle, Check } from "lucide-react";

type ValidationCheck = {
  key: string;
  status: string;
  expected?: string | null;
  actual?: string | null;
  message: string;
};

type GuardrailLike = {
  expectedGitUserName?: string | null;
  expectedGitUserEmail?: string | null;
  expectedSshHostAlias?: string | null;
  remoteUrl?: string | null;
  validation?: {
    status: string;
    checks: ValidationCheck[];
  } | null;
} | null;

type HookLike = {
  installed?: boolean;
  managedByApp?: boolean;
} | null;

function PreflightIcon({ status }: { status: PreflightRow["status"] }) {
  if (status === "ok") {
    return <Check className="h-4 w-4 text-emerald-400" aria-hidden />;
  }
  if (status === "warning") {
    return <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden />;
  }
  return <span className="text-muted-foreground">·</span>;
}

export function RepoPreflightCard({
  repositoryName,
  organizationName,
  guardrail,
  hookStatus,
  currentBranch,
  loading = false,
  fixing = false,
  onFix,
}: {
  repositoryName: string;
  organizationName?: string | null;
  guardrail: GuardrailLike;
  hookStatus: HookLike;
  currentBranch?: string | null;
  loading?: boolean;
  fixing?: boolean;
  onFix: () => void;
}) {
  const rows = buildRepoPreflightRows({
    guardrail,
    hookStatus,
    currentBranch,
    loading,
  });
  const summary = summarizePreflight(rows);

  return (
    <Card className="repoPreflightCard border-primary/20 bg-card/95">
      <CardContent className="grid gap-4 p-5">
        <div className="panelHeading">
          <span className="nextActionEyebrow">Ambiente</span>
          <h3 className="text-lg font-semibold leading-snug">
            {organizationName
              ? `${organizationName} · ${repositoryName}`
              : repositoryName}
          </h3>
          <p className="muted">Preflight check do contexto Git selecionado.</p>
        </div>

        <ul className="repoPreflightList">
          {rows.map((row) => (
            <li
              key={row.id}
              className={`repoPreflightItem repoPreflightItem-${row.status}`}
            >
              <PreflightIcon status={row.status} />
              <div>
                <strong>{row.label}</strong>
                <span>
                  {row.id === "branch" ||
                  row.id === "ssh" ||
                  row.id === "remote" ? (
                    <code>{row.value}</code>
                  ) : (
                    row.value
                  )}
                </span>
              </div>
            </li>
          ))}
        </ul>

        {loading ? (
          <StatusAlert status="warning" title="Conferindo ambiente">
            Validando identidade, remoto e protecao deste repositorio.
          </StatusAlert>
        ) : summary.ok ? (
          <StatusAlert status="ok" title="Contexto seguro">
            Identidade, SSH, remoto e guardrail estao alinhados com o perfil.
          </StatusAlert>
        ) : (
          <StatusAlert
            status="warning"
            title={`${summary.divergenceCount} divergencia${summary.divergenceCount === 1 ? "" : "s"}`}
          >
            <ul className="repoPreflightDivergences">
              {summary.divergences.map((row) => (
                <li key={`div-${row.id}`}>
                  <strong>{row.label}:</strong> {row.value}
                </li>
              ))}
            </ul>
          </StatusAlert>
        )}

        {!loading && !summary.ok ? (
          <div className="actionRow">
            <Button type="button" onClick={onFix} disabled={fixing}>
              {fixing ? "Corrigindo..." : "Corrigir contexto"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
