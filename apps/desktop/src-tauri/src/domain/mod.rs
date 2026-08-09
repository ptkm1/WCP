use crate::db::{
    dependency_exists, escape_sql, fetch_artifacts_for_work_item, fetch_latest_ended_session,
    fetch_latest_ended_session_for_organization, fetch_notes_for_entity, fetch_organization_by_id,
    fetch_project_by_id, fetch_recent_sessions_by_work_item, fetch_repository_by_id,
    fetch_session_by_id, fetch_task_dependencies, fetch_work_item_by_id, fetch_work_items,
    insert_work_item, sqlite_exec, update_work_item as save_work_item_row, work_item_exists,
};
use crate::dto::{
    ContextSwitchOriginDto, ContinueWorkDto, MultiFocusGroupDto, MultiFocusTaskDto,
    OrganizationListItemDto, PlanItemDto, ProjectListItemDto, RecoverableContextCandidateDto,
    RepositoryListItemDto, SessionHandoffArtifactDto, SessionHandoffSummaryDto, SessionLogDto,
    TaskContextDto, TodayFocusDto, TodaySummary, WorkItemDto,
};
use crate::git::{list_session_commits, working_tree_status};
use crate::util::{
    compose_handoff_resume_summary, format_session_duration_label, iso_now, is_iso_date_yesterday,
    unix_timestamp_millis,
};
use std::collections::{HashMap, HashSet};
use std::path::Path;

mod context;
mod context_links;
mod context_resolve;

pub use context::resolve_repository_id_for_focus;
pub use context_links::{
    validate_repository_assignment, validate_work_context_links, validate_work_item_context,
    WorkContextLinksInput,
};
pub use context_resolve::resolve_work_context;

pub fn load_task_context(db_path: &Path, work_item_id: &str) -> Result<TaskContextDto, String> {
    let backlog = fetch_work_items(db_path)?;
    let task = backlog.iter().find(|item| item.id == work_item_id).cloned();
    let recent_task_sessions = fetch_recent_sessions_by_work_item(db_path, work_item_id)?;
    let task_notes = fetch_notes_for_entity(db_path, "work_item", work_item_id)?;
    let task_artifacts = fetch_artifacts_for_work_item(db_path, work_item_id)?;
    let recoverable_context = task
        .as_ref()
        .map(|current| build_recoverable_context(current, &backlog))
        .unwrap_or_default();
    let dependencies = fetch_task_dependencies(db_path, work_item_id)?;

    Ok(TaskContextDto {
        task,
        recent_task_sessions,
        task_notes,
        task_artifacts,
        recoverable_context,
        dependencies,
    })
}

pub fn create_work_item_dependency(
    db_path: &Path,
    from_work_item_id: &str,
    to_work_item_id: &str,
    dependency_type: Option<String>,
) -> Result<(), String> {
    if from_work_item_id == to_work_item_id {
        return Err("Origem e destino devem ser tarefas diferentes.".to_string());
    }

    if !work_item_exists(db_path, from_work_item_id)? {
        return Err("Tarefa de origem nao encontrada.".to_string());
    }

    if !work_item_exists(db_path, to_work_item_id)? {
        return Err("Tarefa de destino nao encontrada.".to_string());
    }

    if dependency_exists(db_path, from_work_item_id, to_work_item_id)? {
        return Err("Dependencia ja existe entre essas tarefas.".to_string());
    }

    if dependency_exists(db_path, to_work_item_id, from_work_item_id)? {
        return Err("Ja existe uma dependencia inversa entre essas tarefas.".to_string());
    }

    let dependency_id = format!("dep-{}", unix_timestamp_millis()?);
    let now = iso_now()?;
    let resolved_type = dependency_type.unwrap_or_else(|| "depends_on".to_string());

    sqlite_exec(
        db_path,
        &format!(
            "INSERT INTO work_item_dependencies (
              id, from_work_item_id, to_work_item_id, dependency_type, created_at, updated_at
            ) VALUES (
              '{}', '{}', '{}', '{}', '{}', '{}'
            );",
            escape_sql(&dependency_id),
            escape_sql(from_work_item_id),
            escape_sql(to_work_item_id),
            escape_sql(&resolved_type),
            escape_sql(&now),
            escape_sql(&now)
        ),
    )
}

pub fn delete_work_item_dependency(db_path: &Path, dependency_id: &str) -> Result<(), String> {
    sqlite_exec(
        db_path,
        &format!(
            "DELETE FROM work_item_dependencies WHERE id = '{}';",
            escape_sql(dependency_id)
        ),
    )
}

struct WorkItemInput {
    title: String,
    description: Option<String>,
    status: String,
    priority: i64,
    organization_id: Option<String>,
    project_id: Option<String>,
    primary_repository_id: Option<String>,
    blocked_reason: Option<String>,
    resume_summary: Option<String>,
}

