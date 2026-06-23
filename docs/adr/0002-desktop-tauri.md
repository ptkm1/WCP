# ADR 0002: Desktop com Tauri

## Status

Accepted

## Decisao

Usar `Tauri + React` para o desktop.

## Motivo

- melhor integracao local para Git e SSH
- menor custo de memoria que Electron
- suficiente para macOS-first e Windows depois

## Consequencias

- integracoes nativas ficam no lado Rust
- a UI continua em TypeScript compartilhavel
