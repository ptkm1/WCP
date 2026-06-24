use crate::db::{
    escape_sql, fetch_organization_by_id, fetch_project_by_id, fetch_repository_by_id,
    get_optional_string, sqlite_json,
};
use crate::dto::ResolvedWorkContextDto;
use crate::domain::context_links::{resolve_work_context_links, WorkContextLinksInput};
use std::path::Path;

pub fn resolve_work_context(
    db_path: &Path,
    organization_id: Option<String>,
    project_id: Option<String>,
    repository_id: Option<String>,
) -> Result<ResolvedWorkContextDto, String> {
    let input = WorkContextLinksInput {
        organization_id,
        project_id,
        repository_id,
    };
    let resolved_links = resolve_work_context_links(db_path, &input)?;

    let organization = resolved_links
        .organization_id
        .as_deref()
        .and_then(|id| fetch_organization_by_id(db_path, id).ok().flatten());

    let project = resolved_links
        .project_id
        .as_deref()
        .and_then(|id| fetch_project_by_id(db_path, id).ok().flatten());

    let repository = resolved_links
        .repository_id
        .as_deref()
        .and_then(|id| fetch_repository_by_id(db_path, id).ok().flatten());

    let identity_source = if let Some(repository_id) = resolved_links.repository_id.as_deref() {
        fetch_identity_source(db_path, repository_id)?
    } else {
        None
    };

    let expected_git_user_name = repository
        .as_ref()
        .and_then(|entry| entry.expected_git_user_name.clone())
        .or_else(|| organization.as_ref().and_then(|entry| entry.git_user_name.clone()));
    let expected_git_user_email = repository
        .as_ref()
        .and_then(|entry| entry.expected_git_user_email.clone())
        .or_else(|| organization.as_ref().and_then(|entry| entry.git_user_email.clone()));

    let chain_label = build_chain_label(
        organization.as_ref().map(|entry| entry.name.as_str()),
        repository
            .as_ref()
            .and_then(|entry| entry.environment_name.as_deref())
            .or(organization.as_ref().and_then(|entry| entry.environment_name.as_deref())),
        repository.as_ref().map(|entry| entry.name.as_str()),
        expected_git_user_name.as_deref(),
        expected_git_user_email.as_deref(),
        identity_source.as_deref(),
    );

    let gaps = list_organization_gaps(organization.as_ref());

    Ok(ResolvedWorkContextDto {
        organization_id: resolved_links.organization_id,
        organization_name: organization.as_ref().map(|entry| entry.name.clone()),
        project_id: resolved_links.project_id,
        project_name: project.as_ref().map(|entry| entry.name.clone()),
        repository_id: resolved_links.repository_id,
        repository_name: repository.as_ref().map(|entry| entry.name.clone()),
        environment_profile_id: organization
            .as_ref()
            .and_then(|entry| entry.environment_profile_id.clone())
            .or_else(|| {
                repository
                    .as_ref()
                    .and_then(|entry| entry.environment_profile_id.clone())
            }),
        environment_name: repository
            .as_ref()
            .and_then(|entry| entry.environment_name.clone())
            .or_else(|| organization.as_ref().and_then(|entry| entry.environment_name.clone())),
        identity_source,
        expected_git_user_name,
        expected_git_user_email,
        provider_host: organization
            .as_ref()
            .and_then(|entry| entry.provider_host.clone())
            .or_else(|| repository.as_ref().and_then(|entry| entry.provider_host.clone())),
        branch_pattern: organization.as_ref().and_then(|entry| entry.branch_pattern.clone()),
        chain_label,
        gaps,
        inferred_organization_from: resolved_links.inferred_organization_from,
    })
}

fn fetch_identity_source(db_path: &Path, repository_id: &str) -> Result<Option<String>, String> {
    let rows = sqlite_json(
        db_path,
        &format!(
            "SELECT ri.environment_profile_id,
                    ri.git_user_name AS identity_git_user_name,
                    ri.git_user_email AS identity_git_user_email,
                    ep.git_user_name AS profile_git_user_name,
                    ep.git_user_email AS profile_git_user_email
             FROM repository_identities ri
             LEFT JOIN environment_profiles ep ON ep.id = ri.environment_profile_id
             WHERE ri.repository_id = '{}'
             LIMIT 1;",
            escape_sql(repository_id)
        ),
    )?;

    let Some(row) = rows.first() else {
        return Ok(None);
    };

    let environment_profile_id = get_optional_string(row, "environment_profile_id");
    let identity_git_user_name = get_optional_string(row, "identity_git_user_name");
    let identity_git_user_email = get_optional_string(row, "identity_git_user_email");
    let profile_git_user_name = get_optional_string(row, "profile_git_user_name");
    let profile_git_user_email = get_optional_string(row, "profile_git_user_email");

    if environment_profile_id.is_none() {
        return Ok(Some("override".to_string()));
    }

    if identity_git_user_name != profile_git_user_name
        || identity_git_user_email != profile_git_user_email
    {
        return Ok(Some("override".to_string()));
    }

    Ok(Some("profile".to_string()))
}

fn build_chain_label(
    organization_name: Option<&str>,
    environment_name: Option<&str>,
    repository_name: Option<&str>,
    git_user_name: Option<&str>,
    git_user_email: Option<&str>,
    identity_source: Option<&str>,
) -> Option<String> {
    if organization_name.is_none() && repository_name.is_none() {
        return None;
    }

    let org_label = organization_name.unwrap_or("Empresa");
    let profile_label = environment_name.unwrap_or("Perfil");
    let repo_label = repository_name.unwrap_or("Repositorio");
    let git_label = match (git_user_name, git_user_email) {
        (Some(name), Some(email)) => format!("{name} <{email}>"),
        (Some(name), None) => name.to_string(),
        (None, Some(email)) => email.to_string(),
        (None, None) => "identidade nao configurada".to_string(),
    };
    let source_label = match identity_source {
        Some("override") => Some("override local"),
        Some("profile") => Some("via perfil"),
        _ => None,
    };

    Some(format!(
        "{org_label} → {profile_label} → {repo_label} → git: {git_label}{}",
        source_label
            .map(|value| format!(" ({value})"))
            .unwrap_or_default()
    ))
}

fn list_organization_gaps(
    organization: Option<&crate::dto::OrganizationListItemDto>,
) -> Vec<String> {
    let Some(organization) = organization else {
        return vec![
            "Sem git user.name".to_string(),
            "Sem git user.email".to_string(),
            "Sem padrao de branch".to_string(),
            "Sem provider host".to_string(),
        ];
    };

    let mut gaps = Vec::new();
    if organization.git_user_name.as_deref().unwrap_or("").trim().is_empty() {
        gaps.push("Sem git user.name".to_string());
    }
    if organization
        .git_user_email
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        gaps.push("Sem git user.email".to_string());
    }
    if organization
        .branch_pattern
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        gaps.push("Sem padrao de branch".to_string());
    }
    if organization
        .provider_host
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        gaps.push("Sem provider host".to_string());
    }
    gaps
}
