use crate::db::{escape_sql, get_optional_string, sqlite_json};
use std::path::Path;

#[derive(Debug, Clone, Default)]
pub struct WorkContextLinksInput {
    pub organization_id: Option<String>,
    pub project_id: Option<String>,
    pub repository_id: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct ResolvedWorkContextLinks {
    pub organization_id: Option<String>,
    pub project_id: Option<String>,
    pub repository_id: Option<String>,
    pub inferred_organization_from: Option<String>,
}

pub fn resolve_work_context_links(
    db_path: &Path,
    input: &WorkContextLinksInput,
) -> Result<ResolvedWorkContextLinks, String> {
    let organization_id = normalize_id(input.organization_id.clone());
    let project_id = normalize_id(input.project_id.clone());
    let repository_id = normalize_id(input.repository_id.clone());

    let mut resolved = ResolvedWorkContextLinks {
        organization_id: organization_id.clone(),
        project_id: project_id.clone(),
        repository_id: repository_id.clone(),
        inferred_organization_from: None,
    };

    if let Some(project_id) = project_id.as_deref() {
        let rows = sqlite_json(
            db_path,
            &format!(
                "SELECT organization_id FROM projects WHERE id = '{}' AND is_active = 1 LIMIT 1;",
                escape_sql(project_id)
            ),
        )?;
        let Some(row) = rows.first() else {
            return Ok(resolved);
        };
        let project_org = get_optional_string(row, "organization_id");
        if resolved.organization_id.is_none() {
            if let Some(project_org) = project_org {
                resolved.organization_id = Some(project_org);
                resolved.inferred_organization_from = Some("project".to_string());
            }
        }
    }

    if let Some(repository_id) = repository_id.as_deref() {
        let rows = sqlite_json(
            db_path,
            &format!(
                "SELECT organization_id FROM repositories WHERE id = '{}' AND is_active = 1 LIMIT 1;",
                escape_sql(repository_id)
            ),
        )?;
        let Some(row) = rows.first() else {
            return Ok(resolved);
        };
        let repo_org = get_optional_string(row, "organization_id");
        if resolved.organization_id.is_none() {
            if let Some(repo_org) = repo_org {
                resolved.organization_id = Some(repo_org);
                resolved.inferred_organization_from = Some("repository".to_string());
            }
        }
    }

    Ok(resolved)
}

pub fn validate_work_context_links(
    db_path: &Path,
    input: &WorkContextLinksInput,
) -> Result<(), String> {
    let organization_id = normalize_id(input.organization_id.clone());
    let project_id = normalize_id(input.project_id.clone());
    let repository_id = normalize_id(input.repository_id.clone());
    let mut resolved_org = organization_id.clone();

    if let Some(project_id) = project_id.as_deref() {
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

    if let Some(repository_id) = repository_id.as_deref() {
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

        if let Some(project_id) = project_id.as_deref() {
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

pub fn validate_repository_assignment(
    db_path: &Path,
    organization_id: &str,
    project_id: Option<&str>,
) -> Result<(), String> {
    let org_rows = sqlite_json(
        db_path,
        &format!(
            "SELECT id FROM organizations WHERE id = '{}' AND is_active = 1 LIMIT 1;",
            escape_sql(organization_id)
        ),
    )?;
    if org_rows.is_empty() {
        return Err("Empresa nao encontrada.".to_string());
    }

    if let Some(project_id) = project_id.map(str::trim).filter(|value| !value.is_empty()) {
        validate_work_context_links(
            db_path,
            &WorkContextLinksInput {
                organization_id: Some(organization_id.to_string()),
                project_id: Some(project_id.to_string()),
                repository_id: None,
            },
        )?;
    }

    Ok(())
}

pub fn validate_work_item_context(
    db_path: &Path,
    organization_id: Option<&str>,
    project_id: Option<&str>,
    primary_repository_id: Option<&str>,
) -> Result<(), String> {
    validate_work_context_links(
        db_path,
        &WorkContextLinksInput {
            organization_id: organization_id.map(str::to_string),
            project_id: project_id.map(str::to_string),
            repository_id: primary_repository_id.map(str::to_string),
        },
    )
}

fn normalize_id(value: Option<String>) -> Option<String> {
    value
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty() && entry != "all")
}
