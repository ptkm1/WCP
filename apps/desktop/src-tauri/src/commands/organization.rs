use crate::db::{
    clear_organization_logo, ensure_db_ready, fetch_repository_by_id, insert_organization,
    insert_project, resolve_db_path, read_organization_logo_data_url, set_organization_logo,
    update_environment_profile_for_org, update_organization_record, update_project_record,
};
use crate::db::update_repository_context as apply_repository_context;
use crate::domain::{
    resolve_work_context as resolve_work_context_model, validate_repository_assignment,
    validate_work_context_links, WorkContextLinksInput,
};
use crate::dto::{
    CreateOrganizationResultDto, CreateProjectResultDto, OrganizationIdentityImportDto,
    OrganizationListItemDto, ProjectListItemDto, ResolvedWorkContextDto,
    UpdateOrganizationEnvironmentResultDto, UpdateOrganizationResultDto, UpdateProjectResultDto,
    UpdateRepositoryContextResultDto,
};
use crate::git::suggest_organization_identity_from_repository;

#[tauri::command]
pub fn list_organizations() -> Result<Vec<OrganizationListItemDto>, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    crate::db::fetch_organizations(&db_path)
}

#[tauri::command]
pub fn list_projects() -> Result<Vec<ProjectListItemDto>, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    crate::db::fetch_projects(&db_path)
}

#[tauri::command]
pub fn create_organization(
    name: String,
    kind: Option<String>,
) -> Result<CreateOrganizationResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;

    let trimmed_name = name.trim();
    if trimmed_name.is_empty() {
        return Err("Informe o nome da empresa".to_string());
    }

    let resolved_kind = kind
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("company");

    if !matches!(resolved_kind, "company" | "personal" | "community") {
        return Err("Tipo de empresa invalido".to_string());
    }

    let organization = insert_organization(&db_path, trimmed_name, resolved_kind)?;
    Ok(CreateOrganizationResultDto { organization })
}

#[tauri::command]
pub fn update_organization(
    organization_id: String,
    name: Option<String>,
    kind: Option<String>,
    is_active: Option<bool>,
) -> Result<UpdateOrganizationResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;

    if organization_id.trim().is_empty() {
        return Err("Empresa invalida".to_string());
    }

    if let Some(kind_value) = kind.as_deref().map(str::trim).filter(|value| !value.is_empty()) {
        if !matches!(kind_value, "company" | "personal" | "community") {
            return Err("Tipo de empresa invalido".to_string());
        }
    }

    let organization = update_organization_record(
        &db_path,
        organization_id.trim(),
        name.as_deref(),
        kind.as_deref(),
        is_active,
    )?;

    Ok(UpdateOrganizationResultDto { organization })
}

#[tauri::command]
pub fn update_organization_logo(
    organization_id: String,
    source_path: String,
) -> Result<UpdateOrganizationResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;

    if organization_id.trim().is_empty() {
        return Err("Empresa invalida".to_string());
    }

    if source_path.trim().is_empty() {
        return Err("Selecione uma imagem".to_string());
    }

    let organization = set_organization_logo(
        &db_path,
        organization_id.trim(),
        source_path.trim(),
    )?;

    Ok(UpdateOrganizationResultDto { organization })
}

#[tauri::command]
pub fn remove_organization_logo(
    organization_id: String,
) -> Result<UpdateOrganizationResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;

    if organization_id.trim().is_empty() {
        return Err("Empresa invalida".to_string());
    }

    let organization = clear_organization_logo(&db_path, organization_id.trim())?;

    Ok(UpdateOrganizationResultDto { organization })
}

#[tauri::command]
pub fn read_organization_logo(
    organization_id: String,
) -> Result<Option<String>, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;

    if organization_id.trim().is_empty() {
        return Err("Empresa invalida".to_string());
    }

    read_organization_logo_data_url(&db_path, organization_id.trim())
}

#[tauri::command]
pub fn import_organization_identity_from_repository(
    organization_id: String,
    repository_id: String,
) -> Result<OrganizationIdentityImportDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;

    if organization_id.trim().is_empty() {
        return Err("Empresa invalida".to_string());
    }

    if repository_id.trim().is_empty() {
        return Err("Selecione um repositorio".to_string());
    }

    let repository = fetch_repository_by_id(&db_path, repository_id.trim())?
        .ok_or_else(|| "Repositorio nao encontrado".to_string())?;

    if repository.organization_id.as_deref() != Some(organization_id.trim()) {
        return Err("Repositorio nao pertence a esta empresa".to_string());
    }

    let local_path = repository
        .local_path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Repositorio sem pasta local configurada".to_string())?;

    suggest_organization_identity_from_repository(
        repository_id.trim(),
        &repository.name,
        local_path,
    )
}

