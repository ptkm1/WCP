use super::organizations::clear_organization_logo;
use super::{
    delete_integration_connection, escape_sql, fetch_integration_connections,
    fetch_organization_by_id, fetch_project_by_id, fetch_repository_by_id, get_string,
    sqlite_exec, sqlite_json,
};
use crate::integrations::delete_credentials;
use crate::util::iso_now;
use std::path::Path;

fn collect_ids(rows: Vec<serde_json::Value>, key: &str) -> Vec<String> {
    rows.into_iter()
        .filter_map(|row| get_string(&row, key))
        .collect()
}

fn sql_in_clause(column: &str, ids: &[String]) -> Option<String> {
    if ids.is_empty() {
        return None;
    }
    let values = ids
        .iter()
        .map(|id| format!("'{}'", escape_sql(id)))
        .collect::<Vec<_>>()
        .join(", ");
    Some(format!("{column} IN ({values})"))
}

fn exec_optional_in(db_path: &Path, sql_prefix: &str, column: &str, ids: &[String]) -> Result<(), String> {
    if let Some(clause) = sql_in_clause(column, ids) {
        sqlite_exec(db_path, &format!("{sql_prefix} WHERE {clause};"))?;
    }
    Ok(())
}

fn delete_entity_links_for_ids(db_path: &Path, ids: &[String]) -> Result<(), String> {
    if ids.is_empty() {
        return Ok(());
    }
    if let Some(clause) = sql_in_clause("from_entity_id", ids) {
        sqlite_exec(
            db_path,
            &format!("DELETE FROM entity_links WHERE {clause};"),
        )?;
    }
    if let Some(clause) = sql_in_clause("to_entity_id", ids) {
        sqlite_exec(
            db_path,
            &format!("DELETE FROM entity_links WHERE {clause};"),
        )?;
    }
    Ok(())
}

fn delete_knowledge_notes_for_entity(
    db_path: &Path,
    entity_type: &str,
    entity_id: &str,
) -> Result<(), String> {
    sqlite_exec(
        db_path,
        &format!(
            "DELETE FROM knowledge_notes
             WHERE entity_type = '{}' AND entity_id = '{}';",
            escape_sql(entity_type),
            escape_sql(entity_id)
        ),
    )
}

fn delete_knowledge_notes_for_entities(
    db_path: &Path,
    entity_type: &str,
    entity_ids: &[String],
) -> Result<(), String> {
    if let Some(clause) = sql_in_clause("entity_id", entity_ids) {
        sqlite_exec(
            db_path,
            &format!(
                "DELETE FROM knowledge_notes
                 WHERE entity_type = '{}' AND {clause};",
                escape_sql(entity_type)
            ),
        )?;
    }
    Ok(())
}

fn end_open_sessions_for_repository(db_path: &Path, repository_id: &str) -> Result<(), String> {
    let now = iso_now()?;
    sqlite_exec(
        db_path,
        &format!(
            "UPDATE session_logs
             SET ended_at = '{}', updated_at = '{}'
             WHERE repository_id = '{}' AND ended_at IS NULL;",
            escape_sql(&now),
            escape_sql(&now),
            escape_sql(repository_id)
        ),
    )
}

fn delete_work_items_by_ids(db_path: &Path, work_item_ids: &[String]) -> Result<(), String> {
    if work_item_ids.is_empty() {
        return Ok(());
    }

    if let Some(from_clause) = sql_in_clause("from_work_item_id", work_item_ids) {
        sqlite_exec(
            db_path,
            &format!("DELETE FROM work_item_dependencies WHERE {from_clause};"),
        )?;
    }
    if let Some(to_clause) = sql_in_clause("to_work_item_id", work_item_ids) {
        sqlite_exec(
            db_path,
            &format!("DELETE FROM work_item_dependencies WHERE {to_clause};"),
        )?;
    }

    exec_optional_in(
        db_path,
        "DELETE FROM work_item_repositories",
        "work_item_id",
        work_item_ids,
    )?;
    exec_optional_in(
        db_path,
        "DELETE FROM daily_plan_items",
        "work_item_id",
        work_item_ids,
    )?;
    delete_knowledge_notes_for_entities(db_path, "work_item", work_item_ids)?;
    exec_optional_in(
        db_path,
        "DELETE FROM session_logs",
        "work_item_id",
        work_item_ids,
    )?;
    delete_entity_links_for_ids(db_path, work_item_ids)?;
    exec_optional_in(db_path, "DELETE FROM work_items", "id", work_item_ids)?;
    Ok(())
}

