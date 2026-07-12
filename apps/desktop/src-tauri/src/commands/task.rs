use crate::db::{
    commit_today_plan, dismiss_work_item as persist_dismiss_work_item, ensure_db_ready,
    escape_sql, fetch_artifact_by_id, fetch_note_by_id, fetch_repository_by_id,
    fetch_session_by_id, fetch_work_item_by_id, find_work_item_by_external_key, nullable_sql,
    resolve_db_path, resolve_primary_workspace_id, restore_dismissed_work_item as persist_restore_dismissed_work_item,
    sqlite_exec,
};
use crate::domain::{
    create_work_item as persist_work_item, create_work_item_dependency as insert_dependency,
    delete_work_item_dependency as remove_dependency, duplicate_work_item as persist_duplicate,
    load_task_context, update_work_item as persist_work_item_update,
};
use crate::dto::{
    ApplyWorkItemContextResultDto, AttachArtifactResultDto, CommitTodayPlanResultDto,
    EndSessionResultDto, SaveNoteResultDto, SaveWorkItemResultDto, StartSessionResultDto,
    TaskContextDto,
};
use crate::git::{apply_repository_full_context, git_snapshot, load_guardrail_for_repository};
use crate::integrations::extract_ticket_keys_from_branch;
use crate::util::{iso_now, unix_timestamp_millis};

#[tauri::command]
pub fn get_task_context(work_item_id: String) -> Result<TaskContextDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    load_task_context(&db_path, &work_item_id)
}

#[tauri::command]
pub fn create_work_item(
    title: String,
    description: Option<String>,
    status: Option<String>,
    priority: Option<i64>,
    organization_id: Option<String>,
    project_id: Option<String>,
    primary_repository_id: Option<String>,
    blocked_reason: Option<String>,
    resume_summary: Option<String>,
) -> Result<SaveWorkItemResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    let workspace_id = resolve_primary_workspace_id(&db_path)?;

    let task = persist_work_item(
        &db_path,
        &workspace_id,
        title,
        description,
        status,
        priority,
        organization_id,
        project_id,
        primary_repository_id,
        blocked_reason,
        resume_summary,
    )?;

    Ok(SaveWorkItemResultDto { task })
}

#[tauri::command]
pub fn update_work_item(
    work_item_id: String,
    title: String,
    description: Option<String>,
    status: Option<String>,
    priority: Option<i64>,
    organization_id: Option<String>,
    project_id: Option<String>,
    primary_repository_id: Option<String>,
    blocked_reason: Option<String>,
    resume_summary: Option<String>,
) -> Result<SaveWorkItemResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    let workspace_id = resolve_primary_workspace_id(&db_path)?;

    let task = persist_work_item_update(
        &db_path,
        &workspace_id,
        &work_item_id,
        title,
        description,
        status,
        priority,
        organization_id,
        project_id,
        primary_repository_id,
        blocked_reason,
        resume_summary,
    )?;

    Ok(SaveWorkItemResultDto { task })
}

#[tauri::command]
pub fn dismiss_work_item_command(work_item_id: String) -> Result<SaveWorkItemResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    let task = persist_dismiss_work_item(&db_path, &work_item_id)?;
    Ok(SaveWorkItemResultDto { task })
}

#[tauri::command]
pub fn restore_dismissed_work_item_command(
    work_item_id: String,
) -> Result<SaveWorkItemResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    let task = persist_restore_dismissed_work_item(&db_path, &work_item_id)?;
    Ok(SaveWorkItemResultDto { task })
}

#[tauri::command]
pub fn duplicate_work_item(work_item_id: String) -> Result<SaveWorkItemResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    let workspace_id = resolve_primary_workspace_id(&db_path)?;

    let task = persist_duplicate(&db_path, &workspace_id, &work_item_id)?;

    Ok(SaveWorkItemResultDto { task })
}

#[tauri::command]
pub fn create_work_item_dependency(
    from_work_item_id: String,
    to_work_item_id: String,
    dependency_type: Option<String>,
    context_work_item_id: String,
) -> Result<TaskContextDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;

    insert_dependency(
        &db_path,
        &from_work_item_id,
        &to_work_item_id,
        dependency_type,
    )?;

    load_task_context(&db_path, &context_work_item_id)
}

