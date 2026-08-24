# AGENTS.md

## Cursor Cloud specific instructions

This is the **Work Context Platform (WCP)** — a pnpm + turbo monorepo. The real product is the
**desktop app** (`apps/desktop`): a Tauri 2 + React/Vite frontend with a Rust backend that shells
out to the `sqlite3` and `git` CLIs. `apps/mobile` is an Expo stub (secondary). Standard commands
live in `README.md` and the various `package.json` scripts — prefer those instead of duplicating.

### Environment / toolchain (baked into the environment snapshot)

- Node, pnpm (`9.12.2`, pinned via `packageManager`), `git`, and `sqlite3` are already present.
- Tauri Linux system libraries are installed (`libwebkit2gtk-4.1-dev`, `libgtk-3-dev`,
  `libayatana-appindicator3-dev`, `librsvg2-dev`, `libxdo-dev`, `libssl-dev`, `build-essential`).
- **Rust:** the Tauri backend's transitive crates require a recent Rust (≥ 1.85, some need ≥ 1.87).
  The default toolchain is set to `stable` via rustup. If `cargo build` ever fails with
  `feature \`edition2024\` is required`, the active toolchain is too old — run `rustup default stable`.
  There is no committed `Cargo.lock` (it is gitignored), so cargo always resolves to newest crates.

### Running the desktop app (GUI)

- Full app (recommended): `pnpm start:desktop` (runs DB migrate, then `tauri dev`, which also starts
  the Vite frontend on port 1420). First Rust build takes a couple of minutes; subsequent runs are fast.
- A display is available at `DISPLAY=:1`. WebKitGTK crashes/rendering issues in this virtualized
  environment are avoided by exporting these before launching:
  `WEBKIT_DISABLE_COMPOSITING_MODE=1` and `WEBKIT_DISABLE_DMABUF_RENDERER=1`. The
  `libEGL warning: DRI3 error` messages are harmless (software rendering).
- Running only `pnpm dev:desktop` (Vite alone) yields a non-functional UI — the frontend talks to
  the Rust backend exclusively via Tauri `invoke`, so the native shell must be running.

### Database gotcha (important)

- `pnpm setup:desktop` runs **migrations only** (schema, no data). The app needs an initial
  `workspace` row; without it the UI shows **"Nenhum workspace configurado"**. For a usable app,
  either run `pnpm setup:desktop:seed` (migrate + seed) / `pnpm db:seed`, **or** delete
  `packages/db/local.db` and launch the app — the Tauri shell auto-bootstraps + seeds a brand-new DB
  on first run (it does not re-seed an existing schema-only DB).
- The DB lives at `packages/db/local.db` (gitignored). Reset with `rm packages/db/local.db` then
  re-run setup. Inspect it directly with the `sqlite3` CLI.

### Lint / typecheck / test

- There is **no ESLint/Prettier and no test framework**. `lint`, `typecheck`, and the non-bundling
  `build` for TS packages are all effectively `tsc --noEmit`. There are no `*.test.*` files;
  `@wcp/integrations-pm`'s `test` script references vitest (not installed) and falls back to `tsc`.
- Root commands: `pnpm typecheck`, `pnpm lint`, `pnpm --filter @wcp/desktop build` (Vite frontend).
- Rust has no `cargo test` wired into npm scripts; it is exercised via `tauri dev` / `cargo build`
  in `apps/desktop/src-tauri`.