fn normalize_work_item_input(
    title: String,
    description: Option<String>,
    status: Option<String>,
    priority: Option<i64>,
    organization_id: Option<String>,
    project_id: Option<String>,
    primary_repository_id: Option<String>,
    blocked_reason: Option<String>,
    resume_summary: Option<String>,
) -> Result<WorkItemInput, String> {
    let trimmed_title = title.trim();
    if trimmed_title.is_empty() {
        return Err("Informe um titulo para a tarefa.".to_string());
    }

    let resolved_status = status.unwrap_or_else(|| "todo".to_string());
    let allowed_statuses = [
        "backlog", "todo", "doing", "blocked", "done", "archived",
    ];
    if !allowed_statuses.contains(&resolved_status.as_str()) {
        return Err("Status de tarefa invalido.".to_string());
    }

    let resolved_priority = priority.unwrap_or(3);
    if !(1..=5).contains(&resolved_priority) {
        return Err("Prioridade deve ficar entre 1 e 5.".to_string());
    }

    let normalized_description = description
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let normalized_blocked_reason = blocked_reason
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let normalized_resume_summary = resume_summary
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());

    if resolved_status == "blocked" && normalized_blocked_reason.is_none() {
        return Err("Informe o motivo do bloqueio.".to_string());
    }

    let final_blocked_reason = if resolved_status == "blocked" {
        normalized_blocked_reason
    } else {
        None
    };

    Ok(WorkItemInput {
        title: trimmed_title.to_string(),
        description: normalized_description,
        status: resolved_status,
        priority: resolved_priority,
        organization_id: organization_id.filter(|value| !value.is_empty()),
        project_id: project_id.filter(|value| !value.is_empty()),
        primary_repository_id: primary_repository_id.filter(|value| !value.is_empty()),
        blocked_reason: final_blocked_reason,
        resume_summary: normalized_resume_summary,
    })
}

pub fn create_work_item(
    db_path: &Path,
    workspace_id: &str,
    title: String,
    description: Option<String>,
    status: Option<String>,
    priority: Option<i64>,
    organization_id: Option<String>,
    project_id: Option<String>,
    primary_repository_id: Option<String>,
    blocked_reason: Option<String>,
    resume_summary: Option<String>,
) -> Result<WorkItemDto, String> {
    let input = normalize_work_item_input(
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

    validate_work_item_context(
        db_path,
        input.organization_id.as_deref(),
        input.project_id.as_deref(),
        input.primary_repository_id.as_deref(),
    )?;

    insert_work_item(
        db_path,
        workspace_id,
        &input.title,
        input.description.as_deref(),
        &input.status,
        input.priority,
        input.organization_id.as_deref(),
        input.project_id.as_deref(),
        input.primary_repository_id.as_deref(),
        input.blocked_reason.as_deref(),
        input.resume_summary.as_deref(),
    )
}

pub fn duplicate_work_item(
    db_path: &Path,
    workspace_id: &str,
    work_item_id: &str,
) -> Result<WorkItemDto, String> {
    let source = fetch_work_item_by_id(db_path, work_item_id)?
        .ok_or_else(|| "Tarefa nao encontrada.".to_string())?;

    let title = if source.title.ends_with(" (copia)") {
        format!("{} 2", source.title)
    } else {
        format!("{} (copia)", source.title)
    };

    create_work_item(
        db_path,
        workspace_id,
        title,
        source.description,
        Some("todo".to_string()),
        Some(source.priority),
        source.organization_id,
        source.project_id,
        source.primary_repository_id,
        None,
        None,
    )
}

fn humanize_work_item_status(status: &str) -> &str {
    match status {
        "blocked" => "Bloqueada",
        "doing" => "Em andamento",
        "todo" => "A fazer",
        "done" => "Concluida",
        "archived" => "Arquivada",
        "backlog" => "Backlog",
        _ => status,
    }
}

fn optional_field_label(value: Option<&str>) -> String {
    value
        .filter(|entry| !entry.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| "Nenhum".to_string())
}

fn record_work_item_changes(
    db_path: &Path,
    workspace_id: &str,
    work_item_id: &str,
    before: &WorkItemDto,
    after: &WorkItemInput,
) -> Result<(), String> {
    let mut lines = Vec::new();

    if before.title != after.title {
        lines.push(format!(
            "Titulo: \"{}\" -> \"{}\"",
            before.title, after.title
        ));
    }
    if before.status != after.status {
        lines.push(format!(
            "Status: {} -> {}",
            humanize_work_item_status(&before.status),
            humanize_work_item_status(&after.status)
        ));
    }
    if before.priority != after.priority {
        lines.push(format!(
            "Prioridade: P{} -> P{}",
            before.priority, after.priority
        ));
    }
    if before.description != after.description {
        lines.push("Descricao atualizada.".to_string());
    }
    if before.blocked_reason != after.blocked_reason {
        lines.push(format!(
            "Bloqueio: {} -> {}",
            optional_field_label(before.blocked_reason.as_deref()),
            optional_field_label(after.blocked_reason.as_deref())
        ));
    }
    if before.resume_summary != after.resume_summary {
        lines.push(format!(
            "Retomada: {} -> {}",
            optional_field_label(before.resume_summary.as_deref()),
            optional_field_label(after.resume_summary.as_deref())
        ));
    }
    if before.organization_id != after.organization_id {
        lines.push("Empresa associada alterada.".to_string());
    }
    if before.project_id != after.project_id {
        lines.push("Projeto associado alterado.".to_string());
    }
    if before.primary_repository_id != after.primary_repository_id {
        lines.push("Repositorio principal alterado.".to_string());
    }

    if lines.is_empty() {
        return Ok(());
    }

    let note_id = format!("note-{}", unix_timestamp_millis()?);
    let now = iso_now()?;
    let content = lines.join("\n");

    sqlite_exec(
        db_path,
        &format!(
            "INSERT INTO knowledge_notes (
              id, workspace_id, entity_type, entity_id, note_type, title, content, source_type, created_at, updated_at
            ) VALUES (
              '{}', '{}', 'work_item', '{}', 'summary', 'Alteracao da tarefa', '{}', 'inferred', '{}', '{}'
            );",
            escape_sql(&note_id),
            escape_sql(workspace_id),
            escape_sql(work_item_id),
            escape_sql(&content),
            escape_sql(&now),
            escape_sql(&now)
        ),
    )
}

