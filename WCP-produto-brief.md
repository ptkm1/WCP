# Work Context Platform (WCP) — Brief de produto

Documento para brainstorm de melhorias (ChatGPT / Claude / etc.).
Descreve o produto **como está hoje** e o que o diferencia no mercado.
Não invente features que não estejam listadas aqui como existentes.

---

## Pitch em uma frase

O WCP é um app desktop **local-first** que ajuda quem trabalha em **várias empresas / contextos** a trocar de ambiente com segurança: **empresa certa → repo certo → identidade Git certa → tarefa / foco do dia**, com histórico pesquisável e sync opcional de Jira/ClickUp.

---

## Problema que resolve

Desenvolvedores (e freelancers / consultores) que atuam em mais de um contexto costumam sofrer com:

1. **Identidade Git errada** — commit com email pessoal no repo da empresa (ou o inverso).
2. **SSH / conta errada no push** — a chave ou o host alias aponta para outra conta GitHub/GitLab.
3. **Contexto mental perdido** — “em qual empresa eu estava? qual branch? o que eu decidi ontem?”
4. **Ferramentas fragmentadas** — switcher de conta Git no terminal + Jira/ClickUp no browser + notas soltas, sem um hub.

O WCP une essas pontas num fluxo guiado, sem ser um cliente Git completo (sem staging/diff/merge).

---

## Para quem é

- Quem trabalha em **múltiplas empresas / clientes / projetos pessoais**.
- Quem usa **várias identidades Git** e aliases SSH.
- Quem quer **foco do dia + tarefas** perto do contexto técnico (repo / identidade).
- Preferência por ferramenta **local, privada, offline-friendly** (SQLite no dispositivo).

---

## O que o app faz hoje

### Visões principais

| Tela          | Função                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------- |
| **Hoje**      | Resumo do que importa agora: foco, plano do dia, prazos, retomada, ambiente Git do contexto ativo. |
| **Tarefas**   | Backlog com filtros, detalhe da tarefa (atividade, notas, dependências, artefatos), criar/editar.  |
| **Empresa**   | Cadastro de empresas, projetos, repos, identidade Git e integrações PM.                            |
| **Projetos**  | Wizard de troca/preparação de contexto Git (conferir → aplicar → proteger).                        |
| **Histórico** | Timeline pesquisável de sessões, notas, decisões, artefatos, etc.                                  |

### Empresas e organização

- Cadastro de **empresas** (também pessoal / comunidade).
- Logo, projetos internos, repositórios locais vinculados.
- Perfil Git por empresa (provider, host, alias SSH, user.name, user.email, convenções).
- Hierarquia mental: **Empresa → Perfil Git → Repo → identidade local**.

### Identidade Git (diferencial técnico forte)

O app trata **duas camadas distintas**:

1. **Autor do commit** — `user.name` / `user.email` no repo local.
2. **Autenticação SSH** — `remote.origin.url` com alias (ex.: `git@github_trabalho:org/repo.git`).

Ações disponíveis:

- Salvar identidade no WCP (não altera o repo).
- Importar identidade a partir de um repo já configurado.
- Aplicar identidade no repo.
- Corrigir remoto SSH para o alias do perfil.
- Aplicar contexto completo (identidade + remoto).
- Validar contexto (checks de nome, email, alias, host, branch pattern…).

### Wizard de contexto (Projetos)

Fluxo guiado aproximado:

1. Escolher empresa
2. Escolher repositório
3. Conferir ambiente
4. Aplicar identidade
5. Proteger (hook pre-push)
6. Pronto

### Guardrail pre-push

- Hook gerenciado pelo app.
- Bloqueia push se a identidade local / SSH divergir do perfil esperado.
- Não sobrescreve hooks manuais de terceiros.
- Objetivo: evitar push “na conta errada”, não virar um Git GUI.

### Tarefas, foco e plano do dia

