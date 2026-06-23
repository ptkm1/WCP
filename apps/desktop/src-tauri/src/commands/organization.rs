use crate::db::{ensure_db_ready, fetch_organizations, fetch_projects, resolve_db_path};
use crate::dto::{OrganizationListItemDto, ProjectListItemDto};

#[tauri::command]
pub fn list_organizations() -> Result<Vec<OrganizationListItemDto>, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    fetch_organizations(&db_path)
}

#[tauri::command]
pub fn list_projects() -> Result<Vec<ProjectListItemDto>, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    fetch_projects(&db_path)
}
