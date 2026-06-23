# Work Context Platform

Sistema pessoal de gestao de trabalho para desenvolvedor fullstack atuando em um ou mais contextos de empresa, projeto e repositorio.

## Estrutura

- `apps/desktop`: app desktop com Tauri + React
- `apps/mobile`: app mobile com Expo
- `packages/domain`: entidades e tipos de dominio
- `packages/application`: casos de uso
- `packages/db`: schema Drizzle e acesso a dados
- `packages/integrations-git`: leitura de contexto Git local
- `packages/ui`: componentes compartilhados
- `packages/shared`: utilitarios compartilhados
- `docs/adr`: decisoes arquiteturais

## MVP

O bootstrap inicial cobre:

- monorepo com `pnpm`
- desktop macOS-first com Tauri
- mobile com Expo
- modelagem de dominio inicial
- schema Drizzle inicial
- migrations e seed runner locais
- adaptador inicial de Git por CLI
- ADRs principais

## Rodando o desktop com Tauri

### Pre-requisitos

- `pnpm`
- `node`
- `cargo` no `PATH`
- `sqlite3` no `PATH`

### Setup inicial

Na raiz do workspace:

```bash
pnpm install
pnpm setup:desktop
```

Isso cria ou atualiza o banco local em `packages/db/local.db` com schema e seed.

### Subir o app desktop

Comando unico:

```bash
pnpm start:desktop
```

Se quiser separar manualmente:

```bash
pnpm setup:desktop
pnpm dev:desktop:tauri
```

Observacao:

- o shell Tauri agora faz bootstrap automatico do banco local quando `packages/db/local.db` nao existe ou ainda nao possui o schema inicial
- migration e seed ficam embutidos no binario desktop em desenvolvimento, evitando erro de path relativo ao abrir o dashboard

### Comandos uteis

- `pnpm dev:desktop`: sobe apenas o frontend React/Vite do desktop
- `pnpm dev:desktop:tauri`: sobe o shell nativo do Tauri
- `pnpm db:migrate`: aplica migrations no banco local
- `pnpm db:seed`: popula o banco local
- `pnpm typecheck`: valida o monorepo TypeScript

### Reset do banco local

Se quiser resetar o banco de desenvolvimento:

```bash
rm packages/db/local.db
pnpm setup:desktop
```