#[tauri::command]
pub fn delete_work_item_dependency(
    dependency_id: String,
    context_work_item_id: String,
) -> Result<TaskContextDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;

    remove_dependency(&db_path, &dependency_id)?;

    load_task_context(&db_path, &context_work_item_id)
}

#[tauri::command]
pub fn start_session(
    work_item_id: Option<String>,
    repository_id: Option<String>,
    goal: Option<String>,
) -> Result<StartSessionResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    let repository = repository_id
        .as_ref()
        .map(|id| fetch_repository_by_id(&db_path, id))
        .transpose()?
        .flatten();

    let branch_name = repository
        .as_ref()
        .and_then(|repo| repo.local_path.as_ref())
        .and_then(|path| git_snapshot(path).ok())
        .and_then(|snapshot| snapshot.branch_name);

    let session_id = format!("session-{}", unix_timestamp_millis()?);
    let now = iso_now()?;
    let workspace_id = resolve_primary_workspace_id(&db_path)?;

    sqlite_exec(
        &db_path,
        &format!(
            "INSERT INTO session_logs (
              id, workspace_id, work_item_id, repository_id, branch_name, started_at, goal, source_type, created_at, updated_at
            ) VALUES (
              '{}', '{}', {}, {}, {}, '{}', {}, 'captured', '{}', '{}'
            );",
            escape_sql(&session_id),
            escape_sql(&workspace_id),
            nullable_sql(work_item_id.as_deref()),
            nullable_sql(repository_id.as_deref()),
            nullable_sql(branch_name.as_deref()),
            escape_sql(&now),
            nullable_sql(goal.as_deref()),
            escape_sql(&now),
            escape_sql(&now)
        ),
    )?;

    let session = fetch_session_by_id(&db_path, &session_id)?
        .ok_or_else(|| "Nao foi possivel carregar a sessao criada".to_string())?;

    let suggested_work_item_id = if work_item_id.is_none() {
        repository
            .as_ref()
            .and_then(|repo| repo.organization_id.as_deref())
            .and_then(|organization_id| {
                branch_name.as_deref().and_then(|branch| {
                    extract_ticket_keys_from_branch(branch)
                        .into_iter()
                        .find_map(|key| {
                            find_work_item_by_external_key(&db_path, organization_id, &key)
                                .ok()
                                .flatten()
                        })
                })
            })
    } else {
        None
    };

    Ok(StartSessionResultDto {
        session,
        suggested_work_item_id,
    })
}

#[tauri::command]
pub fn end_session(
    session_id: String,
    result: Option<String>,
    decisions: Option<String>,
) -> Result<EndSessionResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    let now = iso_now()?;

    sqlite_exec(
        &db_path,
        &format!(
            "UPDATE session_logs
             SET ended_at = '{}',
                 result = {},
                 decisions = {},
                 updated_at = '{}'
             WHERE id = '{}';",
            escape_sql(&now),
            nullable_sql(result.as_deref()),
            nullable_sql(decisions.as_deref()),
            escape_sql(&now),
            escape_sql(&session_id)
        ),
    )?;

    let session = fetch_session_by_id(&db_path, &session_id)?
        .ok_or_else(|| "Nao foi possivel carregar a sessao encerrada".to_string())?;

    Ok(EndSessionResultDto { session })
}

#[tauri::command]
pub fn save_task_note(
    work_item_id: String,
    title: String,
    content: String,
    note_type: Option<String>,
) -> Result<SaveNoteResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    let note_id = format!("note-{}", unix_timestamp_millis()?);
    let now = iso_now()?;
    let resolved_note_type = note_type.unwrap_or_else(|| "decision".to_string());
    let workspace_id = resolve_primary_workspace_id(&db_path)?;

    sqlite_exec(
        &db_path,
        &format!(
            "INSERT INTO knowledge_notes (
              id, workspace_id, entity_type, entity_id, note_type, title, content, source_type, created_at, updated_at
            ) VALUES (
              '{}', '{}', 'work_item', '{}', '{}', '{}', '{}', 'manual', '{}', '{}'
            );",
            escape_sql(&note_id),
            escape_sql(&workspace_id),
            escape_sql(&work_item_id),
            escape_sql(&resolved_note_type),
            escape_sql(&title),
            escape_sql(&content),
            escape_sql(&now),
            escape_sql(&now)
        ),
    )?;

    let note = fetch_note_by_id(&db_path, &note_id)?
        .ok_or_else(|| "Nao foi possivel carregar a nota criada".to_string())?;

    Ok(SaveNoteResultDto { note })
}

