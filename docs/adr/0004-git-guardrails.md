# ADR 0004: Guardrails de Git sem Cliente Git Pesado

## Status

Accepted

## Decisao

O produto vai validar identidade Git/SSH por repositorio e sugerir ou aplicar configuracao local, sem implementar fluxo completo de GUI Git.

## Motivo

- foca no problema real de contexto e credencial
- reduz custo de manutencao
- evita competir com IDE e CLI

## Consequencias

- sem diff visual, merge GUI ou staging complexo
- forte foco em validacao pre-push, checklist e contexto de sessao