pub fn delete_repository_record(db_path: &Path, repository_id: &str) -> Result<(), String> {
    let repository = fetch_repository_by_id(db_path, repository_id)?
        .ok_or_else(|| "Repositorio nao encontrado.".to_string())?;

    end_open_sessions_for_repository(db_path, repository_id)?;

    sqlite_exec(
        db_path,
        &format!(
            "UPDATE work_items
             SET primary_repository_id = NULL, updated_at = '{}'
             WHERE primary_repository_id = '{}';",
            escape_sql(&iso_now()?),
            escape_sql(repository_id)
        ),
    )?;

    sqlite_exec(
        db_path,
        &format!(
            "DELETE FROM work_item_repositories WHERE repository_id = '{}';",
            escape_sql(repository_id)
        ),
    )?;
    sqlite_exec(
        db_path,
        &format!(
            "DELETE FROM session_logs WHERE repository_id = '{}';",
            escape_sql(repository_id)
        ),
    )?;
    sqlite_exec(
        db_path,
        &format!(
            "DELETE FROM artifacts WHERE repository_id = '{}';",
            escape_sql(repository_id)
        ),
    )?;
    delete_knowledge_notes_for_entity(db_path, "repository", repository_id)?;
    delete_entity_links_for_ids(db_path, &[repository_id.to_string()])?;
    sqlite_exec(
        db_path,
        &format!(
            "DELETE FROM repository_identities WHERE repository_id = '{}';",
            escape_sql(repository_id)
        ),
    )?;
    sqlite_exec(
        db_path,
        &format!(
            "DELETE FROM repositories WHERE id = '{}';",
            escape_sql(repository_id)
        ),
    )?;

    let _ = repository;
    Ok(())
}

pub fn delete_project_record(db_path: &Path, project_id: &str) -> Result<(), String> {
    let project = fetch_project_by_id(db_path, project_id)?
        .ok_or_else(|| "Projeto nao encontrado.".to_string())?;

    let repo_rows = sqlite_json(
        db_path,
        &format!(
            "SELECT id FROM repositories WHERE project_id = '{}' LIMIT 1;",
            escape_sql(project_id)
        ),
    )?;
    if !repo_rows.is_empty() {
        return Err(
            "Este projeto ainda tem repositorios vinculados. Exclua ou reassocie os repos antes."
                .to_string(),
        );
    }

    let now = iso_now()?;
    sqlite_exec(
        db_path,
        &format!(
            "UPDATE work_items
             SET project_id = NULL, updated_at = '{}'
             WHERE project_id = '{}';",
            escape_sql(&now),
            escape_sql(project_id)
        ),
    )?;
    sqlite_exec(
        db_path,
        &format!(
            "UPDATE session_logs
             SET project_id = NULL, updated_at = '{}'
             WHERE project_id = '{}';",
            escape_sql(&now),
            escape_sql(project_id)
        ),
    )?;
    delete_knowledge_notes_for_entity(db_path, "project", project_id)?;
    delete_entity_links_for_ids(db_path, &[project_id.to_string()])?;
    sqlite_exec(
        db_path,
        &format!("DELETE FROM projects WHERE id = '{}';", escape_sql(project_id)),
    )?;

    let _ = project;
    Ok(())
}

pub fn delete_organization_record(db_path: &Path, organization_id: &str) -> Result<(), String> {
    let organization = fetch_organization_by_id(db_path, organization_id)?
        .ok_or_else(|| "Empresa nao encontrada.".to_string())?;

    for connection in fetch_integration_connections(db_path, organization_id)? {
        let _ = delete_credentials(&connection.credential_key);
        delete_integration_connection(db_path, &connection.id)?;
    }

    let work_item_rows = sqlite_json(
        db_path,
        &format!(
            "SELECT id FROM work_items WHERE organization_id = '{}';",
            escape_sql(organization_id)
        ),
    )?;
    let work_item_ids = collect_ids(work_item_rows, "id");
    delete_work_items_by_ids(db_path, &work_item_ids)?;

    let repository_rows = sqlite_json(
        db_path,
        &format!(
            "SELECT id FROM repositories WHERE organization_id = '{}';",
            escape_sql(organization_id)
        ),
    )?;
    let repository_ids = collect_ids(repository_rows, "id");
    for repository_id in &repository_ids {
        delete_repository_record(db_path, repository_id)?;
    }

    let project_rows = sqlite_json(
        db_path,
        &format!(
            "SELECT id FROM projects WHERE organization_id = '{}';",
            escape_sql(organization_id)
        ),
    )?;
    let project_ids = collect_ids(project_rows, "id");
    delete_knowledge_notes_for_entities(db_path, "project", &project_ids)?;
    delete_entity_links_for_ids(db_path, &project_ids)?;
    sqlite_exec(
        db_path,
        &format!(
            "DELETE FROM projects WHERE organization_id = '{}';",
            escape_sql(organization_id)
        ),
    )?;

    delete_knowledge_notes_for_entity(db_path, "organization", organization_id)?;
    delete_entity_links_for_ids(db_path, &[organization_id.to_string()])?;

    sqlite_exec(
        db_path,
        &format!(
            "DELETE FROM session_logs WHERE organization_id = '{}';",
            escape_sql(organization_id)
        ),
    )?;
    sqlite_exec(
        db_path,
        &format!(
            "DELETE FROM environment_profiles WHERE organization_id = '{}';",
            escape_sql(organization_id)
        ),
    )?;
    sqlite_exec(
        db_path,
        &format!(
            "DELETE FROM activity_events
             WHERE entity_type = 'organization' AND entity_id = '{}';",
            escape_sql(organization_id)
        ),
    )?;

    let _ = clear_organization_logo(db_path, organization_id);

    sqlite_exec(
        db_path,
        &format!(
            "DELETE FROM organizations WHERE id = '{}';",
            escape_sql(organization_id)
        ),
    )?;

    let _ = organization;
    Ok(())
}