- Tarefas manuais ou importadas (Jira/ClickUp).
- Status, prioridade, bloqueios, dependências.
- Notas, artefatos (links, PRs, commits, tickets…), sessões de foco.
- **Montar meu dia** / plano do dia.
- Alertas de prazo (vencidas, hoje, em breve) + notificação nativa.
- “Ignorar no WCP” (some do foco local sem alterar o Jira/ClickUp).
- Aplicar contexto de uma tarefa (levar para o repo / identidade certos).

### Integrações Jira e ClickUp

- Por empresa.
- **Pull-only** (v1): importa/espelha tarefas; não escreve de volta no PM.
- Credenciais no **Keychain** do SO.
- Testar conexão, filtros de sync, mapeamento projeto PM → projeto WCP.
- Sync ao abrir Hoje/Tarefas e em intervalos.

### Busca e histórico

- Busca global (tarefas, notas, sessões, artefatos, repos…).
- Histórico filtrável para retomar contexto sem depender da tarefa aberta agora.

### Stack (contexto técnico útil para ideias)

- Desktop: **Tauri 2 + React + Vite + Tailwind**.
- Backend local: **Rust** (Git CLI, hooks, HTTP das integrações, keyring).
- Dados: **SQLite** (local-first).
- Monorepo pnpm; foco atual no **desktop macOS**.

---

## Diferencial no mercado

Existem ferramentas que fazem **pedaços**:

- CLIs de troca de conta Git (gitswitch, gitego, git-swap…).
- Git clients com perfis (ex.: GitKraken Profiles).
- PMs (Jira, ClickUp, Linear).
- `includeIf` manual no `.gitconfig`.

O WCP se diferencia por juntar, num app desktop:

1. **Empresa como unidade de contexto** (não só “perfil Git” solto).
2. **SSH e autor de commit como camadas explícitas**, com validação e correção.
3. **Guardrail pre-push** alinhado ao perfil da empresa.
4. **Loop fechado**: o quê (tarefa/prazo) + onde (repo/empresa) + como (identidade) + memória (histórico/sessões).
5. **Local-first / privado**, sync PM opcional e unidirecional.

Em outras palavras: não é só um switcher de conta Git, nem só um espelho de Jira — é um **hub de contexto de trabalho**.

---

## Fora do escopo atual (explícito)

Não pedir como se já existisse:

- Push WCP → Jira/ClickUp (write-back).
- OAuth / webhooks em tempo real.
- Cliente Git completo (diff, merge, staging, blame…).
- Mobile como produto principal (existe seed, foco é desktop).
- Enforcement bloqueante avançado de branch/ticket no pre-push além da identidade.

---

## Ideias já anotadas pelo autor (ainda não implementadas)

- Anotações pessoais mais ricas + histórico consultável para lembrar decisões/branches/commits.
- Possível IA sobre o histórico local para ajudar a responder perguntas (“isso eu já fiz?”) ou sugerir contexto ao retomar uma task.

---

## Prompt sugerido para colar no ChatGPT

Cole o brief acima e, em seguida, algo nesta linha:

```
Com base no brief do WCP acima, aja como product designer + engenheiro sênior.

Quero ideias de melhorias priorizadas para um MVP pessoal / indie, sem inflar escopo.

Entregue:
1. Top 10 melhorias de alto impacto / esforço razoável
2. Para cada ideia: problema, proposta, por que encaixa no diferencial do WCP, esforço (P/M/G), risco
3. Separar: UX polish | produtividade diária | identidade Git / segurança | integrações | histórico / memória / IA
4. Evitar features que transformem o app em Git client completo ou em clone do Jira
5. Destacar 3 "quick wins" e 3 apostas estratégicas de médio prazo

Contexto extra do meu uso real:
- Trabalho em múltiplas empresas (ex.: Carenet, Decathlon)
- Uso aliases SSH e identidades Git diferentes
- Quero retomar contexto rápido e não errar push/commit
```

Ajuste o “contexto extra” com seus hábitos reais antes de enviar.
