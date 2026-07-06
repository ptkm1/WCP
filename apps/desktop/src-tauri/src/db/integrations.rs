use crate::db::{
    escape_sql, get_i64, get_optional_string, get_string, nullable_sql, sqlite_exec, sqlite_json,
};
use crate::dto::{IntegrationConnectionDto, PmSyncResultDto};
use crate::util::{iso_now, unix_timestamp_millis};
use serde_json::Value;
use std::path::Path;

pub fn fetch_integration_connections(
    db_path: &Path,
    organization_id: &str,
) -> Result<Vec<IntegrationConnectionDto>, String> {
    let rows = sqlite_json(
        db_path,
        &format!(
            "SELECT id, workspace_id, organization_id, provider, display_name, config_json,
                    credential_key, is_active, sync_enabled, last_sync_at, last_sync_error,
                    sync_filter_json, created_at, updated_at
             FROM integration_connections
             WHERE organization_id = '{}'
             ORDER BY provider ASC;",
            escape_sql(organization_id)
        ),
    )?;

    Ok(rows.iter().map(map_integration_connection_row).collect())
}

pub fn fetch_integration_connection_by_id(
    db_path: &Path,
    connection_id: &str,
) -> Result<Option<IntegrationConnectionDto>, String> {
    let rows = sqlite_json(
        db_path,
        &format!(
            "SELECT id, workspace_id, organization_id, provider, display_name, config_json,
                    credential_key, is_active, sync_enabled, last_sync_at, last_sync_error,
                    sync_filter_json, created_at, updated_at
             FROM integration_connections
             WHERE id = '{}'
             LIMIT 1;",
            escape_sql(connection_id)
        ),
    )?;

    Ok(rows.first().map(map_integration_connection_row))
}

pub fn upsert_integration_connection(
    db_path: &Path,
    workspace_id: &str,
    organization_id: &str,
    provider: &str,
    display_name: Option<&str>,
    config_json: &str,
    credential_key: &str,
    sync_filter_json: Option<&str>,
) -> Result<IntegrationConnectionDto, String> {
    let now = iso_now()?;
    let existing = sqlite_json(
        db_path,
        &format!(
            "SELECT id FROM integration_connections
             WHERE organization_id = '{}' AND provider = '{}'
             LIMIT 1;",
            escape_sql(organization_id),
            escape_sql(provider)
        ),
    )?;

    if let Some(row) = existing.first() {
        let connection_id = get_string(row, "id").unwrap_or_default();
        sqlite_exec(
            db_path,
            &format!(
                "UPDATE integration_connections
                 SET display_name = {},
                     config_json = '{}',
                     credential_key = '{}',
                     sync_filter_json = {},
                     is_active = 1,
                     sync_enabled = 1,
                     updated_at = '{}'
                 WHERE id = '{}';",
                nullable_sql(display_name),
                escape_sql(config_json),
                escape_sql(credential_key),
                nullable_sql(sync_filter_json),
                escape_sql(&now),
                escape_sql(&connection_id)
            ),
        )?;
        return fetch_integration_connection_by_id(db_path, &connection_id)?
            .ok_or_else(|| "Nao foi possivel carregar a conexao atualizada.".to_string());
    }

    let connection_id = format!("int-{}", unix_timestamp_millis()?);
    sqlite_exec(
        db_path,
        &format!(
            "INSERT INTO integration_connections (
              id, workspace_id, organization_id, provider, display_name, config_json,
              credential_key, is_active, sync_enabled, sync_filter_json, created_at, updated_at
            ) VALUES (
              '{}', '{}', '{}', '{}', {}, '{}', '{}', 1, 1, {}, '{}', '{}'
            );",
            escape_sql(&connection_id),
            escape_sql(workspace_id),
            escape_sql(organization_id),
            escape_sql(provider),
            nullable_sql(display_name),
            escape_sql(config_json),
            escape_sql(credential_key),
            nullable_sql(sync_filter_json),
            escape_sql(&now),
            escape_sql(&now)
        ),
    )?;

    fetch_integration_connection_by_id(db_path, &connection_id)?
        .ok_or_else(|| "Nao foi possivel carregar a conexao criada.".to_string())
}

pub fn delete_integration_connection(db_path: &Path, connection_id: &str) -> Result<(), String> {
    sqlite_exec(
        db_path,
        &format!(
            "DELETE FROM integration_connections WHERE id = '{}';",
            escape_sql(connection_id)
        ),
    )
}

pub fn update_integration_sync_status(
    db_path: &Path,
    connection_id: &str,
    last_sync_at: Option<&str>,
    last_sync_error: Option<&str>,
) -> Result<(), String> {
    let now = iso_now()?;
    sqlite_exec(
        db_path,
        &format!(
            "UPDATE integration_connections
             SET last_sync_at = {},
                 last_sync_error = {},
                 updated_at = '{}'
             WHERE id = '{}';",
            nullable_sql(last_sync_at),
            nullable_sql(last_sync_error),
            escape_sql(&now),
            escape_sql(connection_id)
        ),
    )
}