pub fn update_work_item(
    db_path: &Path,
    workspace_id: &str,
    work_item_id: &str,
    title: String,
    description: Option<String>,
    status: Option<String>,
    priority: Option<i64>,
    organization_id: Option<String>,
    project_id: Option<String>,
    primary_repository_id: Option<String>,
    blocked_reason: Option<String>,
    resume_summary: Option<String>,
) -> Result<WorkItemDto, String> {
    let before = fetch_work_item_by_id(db_path, work_item_id)?
        .ok_or_else(|| "Tarefa nao encontrada.".to_string())?;

    let input = normalize_work_item_input(
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

    validate_work_item_context(
        db_path,
        input.organization_id.as_deref(),
        input.project_id.as_deref(),
        input.primary_repository_id.as_deref(),
    )?;

    record_work_item_changes(db_path, workspace_id, work_item_id, &before, &input)?;

    save_work_item_row(
        db_path,
        work_item_id,
        &input.title,
        input.description.as_deref(),
        &input.status,
        input.priority,
        input.organization_id.as_deref(),
        input.project_id.as_deref(),
        input.primary_repository_id.as_deref(),
        input.blocked_reason.as_deref(),
        input.resume_summary.as_deref(),
    )
}

pub fn build_today_summary(backlog: &[WorkItemDto]) -> TodaySummary {
    let visible: Vec<_> = backlog.iter().filter(|item| is_planning_visible(item)).collect();
    TodaySummary {
        executable_count: visible
            .iter()
            .filter(|item| item.status == "todo" || item.status == "doing")
            .count(),
        blocked_count: visible
            .iter()
            .filter(|item| item.status == "blocked")
            .count(),
        doing_count: visible.iter().filter(|item| item.status == "doing").count(),
    }
}

pub fn build_today_plan(
    backlog: &[WorkItemDto],
    dependencies: &[(String, String, String)],
) -> Vec<PlanItemDto> {
    let blocked_ids: HashSet<String> = dependencies
        .iter()
        .filter(|(_, _, dependency_type)| dependency_type == "blocks")
        .map(|(from_id, _, _)| from_id.clone())
        .collect();

    let mut executable: Vec<&WorkItemDto> = backlog
        .iter()
        .filter(|item| is_planning_visible(item))
        .filter(|item| !blocked_ids.contains(&item.id))
        .filter(|item| item.status == "todo" || item.status == "doing")
        .collect();

    executable.sort_by(|left, right| {
        deadline_sort_score(right)
            .cmp(&deadline_sort_score(left))
            .then_with(|| left.priority.cmp(&right.priority))
            .then_with(|| left.title.cmp(&right.title))
    });

    executable
        .into_iter()
        .take(3)
        .enumerate()
        .map(|(index, item)| PlanItemDto {
            id: format!("dpi-{}", item.id),
            daily_plan_id: "generated-plan".to_string(),
            work_item_id: item.id.clone(),
            position: index + 1,
            is_committed: index == 0,
        })
        .collect()
}

fn deadline_sort_score(item: &WorkItemDto) -> i64 {
    match classify_deadline_kind(item) {
        DeadlineKind::Overdue => 300,
        DeadlineKind::DueToday => 200,
        DeadlineKind::DueSoon => 100,
        DeadlineKind::NoDeadline => 0,
    }
}

#[derive(PartialEq)]
enum DeadlineKind {
    Overdue,
    DueToday,
    DueSoon,
    NoDeadline,
}

fn is_planning_visible(item: &WorkItemDto) -> bool {
    item.wcp_dismissed_at.is_none()
        && item.wcp_inbox_at.is_none()
        && item.status != "archived"
}

fn classify_deadline_kind(item: &WorkItemDto) -> DeadlineKind {
    if item.wcp_dismissed_at.is_some() {
        return DeadlineKind::NoDeadline;
    }
    let Some(scheduled_for) = item.scheduled_for.as_ref().filter(|value| !value.trim().is_empty())
    else {
        return DeadlineKind::NoDeadline;
    };
    if item.status == "done" || item.status == "archived" {
        return DeadlineKind::NoDeadline;
    }

    let Some(due) = parse_scheduled_date(scheduled_for) else {
        return DeadlineKind::NoDeadline;
    };

    let now = chrono::Utc::now();
    let hours_until_due = (due - now).num_seconds() as f64 / 3600.0;
    if hours_until_due < 0.0 {
        return DeadlineKind::Overdue;
    }
    if due.date_naive() == now.date_naive() {
        return DeadlineKind::DueToday;
    }
    if hours_until_due <= 168.0 {
        return DeadlineKind::DueSoon;
    }
    DeadlineKind::NoDeadline
}

fn parse_scheduled_date(value: &str) -> Option<chrono::DateTime<chrono::Utc>> {
    use chrono::{NaiveDate, TimeZone, Utc};

    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Ok(date) = NaiveDate::parse_from_str(trimmed, "%Y-%m-%d") {
        return date
            .and_hms_opt(23, 59, 59)
            .map(|datetime| Utc.from_utc_datetime(&datetime));
    }
    chrono::DateTime::parse_from_rfc3339(trimmed)
        .ok()
        .map(|value| value.with_timezone(&Utc))
}

fn find_deadline_focus_task(backlog: &[WorkItemDto]) -> Option<WorkItemDto> {
    backlog
        .iter()
        .filter(|item| is_planning_visible(item))
        .filter(|item| item.source_type == "imported")
        .filter(|item| matches!(
            classify_deadline_kind(item),
            DeadlineKind::Overdue | DeadlineKind::DueToday
        ))
        .max_by_key(|item| deadline_sort_score(item))
        .cloned()
}

fn build_deadline_signals(backlog: &[WorkItemDto]) -> Vec<String> {
    let overdue = backlog
        .iter()
        .filter(|item| is_planning_visible(item))
        .filter(|item| classify_deadline_kind(item) == DeadlineKind::Overdue)
        .count();
    let due_today = backlog
        .iter()
        .filter(|item| is_planning_visible(item))
        .filter(|item| classify_deadline_kind(item) == DeadlineKind::DueToday)
        .count();

    let mut signals = Vec::new();
    if overdue > 0 {
        signals.push(format!("{overdue} prazo(s) vencido(s)"));
    }
    if due_today > 0 {
        signals.push(format!("{due_today} prazo(s) para hoje"));
    }
    signals
}

pub fn resolve_focus_task(
    backlog: &[WorkItemDto],
    today_plan: &[PlanItemDto],
    active_session: &Option<SessionLogDto>,
) -> Option<WorkItemDto> {
    if let Some(session) = active_session {
        if let Some(work_item_id) = session.work_item_id.as_ref() {
            if let Some(task) = backlog.iter().find(|item| &item.id == work_item_id) {
                return Some(task.clone());
            }
        }
    }

    if let Some(task) = backlog
        .iter()
        .filter(|item| is_planning_visible(item))
        .filter(|item| item.status == "doing")
        .min_by(|left, right| {
            left.priority
                .cmp(&right.priority)
                .then_with(|| left.title.cmp(&right.title))
        })
    {
        return Some(task.clone());
    }

    if let Some(task) = find_deadline_focus_task(backlog) {
        return Some(task);
    }

    if let Some(committed) = today_plan.iter().find(|item| item.is_committed) {
        if let Some(task) = backlog
            .iter()
            .find(|item| item.id == committed.work_item_id)
        {
            return Some(task.clone());
        }
    }

    if let Some(first_plan_item) = today_plan.first() {
        return backlog
            .iter()
            .find(|item| item.id == first_plan_item.work_item_id)
            .cloned();
    }

    None
}

pub fn build_today_focus(
    backlog: &[WorkItemDto],
    today_plan: &[PlanItemDto],
    active_session: &Option<SessionLogDto>,
    focus_task: Option<&WorkItemDto>,
    focus_dependencies: &[crate::dto::TaskDependencyDto],
    primary_repository_name: Option<String>,
) -> TodayFocusDto {
    let committed_task = today_plan
        .iter()
        .find(|item| item.is_committed)
        .and_then(|item| backlog.iter().find(|task| task.id == item.work_item_id));

    let blocker_label = focus_task
        .and_then(|task| task.blocked_reason.clone())
        .filter(|reason| !reason.trim().is_empty());

    let dependency_label = focus_dependencies
        .iter()
        .find(|dependency| dependency.relation == "blocks")
        .map(|dependency| format!("Aguardando: {}", dependency.title));

    let resume_hint = focus_task
        .and_then(|task| task.resume_summary.as_ref())
        .map(|summary| truncate_text(summary, 120));

    let deadline_signals = build_deadline_signals(backlog);
    let suggested_by_deadline = focus_task.is_some_and(|task| {
        task.source_type == "imported"
            && matches!(
                classify_deadline_kind(task),
                DeadlineKind::Overdue | DeadlineKind::DueToday
            )
    });

    let focus_kind = if active_session.is_some() {
        "session_active".to_string()
    } else if suggested_by_deadline {
        "deadline".to_string()
    } else if focus_task.is_some_and(|task| task.status == "blocked") || blocker_label.is_some()
    {
        "unblock".to_string()
    } else if dependency_label.is_some() {
        "unblock".to_string()
    } else if focus_task.is_some_and(|task| task.status == "doing") {
        "continue_doing".to_string()
    } else if committed_task.is_some() {
        "committed".to_string()
    } else {
        "pick_task".to_string()
    };

    let next_step = if let Some(session) = active_session {
        if let Some(goal) = session.goal.as_ref().filter(|value| !value.trim().is_empty()) {
            format!("Continue o foco: {goal}")
        } else {
            "Registre o objetivo da sessao e continue".to_string()
        }
    } else if let Some(reason) = blocker_label.as_ref() {
        format!("Resolver bloqueio: {reason}")
    } else if let Some(label) = dependency_label.as_ref() {
        label.clone()
    } else if let Some(summary) = resume_hint.as_ref() {
        format!("Retomar: {summary}")
    } else if let Some(task) = focus_task.filter(|task| {
        task.source_type == "imported"
            && matches!(
                classify_deadline_kind(task),
                DeadlineKind::Overdue | DeadlineKind::DueToday
            )
    }) {
        let key = task
            .external_key
            .as_deref()
            .map(|value| format!(" ({value})"))
            .unwrap_or_default();
        format!("Foco sugerido por prazo: {}{}", task.title, key)
    } else if let Some(task) = focus_task.filter(|task| task.status == "doing") {
        format!("Continuar: {}", task.title)
    } else if let Some(task) = committed_task {
        format!("Comecar prioridade: {}", task.title)
    } else {
        "Escolha uma tarefa em Tarefas".to_string()
    };

    let headline = if let Some(session) = active_session {
        if let Some(task) = focus_task {
            task.title.clone()
        } else if let Some(goal) = session.goal.as_ref().filter(|value| !value.trim().is_empty()) {
            goal.clone()
        } else {
            "Sessao em andamento".to_string()
        }
    } else if let Some(task) = focus_task {
        task.title.clone()
    } else {
        "Nenhum foco definido".to_string()
    };

    let mut signals = Vec::new();

    if let Some(session) = active_session {
        if let Some(goal) = session.goal.as_ref().filter(|value| !value.trim().is_empty()) {
            signals.push(format!("Sessao ativa: {goal}"));
        } else {
            signals.push("Sessao ativa sem objetivo registrado".to_string());
        }
    } else {
        signals.push("Nenhuma sessao ativa".to_string());
    }

    if let Some(reason) = blocker_label.as_ref() {
        signals.push(format!("Bloqueio: {reason}"));
    } else if backlog.iter().any(|item| item.status == "blocked") {
        let blocked_count = backlog.iter().filter(|item| item.status == "blocked").count();
        signals.push(format!("{blocked_count} tarefa(s) bloqueada(s) no backlog"));
    } else {
        signals.push("Nada bloqueado por enquanto".to_string());
    }

    if let Some(task) = focus_task.filter(|_| suggested_by_deadline) {
        let key = task
            .external_key
            .as_deref()
            .map(|value| format!(" ({value})"))
            .unwrap_or_default();
        signals.push(format!("Foco sugerido por prazo: {}{}", task.title, key));
    } else if let Some(task) = committed_task {
        signals.push(format!("Prioridade do dia: {}", task.title));
    } else if let Some(task) = focus_task {
        signals.push(format!("Foco sugerido: {}", task.title));
    } else {
        signals.push("Sem prioridade definida".to_string());
    }

    if let Some(name) = primary_repository_name.as_ref() {
        signals.push(format!("Projeto principal: {name}"));
    } else if let Some(task) = focus_task {
        if task.primary_repository_id.is_none() {
            signals.push("Sem projeto Git vinculado ao foco".to_string());
        }
    }

    TodayFocusDto {
        headline,
        next_step,
        focus_kind,
        task_id: focus_task.map(|task| task.id.clone()),
        task_title: focus_task.map(|task| task.title.clone()),
        primary_repository_id: focus_task.and_then(|task| task.primary_repository_id.clone()),
        primary_repository_name,
        session_goal: active_session
            .as_ref()
            .and_then(|session| session.goal.clone()),
        blocker_label,
        dependency_label,
        resume_hint,
        signals,
        deadline_signals,
        suggested_by_deadline,
    }
}

fn truncate_text(value: &str, max_chars: usize) -> String {
    let trimmed = value.trim();
    if trimmed.chars().count() <= max_chars {
        return trimmed.to_string();
    }

    let shortened: String = trimmed.chars().take(max_chars).collect();
    format!("{shortened}...")
}

pub fn build_continue_work(
    db_path: &Path,
    backlog: &[WorkItemDto],
    active_session: Option<&SessionLogDto>,
    focus_task: Option<&WorkItemDto>,
) -> Result<Option<ContinueWorkDto>, String> {
    let mut task: Option<WorkItemDto> = None;
    let mut session: Option<SessionLogDto> = None;
    let mut session_active = false;

    if let Some(active) = active_session {
        if let Some(work_item_id) = active.work_item_id.as_ref() {
            if let Some(found) = backlog.iter().find(|item| &item.id == work_item_id) {
                task = Some(found.clone());
                session = Some(active.clone());
                session_active = true;
            }
        }
    }

    if task.is_none() {
        if let Some(ended) = fetch_latest_ended_session(db_path)? {
            if let Some(work_item_id) = ended.work_item_id.as_ref() {
                if let Some(found) = backlog.iter().find(|item| &item.id == work_item_id) {
                    task = Some(found.clone());
                    session = Some(ended);
                    session_active = false;
                }
            }
        }
    }

    if task.is_none() {
        let Some(focus) = focus_task else {
            return Ok(None);
        };
        let has_resume = focus
            .resume_summary
            .as_ref()
            .is_some_and(|value| !value.trim().is_empty());
        let has_repo = focus
            .primary_repository_id
            .as_ref()
            .is_some_and(|value| !value.trim().is_empty());
        if !has_resume && !has_repo {
            return Ok(None);
        }
        task = Some(focus.clone());
    }

    let task = task.expect("continue work task resolved");
    continue_work_from_task_session(db_path, &task, session.as_ref(), session_active)
}

pub fn build_continue_work_for_organization(
    db_path: &Path,
    backlog: &[WorkItemDto],
    organization_id: &str,
) -> Result<Option<ContinueWorkDto>, String> {
    if let Some(ended) = fetch_latest_ended_session_for_organization(db_path, organization_id)? {
        if let Some(work_item_id) = ended.work_item_id.as_ref() {
            if let Some(found) = backlog.iter().find(|item| &item.id == work_item_id) {
                return continue_work_from_task_session(db_path, found, Some(&ended), false);
            }
        }
    }

    let fallback = backlog
        .iter()
        .filter(|item| item.organization_id.as_deref() == Some(organization_id))
        .filter(|item| is_planning_visible(item))
        .find(|item| {
            item.resume_summary
                .as_ref()
                .is_some_and(|value| !value.trim().is_empty())
                || item
                    .primary_repository_id
                    .as_ref()
                    .is_some_and(|value| !value.trim().is_empty())
        });

    let Some(task) = fallback else {
        return Ok(None);
    };

    continue_work_from_task_session(db_path, task, None, false)
}

fn continue_work_from_task_session(
    db_path: &Path,
    task: &WorkItemDto,
    session: Option<&SessionLogDto>,
    session_active: bool,
) -> Result<Option<ContinueWorkDto>, String> {
    let repository_id = session
        .and_then(|entry| entry.repository_id.clone())
        .or_else(|| task.primary_repository_id.clone());

    let organization_name = if let Some(organization_id) = task.organization_id.as_deref() {
        fetch_organization_by_id(db_path, organization_id)?.map(|organization| organization.name)
    } else {
        None
    };

    let repository_name = if let Some(repository_id) = repository_id.as_deref() {
        fetch_repository_by_id(db_path, repository_id)?.map(|repository| repository.name)
    } else {
        None
    };

    let last_activity_at = session
        .and_then(|entry| {
            entry
                .ended_at
                .clone()
                .or_else(|| Some(entry.started_at.clone()))
        })
        .unwrap_or_else(|| task.updated_at.clone());

    let stopped_here = session
        .and_then(|entry| entry.result.clone())
        .filter(|value| !value.trim().is_empty());
    let next_step = session
        .and_then(|entry| entry.decisions.clone())
        .filter(|value| !value.trim().is_empty());
    let resume_summary = compose_handoff_resume_summary(
        stopped_here.as_deref(),
        next_step.as_deref(),
    )
    .or_else(|| task.resume_summary.clone());

    let handoff_from_yesterday = session
        .and_then(|entry| entry.ended_at.as_deref().or(Some(entry.started_at.as_str())))
        .is_some_and(is_iso_date_yesterday);

    let branch_name = session.and_then(|entry| {
        entry
            .git_activity
            .as_ref()
            .and_then(|git| git.ended_branch.clone())
            .or_else(|| entry.branch_name.clone())
    });

    Ok(Some(ContinueWorkDto {
        work_item_id: task.id.clone(),
        title: task.title.clone(),
        external_key: task.external_key.clone(),
        organization_id: task.organization_id.clone(),
        organization_name,
        repository_id,
        repository_name,
        branch_name,
        last_activity_at,
        resume_summary,
        stopped_here,
        next_step,
        session_id: session.map(|entry| entry.id.clone()),
        session_goal: session.and_then(|entry| entry.goal.clone()),
        session_decisions: session.and_then(|entry| entry.decisions.clone()),
        session_result: session.and_then(|entry| entry.result.clone()),
        session_active,
        handoff_from_yesterday,
    }))
}

pub fn build_context_switch_origin(
    db_path: &Path,
    session_id: Option<&str>,
    repository_id: Option<&str>,
    work_item_id: Option<&str>,
) -> Result<ContextSwitchOriginDto, String> {
    let session = if let Some(session_id) = session_id {
        fetch_session_by_id(db_path, session_id)?
    } else {
        None
    };

    let work_item = if let Some(work_item_id) = session
        .as_ref()
        .and_then(|entry| entry.work_item_id.as_deref())
        .or(work_item_id)
    {
        fetch_work_item_by_id(db_path, work_item_id)?
    } else {
        None
    };

    let repository_id = session
        .as_ref()
        .and_then(|entry| entry.repository_id.clone())
        .or_else(|| {
            work_item
                .as_ref()
                .and_then(|item| item.primary_repository_id.clone())
        })
        .or_else(|| repository_id.map(str::to_string));

    let repository = if let Some(repository_id) = repository_id.as_deref() {
        fetch_repository_by_id(db_path, repository_id)?
    } else {
        None
    };

    let organization_id = work_item
        .as_ref()
        .and_then(|item| item.organization_id.clone())
        .or_else(|| {
            repository
                .as_ref()
                .and_then(|entry| entry.organization_id.clone())
        });

    let organization_name = if let Some(organization_id) = organization_id.as_deref() {
        fetch_organization_by_id(db_path, organization_id)?.map(|org| org.name)
    } else {
        repository
            .as_ref()
            .and_then(|entry| entry.organization_name.clone())
    };

    let tree = repository
        .as_ref()
        .and_then(|entry| entry.local_path.as_deref())
        .filter(|path| !path.trim().is_empty())
        .map(working_tree_status)
        .unwrap_or(crate::dto::WorkingTreeStatusDto {
            dirty: false,
            changed_count: 0,
        });

    let branch_name = session
        .as_ref()
        .and_then(|entry| entry.branch_name.clone())
        .or_else(|| {
            repository
                .as_ref()
                .and_then(|entry| entry.local_path.as_deref())
                .and_then(|path| crate::git::git_snapshot(path).ok())
                .and_then(|snapshot| snapshot.branch_name)
        });

    let last_note = session
        .as_ref()
        .and_then(|entry| entry.result.clone())
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            work_item
                .as_ref()
                .and_then(|item| item.resume_summary.clone())
                .filter(|value| !value.trim().is_empty())
        })
        .or_else(|| {
            session
                .as_ref()
                .and_then(|entry| entry.goal.clone())
                .filter(|value| !value.trim().is_empty())
        });

    Ok(ContextSwitchOriginDto {
        organization_id,
        organization_name,
        work_item_id: work_item.as_ref().map(|item| item.id.clone()),
        work_item_title: work_item.as_ref().map(|item| item.title.clone()),
        external_key: work_item
            .as_ref()
            .and_then(|item| item.external_key.clone()),
        repository_id,
        repository_name: repository.as_ref().map(|entry| entry.name.clone()),
        branch_name,
        session_id: session.as_ref().map(|entry| entry.id.clone()),
        session_active: session
            .as_ref()
            .is_some_and(|entry| entry.ended_at.is_none()),
        last_note,
        has_uncommitted_changes: tree.dirty,
        uncommitted_count: tree.changed_count,
    })
}

