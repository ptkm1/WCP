use crate::db::{
    ensure_db_ready, escape_sql, fetch_repository_by_id, resolve_db_path, sqlite_exec,
};
use crate::dto::{
    ApplyIdentityResultDto, InstallPrePushHookResultDto, RemovePrePushHookResultDto,
    RepositoryHookStatusDto,
};
use crate::git::{load_guardrail_for_repository, run_git_config};
use crate::hooks::{
    install_pre_push_hook, read_pre_push_hook_status, remove_managed_pre_push_hook,
};

#[tauri::command]
pub fn apply_repository_identity(repository_id: String) -> Result<ApplyIdentityResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    let guardrail = load_guardrail_for_repository(&db_path, &repository_id)?
        .ok_or_else(|| "Repositorio nao encontrado".to_string())?;

    let local_path = guardrail
        .local_path
        .clone()
        .ok_or_else(|| "Repositorio sem caminho local configurado".to_string())?;

    let mut applied_changes = Vec::new();

    if let Some(user_name) = guardrail.expected_git_user_name.clone() {
        run_git_config(&local_path, "user.name", &user_name)?;
        applied_changes.push(format!("user.name={user_name}"));
    }

    if let Some(user_email) = guardrail.expected_git_user_email.clone() {
        run_git_config(&local_path, "user.email", &user_email)?;
        applied_changes.push(format!("user.email={user_email}"));
    }

    sqlite_exec(
        &db_path,
        &format!(
            "UPDATE repository_identities SET last_validated_at = datetime('now') WHERE repository_id = '{}';",
            escape_sql(&repository_id)
        ),
    )?;

    let refreshed = load_guardrail_for_repository(&db_path, &repository_id)?;

    Ok(ApplyIdentityResultDto {
        repository_id,
        applied_changes,
        validation: refreshed.and_then(|entry| entry.validation),
    })
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
