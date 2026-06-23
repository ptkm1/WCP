ALTER TABLE session_logs ADD COLUMN source_type TEXT NOT NULL DEFAULT 'captured';
ALTER TABLE artifacts ADD COLUMN source_type TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE entity_links ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
UPDATE entity_links SET updated_at = created_at WHERE updated_at = '';
ALTER TABLE work_item_dependencies ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
UPDATE work_item_dependencies SET updated_at = created_at WHERE updated_at = '';
