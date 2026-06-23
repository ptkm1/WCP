# ADR 0001: Local-First no MVP

## Status

Accepted

## Decisao

Usar `SQLite` local como fonte primaria de dados no MVP.

## Motivo

- reduz complexidade inicial
- permite operacao offline
- acelera iteracao no desktop
- preserva privacidade

## Consequencias

- sincronizacao entra depois como camada adicional
- backup/export local precisa existir cedo
