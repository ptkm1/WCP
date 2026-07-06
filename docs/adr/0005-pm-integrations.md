# ADR 0005: Integracoes PM (Jira e ClickUp)

## Status

Accepted

## Decisao

Integrar ferramentas de gestao de projetos (PM) por **empresa** (`organization_id`), espelhando tarefas atribuidas ao usuario como `work_items` com `source_type = 'imported'`. A v1 e **pull-only** (read-only): o WCP importa titulo, status, due date e metadados externos, sem enviar alteracoes de volta ao Jira/ClickUp.

## Modelo

- **`integration_connections`**: uma conexao ativa por provider por empresa (Jira ou ClickUp na v1).
- **Credenciais**: API token no keychain do SO (`credential_key`); o frontend nunca recebe o token.
- **`work_items`**: campos `external_provider`, `external_id`, `external_key`, `external_url`; `scheduled_for` = due date externo.
- **Upsert**: indice unico `(organization_id, external_provider, external_id)` para sync idempotente.

## Arquitetura extensivel

| Camada                                 | Responsabilidade                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| `packages/domain`                      | Tipos `PmProvider`, `IntegrationConnection`, `ExternalTaskSnapshot`            |
| `packages/integrations-pm`             | Mappers puros TS (status, Jira/ClickUp → patch de work_item, alertas de prazo) |
| `apps/desktop/src-tauri/integrations/` | Trait `PmProviderClient`, HTTP, keyring, sync engine                           |

Novos providers (Asana, Trello) = nova impl Rust + entrada no enum `provider`, sem mudar o contrato de sync/UI.

## Regras de sync (v1)

1. Listar apenas tarefas **atribuidas ao usuario** (`assigneeOnly: true`).
2. Excluir fechadas por padrao (`includeClosed: false`).
3. **Status externo vence** sobre edicao local em itens importados.
4. Nao sobrescrever `project_id` / `primary_repository_id` se ja definidos manualmente no WCP.

## Alertas de prazo

- Funcao `buildDeadlineAlerts` em `@wcp/integrations-pm` (faixas: vencido, hoje, em breve).
- View **Hoje**: secao "Prazos das integracoes".
- Notificacao nativa: no maximo uma por work_item por dia por faixa; dedupe via `activity_events` (`event_type = deadline_alert`).

## Fora de escopo v1

- Push de status WCP → Jira/ClickUp
- OAuth (somente email + API token / personal token)
- Webhooks em tempo real
- Mobile (tipos em `packages/` preparam; HTTP fica para fase posterior)

## Consequencias

- Usuario precisa configurar tokens por empresa; sync manual ou automatico (debounce ao abrir Hoje/backlog + intervalo de 30 min).
- Conflitos de status sao previsiveis mas podem surpreender quem editar tarefas importadas localmente — documentado na UI.
- SQLite permanece fonte de verdade local; sync e diagnostico (`last_sync_at`, `last_sync_error`) por conexao.
