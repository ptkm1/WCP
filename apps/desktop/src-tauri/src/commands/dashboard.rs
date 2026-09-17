use crate::db::{
    ensure_db_ready, fetch_active_session, fetch_all_dependencies, fetch_artifacts_for_work_item,
    fetch_inbox_work_items, fetch_linked_merge_requests, fetch_notes_for_entity, fetch_organizations,
    fetch_persisted_today_plan, fetch_projects, fetch_recent_sessions_by_work_item,
    fetch_repositories, fetch_repository_by_id, fetch_task_dependencies, fetch_work_items,
    resolve_db_path,
};
use crate::domain::{
    build_continue_work, build_multi_focus_groups, build_recoverable_context, build_today_focus,
    build_today_plan, build_today_summary, resolve_focus_task, resolve_repository_id_for_focus,
};
use crate::dto::{DashboardDto, PlanItemDto, WorkItemDto};
use crate::git::load_guardrail_for_repository;
use std::collections::HashSet;

fn filter_work_items_by_organization(
    items: Vec<WorkItemDto>,
    organization_id: Option<&str>,
) -> Vec<WorkItemDto> {
    let Some(organization_id) = organization_id else {
        return items;
    };
    items
        .into_iter()
        .filter(|item| item.organization_id.as_deref() == Some(organization_id))
        .collect()
}

fn filter_today_plan_by_backlog(
    today_plan: Vec<PlanItemDto>,
    backlog: &[WorkItemDto],
) -> Vec<PlanItemDto> {
    let allowed: HashSet<&str> = backlog.iter().map(|item| item.id.as_str()).collect();
    today_plan
        .into_iter()
        .filter(|item| allowed.contains(item.work_item_id.as_str()))
        .collect()
}

#[tauri::command]
pub fn load_dashboard_data(organization_id: Option<String>) -> Result<DashboardDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    let organization_id = organization_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty() && *value != "all")
        .map(str::to_string);

    let backlog =
        filter_work_items_by_organization(fetch_work_items(&db_path)?, organization_id.as_deref());
    let active_session = fetch_active_session(&db_path)?;
    let dependencies = fetch_all_dependencies(&db_path)?;
    let summary = build_today_summary(&backlog);
    let today_plan = match fetch_persisted_today_plan(&db_path)? {
        Some(plan) => filter_today_plan_by_backlog(plan, &backlog),
        None => build_today_plan(&backlog, &dependencies),
    };
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
    let backlog_ids: HashSet<&str> = backlog.iter().map(|item| item.id.as_str()).collect();
    let merge_requests = fetch_linked_merge_requests(&db_path)?
        .into_iter()
        .filter(|item| backlog_ids.contains(item.work_item_id.as_str()))
        .collect();
    let recoverable_context = current_task
        .as_ref()
        .map(|task| build_recoverable_context(task, &backlog))
        .unwrap_or_default();
    let continue_work = build_continue_work(
        &db_path,
        &backlog,
        active_session.as_ref(),
        current_task.as_ref(),
    )?;
    let organizations = fetch_organizations(&db_path)?;
    let projects = fetch_projects(&db_path)?;
    let repositories = fetch_repositories(&db_path)?;
    let multi_focus_groups =
        build_multi_focus_groups(&backlog, &organizations, &projects, &repositories);
    let guardrail = match repository_id.as_deref() {
        Some(id) => load_guardrail_for_repository(&db_path, id)?,
        None => None,
    };
    let inbox = filter_work_items_by_organization(
        fetch_inbox_work_items(&db_path)?,
        organization_id.as_deref(),
    );

    Ok(DashboardDto {
        summary,
        today_focus,
        current_task,
        active_session,
        continue_work,
        multi_focus_groups,
        recent_task_sessions,
        task_notes,
        task_artifacts,
        merge_requests,
        today_plan,
        recoverable_context,
        guardrail,
        backlog,
        inbox,
    })
}
