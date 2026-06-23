use crate::db::{escape_sql, get_optional_string, sqlite_json};
use std::path::Path;

pub fn validate_work_item_context(
    db_path: &Path,
    organization_id: Option<&str>,
    project_id: Option<&str>,
    primary_repository_id: Option<&str>,
) -> Result<(), String> {
    let mut resolved_org = organization_id
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);

    if let Some(project_id) = project_id.map(str::trim).filter(|value| !value.is_empty()) {
        let rows = sqlite_json(
            db_path,
            &format!(
                "SELECT organization_id FROM projects WHERE id = '{}' AND is_active = 1 LIMIT 1;",
                escape_sql(project_id)
            ),
        )?;

        let Some(row) = rows.first() else {
            return Err("Projeto nao encontrado.".to_string());
        };

        let project_org = get_optional_string(row, "organization_id");
        match (&resolved_org, &project_org) {
            (Some(org), Some(project_org)) if org != project_org => {
                return Err("O projeto selecionado pertence a outra empresa.".to_string());
            }
            (None, Some(project_org)) => {
                resolved_org = Some(project_org.clone());
            }
            _ => {}
        }
    }

    if let Some(repository_id) = primary_repository_id
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        let rows = sqlite_json(
            db_path,
            &format!(
                "SELECT organization_id, project_id FROM repositories WHERE id = '{}' AND is_active = 1 LIMIT 1;",
                escape_sql(repository_id)
            ),
        )?;

        let Some(row) = rows.first() else {
            return Err("Repositorio nao encontrado.".to_string());
        };

        let repo_org = get_optional_string(row, "organization_id");
        let repo_project = get_optional_string(row, "project_id");

        if let Some(org) = resolved_org.as_deref() {
            if let Some(ref repo_org) = repo_org {
                if repo_org != org {
                    return Err("Repositorio pertence a outra empresa.".to_string());
                }
            }
        } else if let Some(repo_org) = repo_org {
            let _ = resolved_org.insert(repo_org);
        }

        if let Some(project_id) = project_id.map(str::trim).filter(|value| !value.is_empty()) {
            if let Some(ref repo_project) = repo_project {
                if repo_project != project_id {
                    return Err(
                        "Repositorio nao esta vinculado ao projeto selecionado.".to_string(),
                    );
                }
            }
        }
    }

    Ok(())
}