pub fn build_session_handoff_summary(
    db_path: &Path,
    session_id: &str,
) -> Result<SessionHandoffSummaryDto, String> {
    let session = fetch_session_by_id(db_path, session_id)?
        .ok_or_else(|| "Sessao nao encontrada.".to_string())?;

    let work_item = if let Some(work_item_id) = session.work_item_id.as_deref() {
        fetch_work_item_by_id(db_path, work_item_id)?
    } else {
        None
    };

    let repository_id = session
        .repository_id
        .clone()
        .or_else(|| {
            work_item
                .as_ref()
                .and_then(|item| item.primary_repository_id.clone())
        });

    let repository = if let Some(repository_id) = repository_id.as_deref() {
        fetch_repository_by_id(db_path, repository_id)?
    } else {
        None
    };

    let organization_id = work_item
        .as_ref()
        .and_then(|item| item.organization_id.clone())
        .or_else(|| {
            repository
                .as_ref()
                .and_then(|entry| entry.organization_id.clone())
        });

    let organization_name = if let Some(organization_id) = organization_id.as_deref() {
        fetch_organization_by_id(db_path, organization_id)?.map(|org| org.name)
    } else {
        repository
            .as_ref()
            .and_then(|entry| entry.organization_name.clone())
    };

    let project_id = work_item
        .as_ref()
        .and_then(|item| item.project_id.clone())
        .or_else(|| repository.as_ref().and_then(|entry| entry.project_id.clone()));

    let project_name = if let Some(project_id) = project_id.as_deref() {
        fetch_project_by_id(db_path, project_id)?.map(|project| project.name)
    } else {
        repository
            .as_ref()
            .and_then(|entry| entry.project_name.clone())
    };

    let persisted_git = session.git_activity.clone();

    let live_commits = if session.ended_at.is_none() {
        repository
            .as_ref()
            .and_then(|entry| entry.local_path.as_deref())
            .filter(|path| !path.trim().is_empty())
            .map(|path| {
                list_session_commits(
                    path,
                    &session.started_at,
                    persisted_git
                        .as_ref()
                        .and_then(|git| git.started_head.as_deref()),
                    20,
                )
            })
            .unwrap_or_default()
    } else {
        Vec::new()
    };

    let commits = if !live_commits.is_empty() {
        live_commits
    } else {
        persisted_git
            .as_ref()
            .map(|git| git.commits.clone())
            .unwrap_or_default()
    };

    let artifacts = if let Some(work_item_id) = session.work_item_id.as_deref() {
        fetch_artifacts_for_work_item(db_path, work_item_id)?
            .into_iter()
            .filter(|artifact| artifact.created_at.as_str() >= session.started_at.as_str())
            .map(|artifact| SessionHandoffArtifactDto {
                title: artifact
                    .title
                    .unwrap_or_else(|| artifact.artifact_type.clone()),
                url: artifact.url,
                artifact_type: artifact.artifact_type,
            })
            .collect()
    } else {
        Vec::new()
    };

    let started_branch = persisted_git
        .as_ref()
        .and_then(|git| git.started_branch.clone())
        .or(session.branch_name.clone());
    let ended_branch = persisted_git
        .as_ref()
        .and_then(|git| git.ended_branch.clone());
    let branch_name = ended_branch.clone().or(started_branch.clone());

    let tree = repository
        .as_ref()
        .and_then(|entry| entry.local_path.as_deref())
        .filter(|path| !path.trim().is_empty())
        .map(working_tree_status)
        .unwrap_or(crate::dto::WorkingTreeStatusDto {
            dirty: false,
            changed_count: 0,
        });

    Ok(SessionHandoffSummaryDto {
        session_id: session.id,
        started_at: session.started_at.clone(),
        duration_label: format_session_duration_label(
            &session.started_at,
            session.ended_at.as_deref(),
        ),
        work_item_id: work_item.as_ref().map(|item| item.id.clone()),
        work_item_title: work_item.as_ref().map(|item| item.title.clone()),
        external_key: work_item
            .as_ref()
            .and_then(|item| item.external_key.clone())
            .or(session.work_item_external_key),
        organization_name,
        project_name,
        repository_id,
        repository_name: repository.as_ref().map(|entry| entry.name.clone()),
        branch_name,
        ended_branch,
        started_head: persisted_git
            .as_ref()
            .and_then(|git| git.started_head.clone()),
        ended_head: persisted_git
            .as_ref()
            .and_then(|git| git.ended_head.clone()),
        commits,
        worktree_path: persisted_git
            .as_ref()
            .and_then(|git| git.worktree_path.clone()),
        has_uncommitted_changes: tree.dirty,
        uncommitted_count: tree.changed_count,
        artifacts,
    })
}

