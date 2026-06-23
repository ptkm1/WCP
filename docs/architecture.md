# Arquitetura Inicial

## Apps

- `apps/desktop`: shell principal do MVP, com integracoes locais
- `apps/mobile`: captura e consulta em fases posteriores

## Packages

- `domain`: entidades e contratos
- `application`: casos de uso e regras de agregacao
- `db`: schema e repositorios
- `ui`: componentes compartilhados
- `shared`: helpers utilitarios

## Diretriz

Comecar pelo desktop local-first, depois adicionar sync e mobile sem reestruturar o dominio.
