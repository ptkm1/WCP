use crate::db::{
    ensure_db_ready, fetch_active_session, fetch_all_dependencies, fetch_artifacts_for_work_item,
    fetch_notes_for_entity, fetch_recent_sessions_by_work_item, fetch_repository_by_id,
    fetch_task_dependencies, fetch_work_items, resolve_db_path,
};
use crate::domain::{
    build_recoverable_context, build_today_focus, build_today_plan, build_today_summary,
    resolve_focus_task, resolve_repository_id_for_focus,
};
use crate::dto::DashboardDto;
use crate::git::load_guardrail_for_repository;

#[tauri::command]
pub fn load_dashboard_data() -> Result<DashboardDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    let backlog = fetch_work_items(&db_path)?;
    let active_session = fetch_active_session(&db_path)?;
    let dependencies = fetch_all_dependencies(&db_path)?;
    let summary = build_today_summary(&backlog);
    let today_plan = build_today_plan(&backlog, &dependencies);
    let current_task = resolve_focus_task(&backlog, &today_plan, &active_session);
    let focus_dependencies = if let Some(task) = current_task.as_ref() {
        fetch_task_dependencies(&db_path, &task.id)?
    } else {
        Vec::new()
    };
    let repository_id = resolve_repository_id_for_focus(&db_path, &active_session, &current_task)?;
    let primary_repository_name = if let Some(ref id) = repository_id {
        fetch_repository_by_id(&db_path, id)?.map(|repository| repository.name)
    } else if let Some(task) = current_task.as_ref() {
        task.primary_repository_id
            .as_ref()
            .and_then(|id| fetch_repository_by_id(&db_path, id).ok().flatten())
            .map(|repository| repository.name)
    } else {
        None
    };
    let today_focus = build_today_focus(
        &backlog,
        &today_plan,
        &active_session,
        current_task.as_ref(),
        &focus_dependencies,
        primary_repository_name,
    );
    let recent_task_sessions = current_task
        .as_ref()
        .map(|task| fetch_recent_sessions_by_work_item(&db_path, &task.id))
        .transpose()?
        .unwrap_or_default();
    let task_notes = current_task
        .as_ref()
        .map(|task| fetch_notes_for_entity(&db_path, "work_item", &task.id))
        .transpose()?
        .unwrap_or_default();
    let task_artifacts = current_task
        .as_ref()
        .map(|task| fetch_artifacts_for_work_item(&db_path, &task.id))
        .transpose()?
        .unwrap_or_default();
    let recoverable_context = current_task
        .as_ref()
        .map(|task| build_recoverable_context(task, &backlog))
        .unwrap_or_default();
    let guardrail = match repository_id.as_deref() {
        Some(id) => load_guardrail_for_repository(&db_path, id)?,
        None => None,
    };

    Ok(DashboardDto {
        summary,
        today_focus,
        current_task,
        active_session,
        recent_task_sessions,
        task_notes,
        task_artifacts,
        today_plan,
        recoverable_context,
        guardrail,
        backlog,
    })
}
