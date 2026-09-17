use crate::db::{
    accept_inbox_work_item as persist_accept_inbox, commit_today_plan,
    detach_work_item_artifact as persist_detach_artifact, dismiss_work_item as persist_dismiss_work_item,
    ensure_db_ready, escape_sql, fetch_all_dependencies, fetch_artifact_by_id, fetch_inbox_work_items,
    fetch_note_by_id, fetch_repository_by_id, fetch_session_by_id, fetch_work_item_by_id,
    fetch_work_items, find_work_item_by_external_key, nullable_sql, resolve_db_path,
    resolve_primary_workspace_id, restore_dismissed_work_item as persist_restore_dismissed_work_item,
    sqlite_exec, sqlite_json,
};
use crate::domain::{
    build_context_switch_origin, build_continue_work_for_organization, build_session_handoff_summary,
    build_today_plan, create_work_item as persist_work_item,
    create_work_item_dependency as insert_dependency,
    delete_work_item_dependency as remove_dependency, duplicate_work_item as persist_duplicate,
    format_merge_request_title, load_task_context, merge_request_metadata_json,
    parse_merge_request_url, update_work_item as persist_work_item_update,
};
use crate::dto::{
    ApplyWorkItemContextResultDto, AttachArtifactResultDto, CommitTodayPlanResultDto,
    ContextSwitchOriginDto, ContinueWorkDto, DetachArtifactResultDto, EndSessionResultDto,
    SaveNoteResultDto, SaveWorkItemResultDto, SessionGitActivityDto, SessionHandoffSummaryDto,
    StartSessionResultDto, TaskContextDto,
};
use crate::git::{
    apply_repository_full_context, git_snapshot, list_session_commits,
    load_guardrail_for_repository, resolve_diverging_worktree_path,
};
use crate::integrations::extract_ticket_keys_from_branch;
use crate::util::{
    compose_handoff_resume_summary, encode_session_links_json, iso_now, unix_timestamp_millis,
};

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
pub fn list_inbox_work_items() -> Result<Vec<crate::dto::WorkItemDto>, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    fetch_inbox_work_items(&db_path)
}

#[tauri::command]
pub fn accept_inbox_work_item(work_item_id: String) -> Result<SaveWorkItemResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    let task = persist_accept_inbox(&db_path, &work_item_id)?;
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
    let work_item = work_item_id
        .as_ref()
        .map(|id| fetch_work_item_by_id(&db_path, id))
        .transpose()?
        .flatten();

    let snapshot = repository
        .as_ref()
        .and_then(|repo| repo.local_path.as_ref())
        .and_then(|path| git_snapshot(path).ok());
    let branch_name = snapshot
        .as_ref()
        .and_then(|entry| entry.branch_name.clone());
    let started_head = snapshot.as_ref().and_then(|entry| entry.head_sha.clone());
    let worktree_path = repository
        .as_ref()
        .and_then(|repo| repo.local_path.as_deref())
        .and_then(resolve_diverging_worktree_path);

    let git_activity = SessionGitActivityDto {
        started_branch: branch_name.clone(),
        ended_branch: None,
        started_head,
        ended_head: None,
        commits: Vec::new(),
        worktree_path,
    };
    let links_json = encode_session_links_json(&git_activity)?;

    let organization_id = work_item
        .as_ref()
        .and_then(|item| item.organization_id.clone())
        .or_else(|| {
            repository
                .as_ref()
                .and_then(|repo| repo.organization_id.clone())
        });
    let project_id = work_item
        .as_ref()
        .and_then(|item| item.project_id.clone())
        .or_else(|| repository.as_ref().and_then(|repo| repo.project_id.clone()));

    let session_id = format!("session-{}", unix_timestamp_millis()?);
    let now = iso_now()?;
    let workspace_id = resolve_primary_workspace_id(&db_path)?;

    sqlite_exec(
        &db_path,
        &format!(
            "INSERT INTO session_logs (
              id, workspace_id, work_item_id, organization_id, project_id, repository_id,
              branch_name, started_at, goal, links_json, source_type, created_at, updated_at
            ) VALUES (
              '{}', '{}', {}, {}, {}, {}, {}, '{}', {}, {}, 'captured', '{}', '{}'
            );",
            escape_sql(&session_id),
            escape_sql(&workspace_id),
            nullable_sql(work_item_id.as_deref()),
            nullable_sql(organization_id.as_deref()),
            nullable_sql(project_id.as_deref()),
            nullable_sql(repository_id.as_deref()),
            nullable_sql(branch_name.as_deref()),
            escape_sql(&now),
            nullable_sql(goal.as_deref()),
            nullable_sql(Some(links_json.as_str())),
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
pub fn get_session_handoff_summary(
    session_id: String,
) -> Result<SessionHandoffSummaryDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    build_session_handoff_summary(&db_path, &session_id)
}