#[tauri::command]
pub fn attach_task_artifact(
    work_item_id: String,
    repository_id: Option<String>,
    artifact_type: String,
    title: Option<String>,
    url: Option<String>,
) -> Result<AttachArtifactResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    let artifact_id = format!("artifact-{}", unix_timestamp_millis()?);
    let now = iso_now()?;
    let workspace_id = resolve_primary_workspace_id(&db_path)?;
    let trimmed_url = url.as_ref().map(|value| value.trim()).filter(|value| !value.is_empty());
    let artifact_source_type = if trimmed_url.is_some() {
        "imported"
    } else {
        "manual"
    };

    sqlite_exec(
        &db_path,
        &format!(
            "INSERT INTO artifacts (
              id, workspace_id, repository_id, type, title, url, source_type, created_at, updated_at
            ) VALUES (
              '{}', '{}', {}, '{}', {}, {}, '{}', '{}', '{}'
            );",
            escape_sql(&artifact_id),
            escape_sql(&workspace_id),
            nullable_sql(repository_id.as_deref()),
            escape_sql(&artifact_type),
            nullable_sql(title.as_deref()),
            nullable_sql(url.as_deref()),
            escape_sql(artifact_source_type),
            escape_sql(&now),
            escape_sql(&now)
        ),
    )?;

    sqlite_exec(
        &db_path,
        &format!(
            "INSERT INTO entity_links (
              id, from_entity_type, from_entity_id, to_entity_type, to_entity_id, link_type, score, source_type, created_at, updated_at
            ) VALUES (
              'link-{}', 'work_item', '{}', 'artifact', '{}', 'references', 1, 'manual', '{}', '{}'
            );",
            escape_sql(&artifact_id),
            escape_sql(&work_item_id),
            escape_sql(&artifact_id),
            escape_sql(&now),
            escape_sql(&now)
        ),
    )?;

    let artifact = fetch_artifact_by_id(&db_path, &artifact_id)?
        .ok_or_else(|| "Nao foi possivel carregar o artefato criado".to_string())?;

    Ok(AttachArtifactResultDto { artifact })
}

#[tauri::command]
pub fn apply_work_item_context(work_item_id: String) -> Result<ApplyWorkItemContextResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;

    let task = fetch_work_item_by_id(&db_path, &work_item_id)?
        .ok_or_else(|| "Tarefa nao encontrada.".to_string())?;

    let Some(repository_id) = task.primary_repository_id.clone() else {
        return Ok(ApplyWorkItemContextResultDto {
            work_item_id,
            needs_repository_link: true,
            repository_id: None,
            repository_name: None,
            context: None,
            guardrail: None,
        });
    };

    let repository = fetch_repository_by_id(&db_path, &repository_id)?
        .ok_or_else(|| "Repositorio vinculado nao encontrado.".to_string())?;

    let guardrail = load_guardrail_for_repository(&db_path, &repository_id)?;
    let ssh_host_alias = guardrail
        .as_ref()
        .and_then(|entry| entry.expected_ssh_host_alias.as_deref());

    let context = apply_repository_full_context(&db_path, &repository_id, ssh_host_alias)?;
    let guardrail = load_guardrail_for_repository(&db_path, &repository_id)?;

    Ok(ApplyWorkItemContextResultDto {
        work_item_id,
        needs_repository_link: false,
        repository_id: Some(repository_id),
        repository_name: Some(repository.name),
        context: Some(context),
        guardrail,
    })
}

#[tauri::command]
pub fn commit_today_plan_command(
    work_item_ids: Vec<String>,
) -> Result<CommitTodayPlanResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    let today_plan = commit_today_plan(&db_path, &work_item_ids)?;

    Ok(CommitTodayPlanResultDto { today_plan })
}