pub fn build_multi_focus_groups(
    backlog: &[WorkItemDto],
    organizations: &[OrganizationListItemDto],
    projects: &[ProjectListItemDto],
    repositories: &[RepositoryListItemDto],
) -> Vec<MultiFocusGroupDto> {
    let org_names: HashMap<&str, &str> = organizations
        .iter()
        .map(|org| (org.id.as_str(), org.name.as_str()))
        .collect();
    let project_names: HashMap<&str, &str> = projects
        .iter()
        .map(|project| (project.id.as_str(), project.name.as_str()))
        .collect();
    let repository_names: HashMap<&str, &str> = repositories
        .iter()
        .map(|repository| (repository.id.as_str(), repository.name.as_str()))
        .collect();

    let mut grouped: HashMap<String, Vec<&WorkItemDto>> = HashMap::new();

    for task in backlog
        .iter()
        .filter(|item| is_planning_visible(item))
        .filter(|item| item.status == "doing")
    {
        let group_key = if let Some(project_id) = task
            .project_id
            .as_ref()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
        {
            format!("project:{project_id}")
        } else if let Some(repository_id) = task
            .primary_repository_id
            .as_ref()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
        {
            format!("repository:{repository_id}")
        } else {
            continue;
        };

        grouped.entry(group_key).or_default().push(task);
    }

    let mut groups: Vec<MultiFocusGroupDto> = grouped
        .into_iter()
        .filter(|(_, tasks)| tasks.len() >= 2)
        .map(|(group_key, tasks)| {
            let first = tasks[0];
            let project_id = group_key
                .strip_prefix("project:")
                .map(str::to_string)
                .or_else(|| first.project_id.clone());
            let repository_id = if group_key.starts_with("repository:") {
                group_key.strip_prefix("repository:").map(str::to_string)
            } else {
                first.primary_repository_id.clone()
            };

            let organization_id = first.organization_id.clone();
            let organization_name = organization_id
                .as_deref()
                .and_then(|id| org_names.get(id).map(|name| (*name).to_string()));
            let project_name = project_id
                .as_deref()
                .and_then(|id| project_names.get(id).map(|name| (*name).to_string()));
            let repository_name = repository_id
                .as_deref()
                .and_then(|id| repository_names.get(id).map(|name| (*name).to_string()));

            let mut task_dtos: Vec<MultiFocusTaskDto> = tasks
                .into_iter()
                .map(|task| MultiFocusTaskDto {
                    id: task.id.clone(),
                    title: task.title.clone(),
                    external_key: task.external_key.clone(),
                })
                .collect();
            task_dtos.sort_by(|left, right| left.title.cmp(&right.title));

            MultiFocusGroupDto {
                group_key,
                organization_id,
                organization_name,
                project_id,
                project_name,
                repository_id,
                repository_name,
                tasks: task_dtos,
            }
        })
        .collect();

    groups.sort_by(|left, right| {
        left.organization_name
            .cmp(&right.organization_name)
            .then_with(|| left.project_name.cmp(&right.project_name))
            .then_with(|| left.repository_name.cmp(&right.repository_name))
            .then_with(|| left.group_key.cmp(&right.group_key))
    });

    groups
}

