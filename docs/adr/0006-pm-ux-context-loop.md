# ADR 0006: PM UX — loop de contexto de trabalho

## Status

Accepted

## Contexto

Com Jira/ClickUp integrados (ADR 0005), o WCP passou a espelhar tarefas importadas, mas a experiência ainda tratava PM e contexto Git como mundos separados. O diferencial do produto é fechar o loop: ticket (o quê/quando) + empresa/projeto/repo (onde/como) + identidade Git + sessão/histórico.

## Decisões

### 1. Priorização por prazo no foco do dia

- `build_today_plan` ordena tarefas executáveis por score de prazo (vencido > hoje > em breve) antes de prioridade numérica.
- `resolve_focus_task` sugere tarefa importada com prazo vencido/hoje quando não há sessão ativa nem tarefa `doing`.
- `TodayFocusDto` expõe `deadlineSignals` e `suggestedByDeadline`.

### 2. Plano do dia persistido

- Reutiliza `daily_plans` + `daily_plan_items` existentes.
- Comando `commit_today_plan_command` grava até N tarefas; `load_dashboard_data` prefere plano persistido do dia atual.
- Botão **Montar meu dia** na view Hoje seleciona top tarefas importadas com prazo.

### 3. Tarefa importada → contexto em 1 clique

- Comando `apply_work_item_context`: exige `primary_repository_id`; aplica `apply_repository_full_context`.
- UI: **Aplicar contexto completo** e **Iniciar foco** no painel da tarefa importada.
- Dropdown para vincular repo quando ausente.

### 4. Inferência ticket ↔ branch (Jira-first)

- Parser compartilhado `extract_ticket_keys_from_branch` (TS + Rust).
- Guardrail: check `ticketBranchMatch` — branch contém key presente no backlog importado da org.
- `start_session` retorna `suggestedWorkItemId` quando branch contém ticket sem `work_item_id` informado.
- ClickUp: `external_key` numérico — matching por branch limitado; vínculo manual permanece.

### 5. Mapeamento Jira project → projeto WCP

- Tabela `pm_project_mappings` (`organization_id`, `external_project_key`, `project_id`, `default_repository_id`).
- Sync Jira pede campo `project`; no INSERT de work_item importado, resolve `project_id` e `primary_repository_id` via mapping se NULL.
- Overrides manuais preservados no UPDATE (regra ADR 0005).

### 6. Guardrails enriquecidos

- Branch pattern: tenta regex (`regex` crate) antes do fallback de prefixos.
- Checks adicionais (warning only): `prConvention` com ticket na branch/commit; `commitConvention` conventional commits no último subject.
- Pre-push hook: sem mudança nesta fase (branch pattern no hook fica para iteração futura).

### 7. Triagem e visibilidade

- Backlog: filtros origem (manual/imported/jira/clickup), prazo, sort por `scheduled_for`.
- Prazos na view Hoje agrupados por empresa.
- Sessões no histórico exibem `external_key` do work item vinculado.
- Auto-filtro do backlog pela empresa selecionada na aba Empresas.

### 8. Wizard de integrações

- Fluxo guiado em 6 passos na aba Integrações (provider → testar → salvar → filtros → sync → revisar).
- Seção de mapeamento de projetos Jira após primeiro sync.

## Fora de escopo (permanece ADR 0005)

- Push de status WCP → Jira/ClickUp
- Webhooks em tempo real
- OAuth
- Enforcement blocking no pre-push para branch/ticket

## Consequências

- Usuário consegue ir do ticket PM ao contexto Git em 1–2 cliques.
- Tarefas importadas editadas localmente continuam sujeitas ao sync pull-only (status externo vence).
- Mapeamento Jira project exige ao menos um sync para listar project keys detectadas.
