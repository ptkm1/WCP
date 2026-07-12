ALTER TABLE work_items ADD COLUMN wcp_dismissed_at TEXT;

CREATE TABLE IF NOT EXISTS pm_dismissed_imports (
  organization_id TEXT NOT NULL,
  external_provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  dismissed_at TEXT NOT NULL,
  PRIMARY KEY (organization_id, external_provider, external_id)
);