#[tauri::command]
pub fn get_context_switch_origin(
    session_id: Option<String>,
    repository_id: Option<String>,
    work_item_id: Option<String>,
) -> Result<ContextSwitchOriginDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    build_context_switch_origin(
        &db_path,
        session_id.as_deref(),
        repository_id.as_deref(),
        work_item_id.as_deref(),
    )
}

#[tauri::command]
pub fn get_organization_continue_work(
    organization_id: String,
) -> Result<Option<ContinueWorkDto>, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    let backlog = fetch_work_items(&db_path)?;
    build_continue_work_for_organization(&db_path, &backlog, &organization_id)
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
    let result_for_resume = result.clone();
    let decisions_for_resume = decisions.clone();

    let existing = fetch_session_by_id(&db_path, &session_id)?
        .ok_or_else(|| "Sessao nao encontrada.".to_string())?;

    let mut git_activity = existing
        .git_activity
        .clone()
        .unwrap_or_else(|| SessionGitActivityDto {
            started_branch: existing.branch_name.clone(),
            ..SessionGitActivityDto::default()
        });

    if let Some(repository_id) = existing.repository_id.as_deref() {
        if let Some(repository) = fetch_repository_by_id(&db_path, repository_id)? {
            if let Some(local_path) = repository
                .local_path
                .as_deref()
                .filter(|path| !path.trim().is_empty())
            {
                if let Ok(snapshot) = git_snapshot(local_path) {
                    git_activity.ended_branch = snapshot.branch_name;
                    git_activity.ended_head = snapshot.head_sha;
                }
                git_activity.commits = list_session_commits(
                    local_path,
                    &existing.started_at,
                    git_activity.started_head.as_deref(),
                    20,
                );
                if let Some(path) = resolve_diverging_worktree_path(local_path) {
                    git_activity.worktree_path = Some(path);
                }
            }
        }
    }

    let links_json = encode_session_links_json(&git_activity)?;

    sqlite_exec(
        &db_path,
        &format!(
            "UPDATE session_logs
             SET ended_at = '{}',
                 result = {},
                 decisions = {},
                 links_json = {},
                 updated_at = '{}'
             WHERE id = '{}';",
            escape_sql(&now),
            nullable_sql(result.as_deref()),
            nullable_sql(decisions.as_deref()),
            nullable_sql(Some(links_json.as_str())),
            escape_sql(&now),
            escape_sql(&session_id)
        ),
    )?;

    let session = fetch_session_by_id(&db_path, &session_id)?
        .ok_or_else(|| "Nao foi possivel carregar a sessao encerrada".to_string())?;

    if let Some(resume_summary) =
        compose_handoff_resume_summary(result_for_resume.as_deref(), decisions_for_resume.as_deref())
    {
        if let Some(work_item_id) = session.work_item_id.as_deref() {
            if let Some(task) = fetch_work_item_by_id(&db_path, work_item_id)? {
                let workspace_id = resolve_primary_workspace_id(&db_path)?;
                let _ = persist_work_item_update(
                    &db_path,
                    &workspace_id,
                    work_item_id,
                    task.title,
                    task.description,
                    Some(task.status),
                    Some(task.priority),
                    task.organization_id,
                    task.project_id,
                    task.primary_repository_id,
                    task.blocked_reason,
                    Some(resume_summary),
                );
            }
        }
    }

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
    role: Option<String>,
) -> Result<AttachArtifactResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    let artifact_id = format!("artifact-{}", unix_timestamp_millis()?);
    let now = iso_now()?;
    let workspace_id = resolve_primary_workspace_id(&db_path)?;
    let trimmed_url = url
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    let parsed_mr = trimmed_url
        .as_deref()
        .and_then(parse_merge_request_url);
    let resolved_artifact_type = resolve_artifact_type(&artifact_type, trimmed_url.as_deref());
    let trimmed_title = title
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    let resolved_title = if trimmed_title.is_some() {
        trimmed_title
    } else {
        parsed_mr
            .as_ref()
            .map(|parsed| format_merge_request_title(parsed, role.as_deref()))
    };
    let metadata_json = parsed_mr
        .as_ref()
        .map(|parsed| merge_request_metadata_json(parsed, role.as_deref()))
        .transpose()?;
    let artifact_source_type = if trimmed_url.is_some() {
        "imported"
    } else {
        "manual"
    };

    if let Some(url) = trimmed_url.as_deref() {
        let existing = sqlite_json(
            &db_path,
            &format!(
                "SELECT a.id
                 FROM artifacts a
                 INNER JOIN entity_links l ON l.to_entity_id = a.id
                 WHERE l.from_entity_type = 'work_item'
                   AND l.from_entity_id = '{}'
                   AND l.to_entity_type = 'artifact'
                   AND lower(COALESCE(a.url, '')) = lower('{}')
                 LIMIT 1;",
                escape_sql(&work_item_id),
                escape_sql(url)
            ),
        )?;
        if !existing.is_empty() {
            return Err("Este MR ja esta vinculado a esta tarefa.".to_string());
        }
    }

    sqlite_exec(
        &db_path,
        &format!(
            "INSERT INTO artifacts (
              id, workspace_id, repository_id, type, title, url, metadata_json, source_type, created_at, updated_at
            ) VALUES (
              '{}', '{}', {}, '{}', {}, {}, {}, '{}', '{}', '{}'
            );",
            escape_sql(&artifact_id),
            escape_sql(&workspace_id),
            nullable_sql(repository_id.as_deref()),
            escape_sql(&resolved_artifact_type),
            nullable_sql(resolved_title.as_deref()),
            nullable_sql(trimmed_url.as_deref()),
            nullable_sql(metadata_json.as_deref()),
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
pub fn detach_task_artifact(
    work_item_id: String,
    artifact_id: String,
) -> Result<DetachArtifactResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    persist_detach_artifact(&db_path, &work_item_id, &artifact_id)?;
    Ok(DetachArtifactResultDto { artifact_id })
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
    work_item_ids: Option<Vec<String>>,
) -> Result<CommitTodayPlanResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;

    let resolved_ids = match work_item_ids {
        Some(ids) if !ids.is_empty() => ids,
        _ => {
            let backlog = fetch_work_items(&db_path)?;
            let dependencies = fetch_all_dependencies(&db_path)?;
            build_today_plan(&backlog, &dependencies)
                .into_iter()
                .map(|item| item.work_item_id)
                .collect()
        }
    };

    if resolved_ids.is_empty() {
        return Err(
            "Nenhuma tarefa elegivel para montar o dia. Crie ou importe tarefas em todo/doing."
                .to_string(),
        );
    }

    let today_plan = commit_today_plan(&db_path, &resolved_ids)?;

    Ok(CommitTodayPlanResultDto { today_plan })
}

fn resolve_artifact_type(requested: &str, url: Option<&str>) -> String {
    let trimmed = requested.trim();
    if !trimmed.is_empty() && trimmed != "link" {
        return trimmed.to_string();
    }

    if url.is_some_and(crate::domain::is_merge_request_url) {
        return "pr".to_string();
    }

    if trimmed.is_empty() {
        "link".to_string()
    } else {
        trimmed.to_string()
    }
}
