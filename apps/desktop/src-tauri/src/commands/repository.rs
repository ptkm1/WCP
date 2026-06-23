use crate::db::{
    ensure_db_ready, escape_sql, fetch_note_by_id, fetch_notes_for_entity, fetch_repositories,
    fetch_repository_by_id, get_optional_string, resolve_db_path,
    resolve_primary_workspace_id, sqlite_exec, sqlite_json,
};
use crate::dto::{
    CreateRepositoryResultDto, LocalRepositoryInspectionDto, RepositoryListItemDto,
    RepositoryMemoryDto, SaveNoteResultDto, UpdateRepositoryResultDto,
};
use crate::git::inspect_local_repository;
use crate::util::{iso_now, unix_timestamp_millis};

#[tauri::command]
pub fn list_repositories() -> Result<Vec<RepositoryListItemDto>, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    fetch_repositories(&db_path)
}

#[tauri::command]
pub fn inspect_local_repository_path(
    local_path: String,
) -> Result<LocalRepositoryInspectionDto, String> {
    inspect_local_repository(&local_path)
}

#[tauri::command]
pub fn create_repository(
    organization_id: String,
    name: String,
    local_path: String,
    remote_url: Option<String>,
    provider_host: Option<String>,
    default_branch: Option<String>,
    project_id: Option<String>,
) -> Result<CreateRepositoryResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;

    let trimmed_name = name.trim();
    if trimmed_name.is_empty() {
        return Err("Informe o nome do repositorio".to_string());
    }

    if organization_id.trim().is_empty() || organization_id == "all" {
        return Err("Selecione uma empresa antes de cadastrar o repositorio".to_string());
    }

    let resolved_project_id = resolve_optional_string(project_id);
    if let Some(project_id) = resolved_project_id.as_deref() {
        let project_rows = sqlite_json(
            &db_path,
            &format!(
                "SELECT organization_id FROM projects WHERE id = '{}' AND is_active = 1 LIMIT 1;",
                escape_sql(project_id)
            ),
        )?;
        let Some(project_row) = project_rows.first() else {
            return Err("Projeto nao encontrado".to_string());
        };
        let project_org = get_optional_string(project_row, "organization_id");
        if let Some(project_org) = project_org {
            if project_org != organization_id {
                return Err("Projeto pertence a outra empresa".to_string());
            }
        }
    }

    let org_rows = sqlite_json(
        &db_path,
        &format!(
            "SELECT o.id, o.name AS organization_name, ep.id AS environment_profile_id, ep.provider_host, ep.ssh_host_alias,
                    ep.git_user_name, ep.git_user_email
             FROM organizations o
             LEFT JOIN environment_profiles ep ON ep.organization_id = o.id
               AND ep.id = (
                 SELECT id FROM environment_profiles
                 WHERE organization_id = o.id
                 ORDER BY is_default DESC, name ASC
                 LIMIT 1
               )
             WHERE o.id = '{}' AND o.is_active = 1
             LIMIT 1;",
            escape_sql(&organization_id)
        ),
    )?;

    let Some(org_row) = org_rows.first() else {
        return Err("Empresa nao encontrada".to_string());
    };

    let inspection = validate_git_local_path(&local_path)?;
    ensure_unique_local_path(&db_path, &inspection.local_path, None)?;

    let resolved_local_path = inspection.local_path.clone();
    let resolved_remote_url = resolve_optional_string(remote_url).or(inspection.remote_url);
    let resolved_provider_host = resolve_optional_string(provider_host)
        .or(inspection.provider_host)
        .or(get_optional_string(org_row, "provider_host"));
    let resolved_default_branch =
        resolve_optional_string(default_branch).or(inspection.default_branch);

    let repository_id = format!("repo-{}", unix_timestamp_millis()?);
    let identity_id = format!("rid-{}", unix_timestamp_millis()?);
    let now = iso_now()?;
    let workspace_id = resolve_primary_workspace_id(&db_path)?;

    sqlite_exec(
        &db_path,
        &format!(
            "INSERT INTO repositories (
              id, workspace_id, organization_id, project_id, name, local_path, provider_type,
              provider_host, remote_url, default_branch, is_active, created_at, updated_at
            ) VALUES (
              '{}', '{}', '{}', {}, '{}', '{}', 'github', {}, {}, {}, 1, '{}', '{}'
            );",
            escape_sql(&repository_id),
            escape_sql(&workspace_id),
            escape_sql(&organization_id),
            optional_sql_string(resolved_project_id.as_deref()),
            escape_sql(trimmed_name),
            escape_sql(&resolved_local_path),
            optional_sql_string(resolved_provider_host.as_deref()),
            optional_sql_string(resolved_remote_url.as_deref()),
            optional_sql_string(resolved_default_branch.as_deref()),
            escape_sql(&now),
            escape_sql(&now)
        ),
    )?;

    let environment_profile_id = get_optional_string(org_row, "environment_profile_id");
    let git_user_name = get_optional_string(org_row, "git_user_name");
    let git_user_email = get_optional_string(org_row, "git_user_email");
    let ssh_host_alias = get_optional_string(org_row, "ssh_host_alias");
    let organization_name = get_optional_string(org_row, "organization_name");

    sqlite_exec(
        &db_path,
        &format!(
            "INSERT INTO repository_identities (
              id, repository_id, environment_profile_id, git_user_name, git_user_email,
              ssh_host_alias, provider_username, provider_account_label, enforce_pre_push_check,
              created_at, updated_at
            ) VALUES (
              '{}', '{}', {}, {}, {}, {}, {}, {}, 1, '{}', '{}'
            );",
            escape_sql(&identity_id),
            escape_sql(&repository_id),
            optional_sql_string(environment_profile_id.as_deref()),
            optional_sql_string(git_user_name.as_deref()),
            optional_sql_string(git_user_email.as_deref()),
            optional_sql_string(ssh_host_alias.as_deref()),
            optional_sql_string(git_user_name.as_deref()),
            optional_sql_string(organization_name.as_deref()),
            escape_sql(&now),
            escape_sql(&now)
        ),
    )?;

    let repository = fetch_repository_by_id(&db_path, &repository_id)?
        .ok_or_else(|| "Nao foi possivel carregar o repositorio criado".to_string())?;

    Ok(CreateRepositoryResultDto { repository })
}

