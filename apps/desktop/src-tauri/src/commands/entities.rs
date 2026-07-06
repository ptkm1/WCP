use crate::db::{
    delete_organization_record, delete_project_record, delete_repository_record, ensure_db_ready,
    resolve_db_path,
};
use crate::dto::DeleteEntityResultDto;

#[tauri::command]
pub fn delete_organization(organization_id: String) -> Result<DeleteEntityResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;

    let organization_id = organization_id.trim();
    if organization_id.is_empty() {
        return Err("Empresa invalida.".to_string());
    }

    delete_organization_record(&db_path, organization_id)?;
    Ok(DeleteEntityResultDto {
        entity_type: "organization".to_string(),
        deleted_id: organization_id.to_string(),
    })
}

#[tauri::command]
pub fn delete_project(project_id: String) -> Result<DeleteEntityResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;

    let project_id = project_id.trim();
    if project_id.is_empty() {
        return Err("Projeto invalido.".to_string());
    }

    delete_project_record(&db_path, project_id)?;
    Ok(DeleteEntityResultDto {
        entity_type: "project".to_string(),
        deleted_id: project_id.to_string(),
    })
}

#[tauri::command]
pub fn delete_repository(repository_id: String) -> Result<DeleteEntityResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;

    let repository_id = repository_id.trim();
    if repository_id.is_empty() {
        return Err("Repositorio invalido.".to_string());
    }

    delete_repository_record(&db_path, repository_id)?;
    Ok(DeleteEntityResultDto {
        entity_type: "repository".to_string(),
        deleted_id: repository_id.to_string(),
    })
}
