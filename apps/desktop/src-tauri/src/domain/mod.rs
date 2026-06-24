use crate::db::{
    dependency_exists, escape_sql, fetch_artifacts_for_work_item, fetch_notes_for_entity,
    fetch_recent_sessions_by_work_item, fetch_task_dependencies, fetch_work_item_by_id,
    fetch_work_items, insert_work_item, sqlite_exec, update_work_item as save_work_item_row,
    work_item_exists,
};
use crate::dto::{
    PlanItemDto, RecoverableContextCandidateDto, SessionLogDto, TaskContextDto, TodayFocusDto,
    TodaySummary, WorkItemDto,
};
use crate::util::{iso_now, unix_timestamp_millis};
use std::collections::HashSet;
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
    TodaySummary {
        executable_count: backlog
            .iter()
            .filter(|item| item.status == "todo" || item.status == "doing")
            .count(),
        blocked_count: backlog
            .iter()
            .filter(|item| item.status == "blocked")
            .count(),
        doing_count: backlog.iter().filter(|item| item.status == "doing").count(),
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
        .filter(|item| !blocked_ids.contains(&item.id))
        .filter(|item| item.status == "todo" || item.status == "doing")
        .collect();

    executable.sort_by(|left, right| {
        left.priority
            .cmp(&right.priority)
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
        .filter(|item| item.status == "doing")
        .min_by(|left, right| {
            left.priority
                .cmp(&right.priority)
                .then_with(|| left.title.cmp(&right.title))
        })
    {
        return Some(task.clone());
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

    let focus_kind = if active_session.is_some() {
        "session_active".to_string()
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

    if let Some(task) = committed_task {
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

pub fn build_recoverable_context(
    current_task: &WorkItemDto,
    backlog: &[WorkItemDto],
) -> Vec<RecoverableContextCandidateDto> {
    let mut candidates: Vec<RecoverableContextCandidateDto> = backlog
        .iter()
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