#[tauri::command]
pub fn update_repository_local_path(
    repository_id: String,
    local_path: String,
    remote_url: Option<String>,
    default_branch: Option<String>,
) -> Result<UpdateRepositoryResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;

    if repository_id.trim().is_empty() {
        return Err("Repositorio invalido".to_string());
    }

    let existing = fetch_repository_by_id(&db_path, &repository_id)?
        .ok_or_else(|| "Repositorio nao encontrado".to_string())?;

    let inspection = validate_git_local_path(&local_path)?;
    ensure_unique_local_path(&db_path, &inspection.local_path, Some(&repository_id))?;

    let resolved_remote_url = resolve_optional_string(remote_url).or(inspection.remote_url.clone());
    let resolved_provider_host = inspection
        .provider_host
        .clone()
        .or(existing.provider_host.clone());
    let resolved_default_branch =
        resolve_optional_string(default_branch).or(inspection.default_branch.clone());
    let now = iso_now()?;

    sqlite_exec(
        &db_path,
        &format!(
            "UPDATE repositories
             SET local_path = '{}',
                 provider_host = {},
                 remote_url = {},
                 default_branch = {},
                 updated_at = '{}'
             WHERE id = '{}';",
            escape_sql(&inspection.local_path),
            optional_sql_string(resolved_provider_host.as_deref()),
            optional_sql_string(resolved_remote_url.as_deref()),
            optional_sql_string(resolved_default_branch.as_deref()),
            escape_sql(&now),
            escape_sql(&repository_id)
        ),
    )?;

    let repository = fetch_repository_by_id(&db_path, &repository_id)?
        .ok_or_else(|| "Nao foi possivel carregar o projeto atualizado".to_string())?;

    Ok(UpdateRepositoryResultDto { repository })
}

fn validate_git_local_path(local_path: &str) -> Result<LocalRepositoryInspectionDto, String> {
    let inspection = inspect_local_repository(local_path)?;
    if !inspection.path_exists {
        return Err(format!(
            "Pasta local nao encontrada: {}",
            inspection.local_path
        ));
    }
    if !inspection.is_git_repo {
        return Err("A pasta informada nao parece ser um repositorio Git".to_string());
    }
    Ok(inspection)
}

fn ensure_unique_local_path(
    db_path: &std::path::Path,
    local_path: &str,
    exclude_repository_id: Option<&str>,
) -> Result<(), String> {
    let exclude_clause = exclude_repository_id
        .map(|repository_id| format!(" AND id <> '{}'", escape_sql(repository_id)))
        .unwrap_or_default();
    let duplicate_rows = sqlite_json(
        db_path,
        &format!(
            "SELECT id FROM repositories WHERE local_path = '{}' AND is_active = 1{} LIMIT 1;",
            escape_sql(local_path),
            exclude_clause
        ),
    )?;
    if !duplicate_rows.is_empty() {
        return Err("Ja existe um projeto cadastrado com esta pasta local".to_string());
    }
    Ok(())
}

fn resolve_optional_string(value: Option<String>) -> Option<String> {
    value.and_then(|inner| {
        let trimmed = inner.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

fn optional_sql_string(value: Option<&str>) -> String {
    match value {
        Some(inner) => format!("'{}'", escape_sql(inner)),
        None => "NULL".to_string(),
    }
}

#[tauri::command]
pub fn get_repository_guardrail(
    repository_id: String,
) -> Result<Option<crate::dto::RepositoryGuardrailDto>, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    crate::git::load_guardrail_for_repository(&db_path, &repository_id)
}

#[tauri::command]
pub fn get_repository_memory(repository_id: String) -> Result<RepositoryMemoryDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    let notes = fetch_notes_for_entity(&db_path, "repository", &repository_id)?;
    Ok(RepositoryMemoryDto {
        repository_id,
        notes,
    })
}

#[tauri::command]
pub fn save_repository_note(
    repository_id: String,
    title: String,
    content: String,
    note_type: Option<String>,
) -> Result<SaveNoteResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    let note_id = format!("note-{}", unix_timestamp_millis()?);
    let now = iso_now()?;
    let resolved_note_type = note_type.unwrap_or_else(|| "pattern".to_string());
    let workspace_id = resolve_primary_workspace_id(&db_path)?;

    sqlite_exec(
        &db_path,
        &format!(
            "INSERT INTO knowledge_notes (
              id, workspace_id, entity_type, entity_id, note_type, title, content, source_type, created_at, updated_at
            ) VALUES (
              '{}', '{}', 'repository', '{}', '{}', '{}', '{}', 'manual', '{}', '{}'
            );",
            escape_sql(&note_id),
            escape_sql(&workspace_id),
            escape_sql(&repository_id),
            escape_sql(&resolved_note_type),
            escape_sql(&title),
            escape_sql(&content),
            escape_sql(&now),
            escape_sql(&now)
        ),
    )?;

    let note = fetch_note_by_id(&db_path, &note_id)?
        .ok_or_else(|| "Nao foi possivel carregar a nota de repositorio criada".to_string())?;

    Ok(SaveNoteResultDto { note })
}