pub fn upsert_imported_work_item(
    db_path: &Path,
    workspace_id: &str,
    organization_id: &str,
    external_provider: &str,
    external_id: &str,
    external_key: Option<&str>,
    external_url: Option<&str>,
    title: &str,
    description: Option<&str>,
    status: &str,
    priority: i64,
    scheduled_for: Option<&str>,
) -> Result<(String, bool), String> {
    let now = iso_now()?;
    let existing = sqlite_json(
        db_path,
        &format!(
            "SELECT id, project_id, primary_repository_id
             FROM work_items
             WHERE organization_id = '{}'
               AND external_provider = '{}'
               AND external_id = '{}'
             LIMIT 1;",
            escape_sql(organization_id),
            escape_sql(external_provider),
            escape_sql(external_id)
        ),
    )?;

    if let Some(row) = existing.first() {
        let work_item_id = get_string(row, "id").unwrap_or_default();
        let project_id = get_optional_string(row, "project_id");
        let primary_repository_id = get_optional_string(row, "primary_repository_id");

        sqlite_exec(
            db_path,
            &format!(
                "UPDATE work_items
                 SET title = '{}',
                     description = {},
                     status = '{}',
                     priority = {},
                     scheduled_for = {},
                     external_key = {},
                     external_url = {},
                     source_type = 'imported',
                     project_id = {},
                     primary_repository_id = {},
                     updated_at = '{}'
                 WHERE id = '{}';",
                escape_sql(title),
                nullable_sql(description),
                escape_sql(status),
                priority,
                nullable_sql(scheduled_for),
                nullable_sql(external_key),
                nullable_sql(external_url),
                nullable_sql(project_id.as_deref()),
                nullable_sql(primary_repository_id.as_deref()),
                escape_sql(&now),
                escape_sql(&work_item_id)
            ),
        )?;
        return Ok((work_item_id, false));
    }

    let work_item_id = format!("wi-{}", unix_timestamp_millis()?);
    sqlite_exec(
        db_path,
        &format!(
            "INSERT INTO work_items (
              id, workspace_id, organization_id, title, description, status, priority,
              scheduled_for, source_type, external_provider, external_id, external_key,
              external_url, created_at, updated_at
            ) VALUES (
              '{}', '{}', '{}', '{}', {}, '{}', {}, {}, 'imported', '{}', '{}', {}, {}, '{}', '{}'
            );",
            escape_sql(&work_item_id),
            escape_sql(workspace_id),
            escape_sql(organization_id),
            escape_sql(title),
            nullable_sql(description),
            escape_sql(status),
            priority,
            nullable_sql(scheduled_for),
            escape_sql(external_provider),
            escape_sql(external_id),
            nullable_sql(external_key),
            nullable_sql(external_url),
            escape_sql(&now),
            escape_sql(&now)
        ),
    )?;

    Ok((work_item_id, true))
}

pub fn insert_activity_event(
    db_path: &Path,
    workspace_id: &str,
    entity_type: &str,
    entity_id: &str,
    event_type: &str,
    payload_json: Option<&str>,
) -> Result<(), String> {
    let event_id = format!("evt-{}", unix_timestamp_millis()?);
    let now = iso_now()?;
    sqlite_exec(
        db_path,
        &format!(
            "INSERT INTO activity_events (
              id, workspace_id, entity_type, entity_id, event_type, payload_json, created_at
            ) VALUES (
              '{}', '{}', '{}', '{}', '{}', {}, '{}'
            );",
            escape_sql(&event_id),
            escape_sql(workspace_id),
            escape_sql(entity_type),
            escape_sql(entity_id),
            escape_sql(event_type),
            nullable_sql(payload_json),
            escape_sql(&now)
        ),
    )
}

pub fn deadline_alert_sent_today(
    db_path: &Path,
    work_item_id: &str,
    threshold: &str,
) -> Result<bool, String> {
    let rows = sqlite_json(
        db_path,
        &format!(
            "SELECT id FROM activity_events
             WHERE entity_type = 'work_item'
               AND entity_id = '{}'
               AND event_type = 'deadline_alert'
               AND payload_json LIKE '%\"threshold\":\"{}\"%'
               AND date(created_at) = date('now')
             LIMIT 1;",
            escape_sql(work_item_id),
            escape_sql(threshold)
        ),
    )?;
    Ok(!rows.is_empty())
}

fn map_integration_connection_row(row: &Value) -> IntegrationConnectionDto {
    IntegrationConnectionDto {
        id: get_string(row, "id").unwrap_or_default(),
        workspace_id: get_string(row, "workspace_id").unwrap_or_default(),
        organization_id: get_string(row, "organization_id").unwrap_or_default(),
        provider: get_string(row, "provider").unwrap_or_default(),
        display_name: get_optional_string(row, "display_name"),
        config_json: get_string(row, "config_json").unwrap_or_else(|| "{}".to_string()),
        credential_key: get_string(row, "credential_key").unwrap_or_default(),
        has_credentials: true,
        is_active: get_i64(row, "is_active").unwrap_or(1) == 1,
        sync_enabled: get_i64(row, "sync_enabled").unwrap_or(1) == 1,
        last_sync_at: get_optional_string(row, "last_sync_at"),
        last_sync_error: get_optional_string(row, "last_sync_error"),
        sync_filter_json: get_optional_string(row, "sync_filter_json"),
        created_at: get_string(row, "created_at").unwrap_or_default(),
        updated_at: get_string(row, "updated_at").unwrap_or_default(),
    }
}

pub fn empty_sync_result() -> PmSyncResultDto {
    PmSyncResultDto {
        created: 0,
        updated: 0,
        unchanged: 0,
        errors: Vec::new(),
    }
}
