CREATE TABLE IF NOT EXISTS integration_connections (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  display_name TEXT,
  config_json TEXT NOT NULL,
  credential_key TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  sync_enabled INTEGER NOT NULL DEFAULT 1,
  last_sync_at TEXT,
  last_sync_error TEXT,
  sync_filter_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS integration_connections_org_provider
  ON integration_connections(organization_id, provider);

ALTER TABLE work_items ADD COLUMN external_provider TEXT;
ALTER TABLE work_items ADD COLUMN external_id TEXT;
ALTER TABLE work_items ADD COLUMN external_key TEXT;
ALTER TABLE work_items ADD COLUMN external_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS work_items_external_ref
  ON work_items(organization_id, external_provider, external_id)
  WHERE external_id IS NOT NULL;
