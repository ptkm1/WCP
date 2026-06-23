# ADR 0003: Modelagem Desacoplada de Contexto

## Status

Accepted

## Decisao

`organization`, `project`, `repository` e `work_item` serao modelados como entidades independentes com relacionamentos opcionais.

## Motivo

- resolve monoempresa e multiempresa sem duplicar regra
- evita hierarquia obrigatoria artificial
- melhora flexibilidade para tarefas transversais

## Consequencias

- a UX precisa usar filtros e visoes claras
- a camada de aplicacao precisa lidar bem com nulos e associacoes parciais
