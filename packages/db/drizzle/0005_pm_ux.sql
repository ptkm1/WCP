CREATE TABLE IF NOT EXISTS pm_project_mappings (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  integration_connection_id TEXT REFERENCES integration_connections(id),
  external_project_key TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
  default_repository_id TEXT REFERENCES repositories(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(organization_id, external_project_key)
);