pub fn build_recoverable_context(
    current_task: &WorkItemDto,
    backlog: &[WorkItemDto],
) -> Vec<RecoverableContextCandidateDto> {
    let mut candidates: Vec<RecoverableContextCandidateDto> = backlog
        .iter()
        .filter(|candidate| is_planning_visible(candidate))
        .filter(|candidate| candidate.id != current_task.id)
        .filter_map(|candidate| {
            let mut score = 0;
            let mut reasons = Vec::new();

            if candidate.primary_repository_id == current_task.primary_repository_id
                && candidate.primary_repository_id.is_some()
            {
                score += 40;
                reasons.push("mesmo repositorio".to_string());
            }

            if candidate.project_id == current_task.project_id && candidate.project_id.is_some() {
                score += 25;
                reasons.push("mesmo projeto".to_string());
            }

            if candidate.organization_id == current_task.organization_id
                && candidate.organization_id.is_some()
            {
                score += 10;
                reasons.push("mesma empresa".to_string());
            }

            if candidate.organization_id == current_task.organization_id
                && candidate.organization_id.is_some()
                && candidate.primary_repository_id == current_task.primary_repository_id
                && candidate.primary_repository_id.is_some()
            {
                score += 15;
                reasons.push("mesmo contexto de execucao".to_string());
            }

            if has_text_overlap(&candidate.title, &current_task.title) {
                score += 12;
                reasons.push("titulo semelhante".to_string());
            }

            match (&candidate.resume_summary, &current_task.resume_summary) {
                (Some(left), Some(right)) if has_text_overlap(left, right) => {
                    score += 8;
                    reasons.push("resumo de retomada semelhante".to_string());
                }
                _ => {}
            }

            if score > 0 {
                Some(RecoverableContextCandidateDto {
                    work_item_id: candidate.id.clone(),
                    score,
                    reasons,
                })
            } else {
                None
            }
        })
        .collect();

    candidates.sort_by(|left, right| right.score.cmp(&left.score));
    candidates.truncate(3);
    candidates
}

fn has_text_overlap(left: &str, right: &str) -> bool {
    let left_words = normalize(left);
    let right_words = normalize(right);

    left_words
        .iter()
        .any(|word| word.len() > 3 && right_words.iter().any(|other| other == word))
}

fn normalize(value: &str) -> Vec<String> {
    value
        .to_lowercase()
        .chars()
        .map(|char| {
            if char.is_ascii_alphanumeric() || char.is_whitespace() {
                char
            } else {
                ' '
            }
        })
        .collect::<String>()
        .split_whitespace()
        .map(str::to_string)
        .collect()
}
