# Proximos Passos do MVP

## Entrega tecnica seguinte

- adicionar repositorios locais com Drizzle
- implementar CRUD real de `work_items`
- implementar CRUD real de `repositories`
- ligar `planToday` e `validateRepositoryIdentity` a adaptadores de infraestrutura
- adicionar parser de remote Git e de `.git/config`

## Guardrails de implementacao

- aplicacao de identidade Git deve atuar apenas com `git config --local`
- validacao deve ser nao-destrutiva
- sync nao deve contaminar o modelo local-first do MVP
