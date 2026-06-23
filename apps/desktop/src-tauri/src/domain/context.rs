use crate::db::{escape_sql, fetch_recent_sessions_by_work_item, get_optional_string, sqlite_json};
use crate::dto::{SessionLogDto, WorkItemDto};
use std::path::Path;

pub fn resolve_repository_id_for_focus(
    db_path: &Path,
    active_session: &Option<SessionLogDto>,
    current_task: &Option<WorkItemDto>,
) -> Result<Option<String>, String> {
    if let Some(session) = active_session {
        if let Some(repository_id) = session.repository_id.as_ref() {
            if !repository_id.is_empty() {
                return Ok(Some(repository_id.clone()));
            }
        }
    }

    let Some(task) = current_task else {
        return Ok(None);
    };

    if let Some(repository_id) = task.primary_repository_id.as_ref() {
        if !repository_id.is_empty() {
            return Ok(Some(repository_id.clone()));
        }
    }

    let sessions = fetch_recent_sessions_by_work_item(db_path, &task.id)?;
    if let Some(session) = sessions.first() {
        if let Some(repository_id) = session.repository_id.as_ref() {
            if !repository_id.is_empty() {
                return Ok(Some(repository_id.clone()));
            }
        }
    }

    if let Some(organization_id) = task.organization_id.as_ref() {
        if !organization_id.is_empty() {
            let rows = sqlite_json(
                db_path,
                &format!(
                    "SELECT id FROM repositories WHERE organization_id = '{}' AND is_active = 1;",
                    escape_sql(organization_id)
                ),
            )?;
            if rows.len() == 1 {
                return Ok(get_optional_string(rows.first().unwrap(), "id"));
            }
        }
    }

    Ok(None)
}
