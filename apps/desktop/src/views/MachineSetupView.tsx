import { StatusAlert } from "@/components/app-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    FieldCheckbox,
    SessionFieldInput,
    SessionFieldTextarea,
} from "@/components/ui/form-fields";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
    MACHINE_SETUP_CATEGORIES,
    MACHINE_SETUP_CATALOG,
    emptyMachineSetupRecipe,
    stepsForCategory,
    type MachineSetupRecipe,
    type MachineSetupStepId,
} from "@wcp/domain";
import { invoke } from "@tauri-apps/api/core";
import {
    CheckCircle2,
    CircleDashed,
    ClipboardCopy,
    Loader2,
    Play,
    RefreshCw,
    ScrollText,
    XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type ProbeItem = {
  id: string;
  label: string;
  present: boolean;
  detail?: string | null;
  status: string;
};

type ProbeResult = {
  items: ProbeItem[];
  platform: string;
};

type StepResult = {
  stepId: string;
  ok: boolean;
  skipped: boolean;
  message: string;
  details: string[];
};

type RunResult = {
  results: StepResult[];
  okCount: number;
  failCount: number;
  skipCount: number;
};

type ExportResult = {
  script: string;
  selectedStepIds: string[];
  includesSecrets: boolean;
};

function toggleStep(
  recipe: MachineSetupRecipe,
  stepId: MachineSetupStepId,
  checked: boolean,
): MachineSetupRecipe {
  const set = new Set(recipe.selectedStepIds);
  if (checked) {
    set.add(stepId);
  } else {
    set.delete(stepId);
  }
  return { ...recipe, selectedStepIds: Array.from(set) };
}

function recipePayload(recipe: MachineSetupRecipe) {
  return {
    selectedStepIds: recipe.selectedStepIds,
    config: {
      gitUserName: recipe.config.gitUserName ?? null,
      gitUserEmail: recipe.config.gitUserEmail ?? null,
      cloneUrls: recipe.config.cloneUrls ?? [],
      cloneDir: recipe.config.cloneDir ?? null,
      ghToken: recipe.config.ghToken ?? null,
      gitlabToken: recipe.config.gitlabToken ?? null,
      gitlabHost: recipe.config.gitlabHost ?? null,
      sshKeyComment: recipe.config.sshKeyComment ?? null,
      includeSecretsInScript: recipe.config.includeSecretsInScript ?? false,
    },
  };
}

export function MachineSetupView() {
  const [recipe, setRecipe] = useState<MachineSetupRecipe>(() =>
    emptyMachineSetupRecipe(),
  );
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [probeBusy, setProbeBusy] = useState(false);
  const [runBusy, setRunBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [exportedScript, setExportedScript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState(false);

  const selectedCount = recipe.selectedStepIds.length;
  const cloneUrlsText = (recipe.config.cloneUrls ?? []).join("\n");

  const probeById = useMemo(() => {
    const map = new Map<string, ProbeItem>();
    for (const item of probe?.items ?? []) {
      map.set(item.id, item);
    }
    return map;
  }, [probe]);

  const refreshProbe = useCallback(async () => {
    setProbeBusy(true);
    setError(null);
    try {
      const result = await invoke<ProbeResult>("machine_setup_probe");
      setProbe(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProbeBusy(false);
    }
  }, []);

  useEffect(() => {
    void refreshProbe();
  }, [refreshProbe]);

  async function handleRun() {
    setRunBusy(true);
    setError(null);
    setRunResult(null);
    try {
      const result = await invoke<RunResult>("machine_setup_run", {
        recipe: recipePayload(recipe),
      });
      setRunResult(result);
      await refreshProbe();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunBusy(false);
    }
  }

  async function handleExport() {
    setExportBusy(true);
    setError(null);
    setCopyOk(false);
    try {
      const result = await invoke<ExportResult>("machine_setup_export_script", {
        recipe: recipePayload(recipe),
      });
      setExportedScript(result.script);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExportBusy(false);
    }
  }

  async function copyScript() {
    if (!exportedScript) return;
    try {
      await navigator.clipboard.writeText(exportedScript);
      setCopyOk(true);
    } catch {
      setError("Nao foi possivel copiar o script para a area de transferencia.");
    }
  }

  function selectAll() {
    setRecipe((prev) => ({
      ...prev,
      selectedStepIds: MACHINE_SETUP_CATALOG.map((step) => step.id),
    }));
  }

  function clearAll() {
    setRecipe((prev) => ({ ...prev, selectedStepIds: [] }));
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Monte o seu recipe</CardTitle>
          <p className="text-sm text-muted-foreground">
            Tudo e opcional. Marque so o que o usuario hipotetico quer no
            bootstrap desta maquina — ou exporte um script Bash com as mesmas
            escolhas.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {selectedCount} passo{selectedCount === 1 ? "" : "s"} selecionado
              {selectedCount === 1 ? "" : "s"}
            </Badge>
            {probe ? (
              <Badge variant="outline">Plataforma: {probe.platform}</Badge>
            ) : null}
            <div className="ml-auto flex flex-wrap gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={selectAll}>
                Marcar todos
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
                Limpar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void refreshProbe()}
                disabled={probeBusy}
              >
                {probeBusy ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-4 w-4" />
                )}
                Verificar maquina
              </Button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {MACHINE_SETUP_CATEGORIES.map((category) => {
              const steps = stepsForCategory(category.id);
              return (
                <section
                  key={category.id}
                  className="rounded-2xl border border-border/60 bg-background/40 p-4"
                >
                  <header className="mb-3">
                    <h3 className="text-sm font-semibold">{category.label}</h3>
                    <p className="text-xs text-muted-foreground">
                      {category.description}
                    </p>
                  </header>
                  <div className="grid gap-2">
                    {steps.map((step) => {
                      const checked = recipe.selectedStepIds.includes(step.id);
                      const probeItem = probeById.get(step.id);
                      return (
                        <div
                          key={step.id}
                          className={cn(
                            "rounded-xl border px-3 py-2 transition-colors",
                            checked
                              ? "border-primary/40 bg-primary/5"
                              : "border-transparent bg-transparent",
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <FieldCheckbox
                              id={`setup-${step.id}`}
                              label={step.label}
                              checked={checked}
                              onCheckedChange={(value) =>
                                setRecipe((prev) =>
                                  toggleStep(prev, step.id, value),
                                )
                              }
                              className="flex-1 items-start py-0"
                            />
                            {probeItem ? (
                              <Badge
                                variant={
                                  probeItem.present ? "secondary" : "outline"
                                }
                                className="mt-1 shrink-0"
                              >
                                {probeItem.present ? "ok" : "faltando"}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 pl-8 text-xs text-muted-foreground">
                            {step.description}
                          </p>
                          {probeItem?.detail ? (
                            <p className="mt-1 pl-8 text-[11px] text-muted-foreground/80">
                              {probeItem.detail}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Configuracao do recipe</CardTitle>
          <p className="text-sm text-muted-foreground">
            Usada apenas pelos passos que voce marcar. Tokens ficam locais e, por
            padrao, nao entram no script exportado.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <SessionFieldInput
            id="setup-git-name"
            label="Git user.name"
            value={recipe.config.gitUserName ?? ""}
            onChange={(event) =>
              setRecipe((prev) => ({
                ...prev,
                config: { ...prev.config, gitUserName: event.target.value },
              }))
            }
            placeholder="Nome do autor"
          />
          <SessionFieldInput
            id="setup-git-email"
            label="Git user.email"
            value={recipe.config.gitUserEmail ?? ""}
            onChange={(event) =>
              setRecipe((prev) => ({
                ...prev,
                config: { ...prev.config, gitUserEmail: event.target.value },
              }))
            }
            placeholder="dev@empresa.com"
          />
          <SessionFieldInput
            id="setup-clone-dir"
            label="Diretorio dos clones"
            value={recipe.config.cloneDir ?? ""}
            onChange={(event) =>
              setRecipe((prev) => ({
                ...prev,
                config: { ...prev.config, cloneDir: event.target.value },
              }))
            }
            placeholder="~/Projects"
          />
          <SessionFieldInput
            id="setup-ssh-comment"
            label="Comentario da chave SSH"
            value={recipe.config.sshKeyComment ?? ""}
            onChange={(event) =>
              setRecipe((prev) => ({
                ...prev,
                config: { ...prev.config, sshKeyComment: event.target.value },
              }))
            }
            placeholder="opcional — usa o email se vazio"
          />
          <SessionFieldInput
            id="setup-gh-token"
            label="GitHub token (opcional)"
            type="password"
            autoComplete="off"
            value={recipe.config.ghToken ?? ""}
            onChange={(event) =>
              setRecipe((prev) => ({
                ...prev,
                config: { ...prev.config, ghToken: event.target.value },
              }))
            }
            placeholder="ghp_..."
          />
          <SessionFieldInput
            id="setup-glab-token"
            label="GitLab token (opcional)"
            type="password"
            autoComplete="off"
            value={recipe.config.gitlabToken ?? ""}
            onChange={(event) =>
              setRecipe((prev) => ({
                ...prev,
                config: { ...prev.config, gitlabToken: event.target.value },
              }))
            }
            placeholder="glpat-..."
          />
          <SessionFieldInput
            id="setup-gitlab-host"
            label="GitLab host"
            value={recipe.config.gitlabHost ?? ""}
            onChange={(event) =>
              setRecipe((prev) => ({
                ...prev,
                config: { ...prev.config, gitlabHost: event.target.value },
              }))
            }
            placeholder="gitlab.com"
          />
          <div className="md:col-span-2">
            <SessionFieldTextarea
              id="setup-clone-urls"
              label="URLs para clonar (uma por linha)"
              value={cloneUrlsText}
              onChange={(event) =>
                setRecipe((prev) => ({
                  ...prev,
                  config: {
                    ...prev.config,
                    cloneUrls: event.target.value
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean),
                  },
                }))
              }
              placeholder={
                "git@github.com:org/repo.git\ngit@gitlab.com:group/outro.git"
              }
              rows={4}
            />
          </div>
          <FieldCheckbox
            id="setup-include-secrets"
            label="Incluir tokens no script exportado (apenas uso local / pendrive)"
            checked={Boolean(recipe.config.includeSecretsInScript)}
            onCheckedChange={(checked) =>
              setRecipe((prev) => ({
                ...prev,
                config: { ...prev.config, includeSecretsInScript: checked },
              }))
            }
            className="md:col-span-2"
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => void handleRun()}
          disabled={runBusy || selectedCount === 0}
        >
          {runBusy ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-1.5 h-4 w-4" />
          )}
          Executar selecionados
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleExport()}
          disabled={exportBusy || selectedCount === 0}
        >
          {exportBusy ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <ScrollText className="mr-1.5 h-4 w-4" />
          )}
          Gerar script Bash
        </Button>
        {exportedScript ? (
          <Button type="button" variant="ghost" onClick={() => void copyScript()}>
            <ClipboardCopy className="mr-1.5 h-4 w-4" />
            {copyOk ? "Copiado" : "Copiar script"}
          </Button>
        ) : null}
      </div>

      {error ? (
        <StatusAlert status="mismatch" title="Erro">
          {error}
        </StatusAlert>
      ) : null}

      {runResult ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Resultado da execucao</CardTitle>
            <p className="text-sm text-muted-foreground">
              {runResult.okCount} ok · {runResult.failCount} falha
              {runResult.failCount === 1 ? "" : "s"} · {runResult.skipCount}{" "}
              pulado{runResult.skipCount === 1 ? "" : "s"}
            </p>
          </CardHeader>
          <CardContent className="grid gap-2">
            {runResult.results.map((item) => (
              <div
                key={item.stepId}
                className="rounded-xl border border-border/60 px-3 py-2"
              >
                <div className="flex items-start gap-2">
                  {item.skipped ? (
                    <CircleDashed className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  ) : item.ok ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 text-destructive" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.stepId}</p>
                    <p className="text-sm text-muted-foreground">{item.message}</p>
                    {item.details.length > 0 ? (
                      <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                        {item.details.map((detail) => (
                          <li key={detail} className="break-all">
                            {detail}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {exportedScript ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Script gerado</CardTitle>
            <p className="text-sm text-muted-foreground">
              Salve como arquivo `.sh`, rode `chmod +x` e execute em um Mac limpo.
              So inclui os passos marcados no recipe.
            </p>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px] rounded-xl border border-border/60 bg-background/50 p-3">
              <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed">
                {exportedScript}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
