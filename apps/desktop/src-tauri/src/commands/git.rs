use crate::db::{ensure_db_ready, fetch_repository_by_id, resolve_db_path};
use crate::dto::{
    ApplyFullContextResultDto, ApplyIdentityResultDto, FixRepositoryRemoteResultDto,
    InstallPrePushHookResultDto, RemovePrePushHookResultDto, RepositoryHookStatusDto,
};
use crate::git::{
    apply_repository_full_context as apply_full_context_to_repo,
    apply_repository_identity_changes, apply_repository_remote_ssh_alias,
    load_guardrail_for_repository,
};
use crate::hooks::{
    install_pre_push_hook, read_pre_push_hook_status, remove_managed_pre_push_hook,
};

#[tauri::command]
pub fn apply_repository_identity(repository_id: String) -> Result<ApplyIdentityResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;

    let applied_changes = apply_repository_identity_changes(&db_path, &repository_id)?;
    let refreshed = load_guardrail_for_repository(&db_path, &repository_id)?;

    Ok(ApplyIdentityResultDto {
        repository_id,
        applied_changes,
        validation: refreshed.and_then(|entry| entry.validation),
    })
}

#[tauri::command]
pub fn apply_repository_full_context(
    repository_id: String,
    ssh_host_alias: Option<String>,
) -> Result<ApplyFullContextResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;

    if repository_id.trim().is_empty() {
        return Err("Repositorio invalido".to_string());
    }

    let resolved_alias = ssh_host_alias
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());

    apply_full_context_to_repo(
        &db_path,
        repository_id.trim(),
        resolved_alias.as_deref(),
    )
}

#[tauri::command]
pub fn install_repository_pre_push_hook(
    repository_id: String,
) -> Result<InstallPrePushHookResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    let guardrail = load_guardrail_for_repository(&db_path, &repository_id)?
        .ok_or_else(|| "Repositorio nao encontrado".to_string())?;

    let local_path = guardrail
        .local_path
        .clone()
        .ok_or_else(|| "Repositorio sem caminho local configurado".to_string())?;

    let hook_path = install_pre_push_hook(&local_path, &guardrail)?;

    Ok(InstallPrePushHookResultDto {
        repository_id,
        hook_path: hook_path.display().to_string(),
        installed: true,
    })
}

#[tauri::command]
pub fn get_repository_hook_status(
    repository_id: String,
) -> Result<RepositoryHookStatusDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    let repository = fetch_repository_by_id(&db_path, &repository_id)?
        .ok_or_else(|| "Repositorio nao encontrado".to_string())?;

    let local_path = repository
        .local_path
        .ok_or_else(|| "Repositorio sem caminho local configurado".to_string())?;

    read_pre_push_hook_status(&repository_id, &local_path)
}

#[tauri::command]
pub fn remove_repository_pre_push_hook(
    repository_id: String,
) -> Result<RemovePrePushHookResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    let repository = fetch_repository_by_id(&db_path, &repository_id)?
        .ok_or_else(|| "Repositorio nao encontrado".to_string())?;

    let local_path = repository
        .local_path
        .ok_or_else(|| "Repositorio sem caminho local configurado".to_string())?;

    remove_managed_pre_push_hook(&local_path)?;

    Ok(RemovePrePushHookResultDto {
        repository_id,
        removed: true,
    })
}

#[tauri::command]
pub fn fix_repository_remote_ssh_alias(
    repository_id: String,
    ssh_host_alias: Option<String>,
) -> Result<FixRepositoryRemoteResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;

    if repository_id.trim().is_empty() {
        return Err("Repositorio invalido".to_string());
    }

    let resolved_alias = ssh_host_alias
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());

    apply_repository_remote_ssh_alias(
        &db_path,
        repository_id.trim(),
        resolved_alias.as_deref(),
    )
}
