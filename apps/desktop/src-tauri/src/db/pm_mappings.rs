use crate::db::{escape_sql, get_optional_string, get_string, nullable_sql, sqlite_json};
use crate::dto::PmProjectMappingDto;
use crate::util::{iso_now, unix_timestamp_millis};
use std::path::Path;

pub fn resolve_pm_project_mapping(
    db_path: &Path,
    organization_id: &str,
    external_project_key: &str,
) -> Result<Option<(String, Option<String>)>, String> {
    let rows = sqlite_json(
        db_path,
        &format!(
            "SELECT project_id, default_repository_id
             FROM pm_project_mappings
             WHERE organization_id = '{}'
               AND external_project_key = '{}'
             LIMIT 1;",
            escape_sql(organization_id),
            escape_sql(external_project_key)
        ),
    )?;

    Ok(rows.first().map(|row| {
        (
            get_string(row, "project_id").unwrap_or_default(),
            get_optional_string(row, "default_repository_id"),
        )
    }))
}

pub fn list_pm_project_mappings(
    db_path: &Path,
    organization_id: &str,
) -> Result<Vec<PmProjectMappingDto>, String> {
    let rows = sqlite_json(
        db_path,
        &format!(
            "SELECT m.id, m.organization_id, m.integration_connection_id, m.external_project_key,
                    m.project_id, p.name AS project_name, m.default_repository_id, r.name AS default_repository_name
             FROM pm_project_mappings m
             LEFT JOIN projects p ON p.id = m.project_id
             LEFT JOIN repositories r ON r.id = m.default_repository_id
             WHERE m.organization_id = '{}'
             ORDER BY m.external_project_key ASC;",
            escape_sql(organization_id)
        ),
    )?;

    Ok(rows
        .iter()
        .map(|row| PmProjectMappingDto {
            id: get_string(row, "id").unwrap_or_default(),
            organization_id: get_string(row, "organization_id").unwrap_or_default(),
            integration_connection_id: get_optional_string(row, "integration_connection_id"),
            external_project_key: get_string(row, "external_project_key").unwrap_or_default(),
            project_id: get_string(row, "project_id").unwrap_or_default(),
            project_name: get_optional_string(row, "project_name"),
            default_repository_id: get_optional_string(row, "default_repository_id"),
            default_repository_name: get_optional_string(row, "default_repository_name"),
        })
        .collect())
}

pub fn upsert_pm_project_mapping(
    db_path: &Path,
    organization_id: &str,
    integration_connection_id: Option<&str>,
    external_project_key: &str,
    project_id: &str,
    default_repository_id: Option<&str>,
) -> Result<PmProjectMappingDto, String> {
    let now = iso_now()?;
    let existing = sqlite_json(
        db_path,
        &format!(
            "SELECT id FROM pm_project_mappings
             WHERE organization_id = '{}'
               AND external_project_key = '{}'
             LIMIT 1;",
            escape_sql(organization_id),
            escape_sql(external_project_key)
        ),
    )?;

    let mapping_id = if let Some(row) = existing.first() {
        let id = get_string(row, "id").unwrap_or_default();
        sqlite_exec_mapping_update(
            db_path,
            &id,
            integration_connection_id,
            project_id,
            default_repository_id,
            &now,
        )?;
        id
    } else {
        let id = format!("ppm-{}", unix_timestamp_millis()?);
        crate::db::sqlite_exec(
            db_path,
            &format!(
                "INSERT INTO pm_project_mappings (
                  id, organization_id, integration_connection_id, external_project_key,
                  project_id, default_repository_id, created_at, updated_at
                ) VALUES (
                  '{}', '{}', {}, '{}', '{}', {}, '{}', '{}'
                );",
                escape_sql(&id),
                escape_sql(organization_id),
                nullable_sql(integration_connection_id),
                escape_sql(external_project_key),
                escape_sql(project_id),
                nullable_sql(default_repository_id),
                escape_sql(&now),
                escape_sql(&now)
            ),
        )?;
        id
    };

    list_pm_project_mappings(db_path, organization_id)?
        .into_iter()
        .find(|entry| entry.id == mapping_id)
        .ok_or_else(|| "Nao foi possivel carregar o mapeamento salvo.".to_string())
}

fn sqlite_exec_mapping_update(
    db_path: &Path,
    mapping_id: &str,
    integration_connection_id: Option<&str>,
    project_id: &str,
    default_repository_id: Option<&str>,
    now: &str,
) -> Result<(), String> {
    crate::db::sqlite_exec(
        db_path,
        &format!(
            "UPDATE pm_project_mappings
             SET integration_connection_id = {},
                 project_id = '{}',
                 default_repository_id = {},
                 updated_at = '{}'
             WHERE id = '{}';",
            nullable_sql(integration_connection_id),
            escape_sql(project_id),
            nullable_sql(default_repository_id),
            escape_sql(now),
            escape_sql(mapping_id)
        ),
    )
}

pub fn list_distinct_external_project_keys(
    db_path: &Path,
    organization_id: &str,
) -> Result<Vec<String>, String> {
    let rows = sqlite_json(
        db_path,
        &format!(
            "SELECT DISTINCT substr(external_key, 1, instr(external_key, '-') - 1) AS project_key
             FROM work_items
             WHERE organization_id = '{}'
               AND source_type = 'imported'
               AND external_provider = 'jira'
               AND external_key IS NOT NULL
               AND instr(external_key, '-') > 0
             ORDER BY project_key ASC;",
            escape_sql(organization_id)
        ),
    )?;

    Ok(rows
        .iter()
        .filter_map(|row| get_string(row, "project_key"))
        .filter(|value| !value.is_empty())
        .collect())
}

pub fn find_work_item_by_external_key(
    db_path: &Path,
    organization_id: &str,
    external_key: &str,
) -> Result<Option<String>, String> {
    let rows = sqlite_json(
        db_path,
        &format!(
            "SELECT id FROM work_items
             WHERE organization_id = '{}'
               AND external_key = '{}'
             LIMIT 1;",
            escape_sql(organization_id),
            escape_sql(external_key)
        ),
    )?;

    Ok(rows.first().and_then(|row| get_string(row, "id")))
}
