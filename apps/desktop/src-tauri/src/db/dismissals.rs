use super::{
    escape_sql, fetch_work_item_by_id, get_optional_string, get_string, sqlite_exec, sqlite_json,
};
use crate::dto::WorkItemDto;
use crate::util::iso_now;
use std::path::Path;

pub fn is_pm_import_dismissed(
    db_path: &Path,
    organization_id: &str,
    external_provider: &str,
    external_id: &str,
) -> Result<bool, String> {
    let rows = sqlite_json(
        db_path,
        &format!(
            "SELECT organization_id FROM pm_dismissed_imports
             WHERE organization_id = '{}'
               AND external_provider = '{}'
               AND external_id = '{}'
             LIMIT 1;",
            escape_sql(organization_id),
            escape_sql(external_provider),
            escape_sql(external_id)
        ),
    )?;
    Ok(!rows.is_empty())
}

pub fn dismiss_work_item(db_path: &Path, work_item_id: &str) -> Result<WorkItemDto, String> {
    let item = fetch_work_item_by_id(db_path, work_item_id)?
        .ok_or_else(|| "Tarefa nao encontrada.".to_string())?;

    let now = iso_now()?;
    sqlite_exec(
        db_path,
        &format!(
            "UPDATE work_items
             SET wcp_dismissed_at = '{}',
                 updated_at = '{}'
             WHERE id = '{}';",
            escape_sql(&now),
            escape_sql(&now),
            escape_sql(work_item_id)
        ),
    )?;

    if let (Some(organization_id), Some(external_provider), Some(external_id)) = (
        item.organization_id.as_deref(),
        item.external_provider.as_deref(),
        item.external_id.as_deref(),
    ) {
        sqlite_exec(
            db_path,
            &format!(
                "INSERT INTO pm_dismissed_imports (
                  organization_id, external_provider, external_id, dismissed_at
                ) VALUES ('{}', '{}', '{}', '{}')
                ON CONFLICT(organization_id, external_provider, external_id)
                DO UPDATE SET dismissed_at = excluded.dismissed_at;",
                escape_sql(organization_id),
                escape_sql(external_provider),
                escape_sql(external_id),
                escape_sql(&now)
            ),
        )?;
    }

    fetch_work_item_by_id(db_path, work_item_id)?
        .ok_or_else(|| "Nao foi possivel carregar a tarefa ignorada.".to_string())
}

pub fn restore_dismissed_work_item(
    db_path: &Path,
    work_item_id: &str,
) -> Result<WorkItemDto, String> {
    let item = fetch_work_item_by_id(db_path, work_item_id)?
        .ok_or_else(|| "Tarefa nao encontrada.".to_string())?;

    let now = iso_now()?;
    sqlite_exec(
        db_path,
        &format!(
            "UPDATE work_items
             SET wcp_dismissed_at = NULL,
                 updated_at = '{}'
             WHERE id = '{}';",
            escape_sql(&now),
            escape_sql(work_item_id)
        ),
    )?;

    if let (Some(organization_id), Some(external_provider), Some(external_id)) = (
        item.organization_id.as_deref(),
        item.external_provider.as_deref(),
        item.external_id.as_deref(),
    ) {
        sqlite_exec(
            db_path,
            &format!(
                "DELETE FROM pm_dismissed_imports
                 WHERE organization_id = '{}'
                   AND external_provider = '{}'
                   AND external_id = '{}';",
                escape_sql(organization_id),
                escape_sql(external_provider),
                escape_sql(external_id)
            ),
        )?;
    }

    fetch_work_item_by_id(db_path, work_item_id)?
        .ok_or_else(|| "Nao foi possivel carregar a tarefa restaurada.".to_string())
}

pub fn dismissed_at_from_row(row: &serde_json::Value) -> Option<String> {
    get_optional_string(row, "wcp_dismissed_at")
}