#[tauri::command]
pub fn update_organization_environment(
    organization_id: String,
    provider_type: Option<String>,
    provider_host: Option<String>,
    ssh_host_alias: Option<String>,
    git_user_name: Option<String>,
    git_user_email: Option<String>,
    branch_pattern: Option<String>,
    pr_convention: Option<String>,
    commit_convention: Option<String>,
    notes_json: Option<String>,
) -> Result<UpdateOrganizationEnvironmentResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;

    if organization_id.trim().is_empty() {
        return Err("Empresa invalida".to_string());
    }

    let provider_type = normalize_string(provider_type);
    let provider_host = normalize_string(provider_host);
    let ssh_host_alias = normalize_string(ssh_host_alias);
    let git_user_name = normalize_string(git_user_name);
    let git_user_email = normalize_string(git_user_email);
    let branch_pattern = normalize_string(branch_pattern);
    let pr_convention = normalize_string(pr_convention);
    let commit_convention = normalize_string(commit_convention);
    let notes_json = normalize_string(notes_json);

    let organization = update_environment_profile_for_org(
        &db_path,
        organization_id.trim(),
        provider_type.as_deref(),
        provider_host.as_deref(),
        ssh_host_alias.as_deref(),
        git_user_name.as_deref(),
        git_user_email.as_deref(),
        branch_pattern.as_deref(),
        pr_convention.as_deref(),
        commit_convention.as_deref(),
        notes_json.as_deref(),
    )?;

    Ok(UpdateOrganizationEnvironmentResultDto { organization })
}

#[tauri::command]
pub fn create_project(
    organization_id: String,
    name: String,
    description: Option<String>,
) -> Result<CreateProjectResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;

    let trimmed_name = name.trim();
    if trimmed_name.is_empty() {
        return Err("Informe o nome do projeto".to_string());
    }

    if organization_id.trim().is_empty() {
        return Err("Selecione uma empresa".to_string());
    }

    let description = normalize_string(description);
    let project = insert_project(
        &db_path,
        organization_id.trim(),
        trimmed_name,
        description.as_deref(),
    )?;

    Ok(CreateProjectResultDto { project })
}

#[tauri::command]
pub fn update_project(
    project_id: String,
    name: Option<String>,
    description: Option<String>,
    is_active: Option<bool>,
) -> Result<UpdateProjectResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;

    if project_id.trim().is_empty() {
        return Err("Projeto invalido".to_string());
    }

    let project = update_project_record(
        &db_path,
        project_id.trim(),
        name.as_deref(),
        description.as_deref(),
        is_active,
    )?;

    Ok(UpdateProjectResultDto { project })
}

#[tauri::command]
pub fn update_repository_context(
    repository_id: String,
    organization_id: String,
    project_id: Option<String>,
) -> Result<UpdateRepositoryContextResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;

    if repository_id.trim().is_empty() {
        return Err("Repositorio invalido".to_string());
    }

    if organization_id.trim().is_empty() {
        return Err("Selecione uma empresa".to_string());
    }

    let resolved_project = normalize_string(project_id);
    validate_repository_assignment(&db_path, organization_id.trim(), resolved_project.as_deref())?;
    validate_work_context_links(
        &db_path,
        &WorkContextLinksInput {
            organization_id: Some(organization_id.trim().to_string()),
            project_id: resolved_project.clone(),
            repository_id: Some(repository_id.trim().to_string()),
        },
    )?;

    let repository = apply_repository_context(
        &db_path,
        repository_id.trim(),
        organization_id.trim(),
        resolved_project.as_deref(),
    )?;

    Ok(UpdateRepositoryContextResultDto { repository })
}

#[tauri::command]
pub fn resolve_work_context(
    organization_id: Option<String>,
    project_id: Option<String>,
    repository_id: Option<String>,
) -> Result<ResolvedWorkContextDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    resolve_work_context_model(
        &db_path,
        normalize_string(organization_id),
        normalize_string(project_id),
        normalize_string(repository_id),
    )
}

fn normalize_string(value: Option<String>) -> Option<String> {
    value
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
}
