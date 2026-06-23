INSERT OR REPLACE INTO workspaces (id, name, created_at, updated_at)
VALUES ('ws-1', 'Patrick Workspace', '2026-06-22T21:50:00.000Z', '2026-06-22T21:50:00.000Z');

INSERT OR REPLACE INTO organizations (id, workspace_id, name, kind, is_active, created_at, updated_at)
VALUES
  ('org-a', 'ws-1', 'Empresa A', 'company', 1, '2026-06-22T21:50:00.000Z', '2026-06-22T21:50:00.000Z'),
  ('org-b', 'ws-1', 'Empresa B', 'company', 1, '2026-06-22T21:50:00.000Z', '2026-06-22T21:50:00.000Z');

INSERT OR REPLACE INTO projects (id, workspace_id, organization_id, name, description, is_active, created_at, updated_at)
VALUES
  ('proj-iam', 'ws-1', 'org-a', 'IAM Core', 'Fluxos de autenticacao e autorizacao', 1, '2026-06-22T21:50:00.000Z', '2026-06-22T21:50:00.000Z'),
  ('proj-web', 'ws-1', 'org-b', 'Web App', 'Aplicacao web principal', 1, '2026-06-22T21:50:00.000Z', '2026-06-22T21:50:00.000Z');

INSERT OR REPLACE INTO repositories (id, workspace_id, organization_id, project_id, name, local_path, provider_type, provider_host, remote_url, default_branch, is_active, created_at, updated_at)
VALUES
  ('repo-auth-api', 'ws-1', 'org-a', 'proj-iam', 'auth-api', '/Users/goker/Code/auth-api', 'github', 'github.empresa-a.com', 'git@empresaA-github:iam/auth-api.git', 'main', 1, '2026-06-22T21:50:00.000Z', '2026-06-22T21:50:00.000Z'),
  ('repo-web-app', 'ws-1', 'org-b', 'proj-web', 'web-app', '/Users/goker/Code/web-app', 'github', 'github.com', 'git@github.com:empresa-b/web-app.git', 'main', 1, '2026-06-22T21:50:00.000Z', '2026-06-22T21:50:00.000Z');

INSERT OR REPLACE INTO environment_profiles (id, workspace_id, organization_id, name, provider_type, provider_host, ssh_host_alias, git_user_name, git_user_email, branch_pattern, pr_convention, commit_convention, is_default, created_at, updated_at)
VALUES
  ('env-1', 'ws-1', 'org-a', 'Empresa A', 'github', 'github.empresa-a.com', 'empresaA-github', 'ptkm1', 'dev@empresa-a.com', '^(feat|fix|chore)/.+$', 'PR com ticket no titulo', 'conventional commits', 1, '2026-06-22T21:50:00.000Z', '2026-06-22T21:50:00.000Z'),
  ('env-2', 'ws-1', 'org-b', 'Empresa B', 'github', 'github.com', 'github.com', 'goker-b', 'dev@empresa-b.com', '^(feat|fix|chore)/.+$', 'PR com review obrigatorio', 'conventional commits', 1, '2026-06-22T21:50:00.000Z', '2026-06-22T21:50:00.000Z');

INSERT OR REPLACE INTO repository_identities (id, repository_id, environment_profile_id, git_user_name, git_user_email, ssh_host_alias, provider_username, provider_account_label, enforce_pre_push_check, created_at, updated_at)
VALUES
  ('rid-1', 'repo-auth-api', 'env-1', 'ptkm1', 'dev@empresa-a.com', 'empresaA-github', 'ptkm1', 'empresa-a', 1, '2026-06-22T21:50:00.000Z', '2026-06-22T21:50:00.000Z'),
  ('rid-2', 'repo-web-app', 'env-2', 'goker-b', 'dev@empresa-b.com', 'github.com', 'goker-b', 'empresa-b', 1, '2026-06-22T21:50:00.000Z', '2026-06-22T21:50:00.000Z');

INSERT OR REPLACE INTO work_items (id, workspace_id, organization_id, project_id, primary_repository_id, title, description, status, priority, blocked_reason, resume_summary, source_type, created_at, updated_at)
VALUES
  ('wi-1', 'ws-1', 'org-a', 'proj-iam', 'repo-auth-api', 'Corrigir login SSO', 'Race condition no refresh token sob alta concorrencia.', 'doing', 1, NULL, 'Ultima sessao reproduziu a falha e isolou a ordem incorreta de invalidacao.', 'manual', '2026-06-22T21:50:00.000Z', '2026-06-22T21:50:00.000Z'),
  ('wi-2', 'ws-1', 'org-b', 'proj-web', 'repo-web-app', 'Revisar PR de onboarding', 'Revisar branch de fluxo inicial do app web.', 'todo', 2, NULL, NULL, 'imported', '2026-06-22T21:50:00.000Z', '2026-06-22T21:50:00.000Z'),
  ('wi-3', 'ws-1', 'org-a', NULL, NULL, 'Refatorar billing worker', 'Separar pipeline de cobranca em jobs menores.', 'blocked', 1, 'Aguardando definicao da task #128.', NULL, 'manual', '2026-06-22T21:50:00.000Z', '2026-06-22T21:50:00.000Z');

INSERT OR REPLACE INTO work_item_dependencies (id, from_work_item_id, to_work_item_id, dependency_type, created_at)
VALUES ('dep-1', 'wi-3', 'wi-1', 'blocks', '2026-06-22T21:50:00.000Z');
