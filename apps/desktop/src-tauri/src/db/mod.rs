use crate::dto::{
    ArtifactDto, KnowledgeNoteDto, ProjectListItemDto, RepositoryListItemDto, SessionLogDto,
    TaskDependencyDto, WorkItemDto,
};
use serde_json::Value;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

pub fn resolve_workspace_root() -> Result<PathBuf, String> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .ancestors()
        .find(|path| path.join("packages/db/seed.sql").exists())
        .map(Path::to_path_buf)
        .ok_or_else(|| {
            format!(
                "Failed to resolve workspace root from {}",
                manifest_dir.display()
            )
        })
}

pub fn resolve_db_path() -> Result<PathBuf, String> {
    Ok(resolve_workspace_root()?.join("packages/db/local.db"))
}

pub fn ensure_db_ready(db_path: &Path) -> Result<(), String> {
    if !db_path.exists() {
        if let Some(parent) = db_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Failed to create db directory: {error}"))?;
        }
    }

    let existing_tables = sqlite_json(
        db_path,
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'workspaces';",
    )
    .unwrap_or_default();

    if existing_tables.is_empty() {
        apply_pending_migrations(db_path)?;
        let seed_sql = include_str!("../../../../../packages/db/seed.sql");
        sqlite_exec(db_path, seed_sql)?;
    } else {
        ensure_migration_tracking(db_path)?;
        apply_pending_migrations(db_path)?;
    }

    Ok(())
}

pub fn resolve_primary_workspace_id(db_path: &Path) -> Result<String, String> {
    let rows = sqlite_json(
        db_path,
        "SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1;",
    )?;

    rows.first()
        .and_then(|row| get_string(row, "id"))
        .ok_or_else(|| "Nenhum workspace configurado".to_string())
}

fn ensure_migration_tracking(db_path: &Path) -> Result<(), String> {
    sqlite_exec(
        db_path,
        "CREATE TABLE IF NOT EXISTS __wcp_migrations (
          id TEXT PRIMARY KEY,
          applied_at TEXT NOT NULL
        );",
    )?;

    let workspaces_exist = !sqlite_json(
        db_path,
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'workspaces';",
    )?
    .is_empty();

    if !workspaces_exist {
        return Ok(());
    }

    let applied_rows = sqlite_json(db_path, "SELECT id FROM __wcp_migrations;")?;
    let applied: HashSet<String> = applied_rows
        .iter()
        .filter_map(|row| get_string(row, "id"))
        .collect();

    if !applied.contains("0000_overrated_the_anarchist.sql") {
        sqlite_exec(
            db_path,
            "INSERT OR IGNORE INTO __wcp_migrations (id, applied_at)
             VALUES ('0000_overrated_the_anarchist.sql', datetime('now'));",
        )?;
    }

    Ok(())
}

fn apply_pending_migrations(db_path: &Path) -> Result<(), String> {
    sqlite_exec(
        db_path,
        "CREATE TABLE IF NOT EXISTS __wcp_migrations (
          id TEXT PRIMARY KEY,
          applied_at TEXT NOT NULL
        );",
    )?;

    let applied_rows = sqlite_json(db_path, "SELECT id FROM __wcp_migrations;")?;
    let applied: HashSet<String> = applied_rows
        .iter()
        .filter_map(|row| get_string(row, "id"))
        .collect();

    let migrations_dir = resolve_workspace_root()?.join("packages/db/drizzle");
    let mut migration_files: Vec<PathBuf> = fs::read_dir(&migrations_dir)
        .map_err(|error| format!("Failed to read migrations directory: {error}"))?
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter(|path| path.extension().is_some_and(|ext| ext == "sql"))
        .collect();

    migration_files.sort();

    for migration_path in migration_files {
        let file_name = migration_path
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| "Invalid migration file name".to_string())?
            .to_string();

        if applied.contains(&file_name) {
            continue;
        }

        let sql = fs::read_to_string(&migration_path)
            .map_err(|error| format!("Failed to read migration {file_name}: {error}"))?;

        sqlite_exec(
            db_path,
            &format!(
                "BEGIN;
{sql}
INSERT INTO __wcp_migrations (id, applied_at) VALUES ('{}', datetime('now'));
COMMIT;",
                escape_sql(&file_name)
            ),
        )?;
    }

    Ok(())
}

pub fn sqlite_json(db_path: &Path, sql: &str) -> Result<Vec<Value>, String> {
    let output = Command::new("sqlite3")
        .arg("-json")
        .arg(db_path)
        .arg(sql)
        .output()
        .map_err(|error| format!("Failed to execute sqlite3: {error}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    if output.stdout.is_empty() {
        return Ok(Vec::new());
    }

    serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("Invalid sqlite JSON output: {error}"))
}

pub fn sqlite_exec(db_path: &Path, sql: &str) -> Result<(), String> {
    let output = Command::new("sqlite3")
        .arg(db_path)
        .arg(sql)
        .output()
        .map_err(|error| format!("Failed to execute sqlite3: {error}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    Ok(())
}

pub fn fetch_work_items(db_path: &Path) -> Result<Vec<WorkItemDto>, String> {
    let rows = sqlite_json(
        db_path,
        "SELECT id, title, description, status, priority, organization_id, project_id, primary_repository_id, blocked_reason, resume_summary, source_type, updated_at FROM work_items ORDER BY priority ASC, updated_at DESC;",
    )?;

    Ok(rows.iter().map(map_work_item_row).collect())
}

pub fn fetch_work_item_by_id(
    db_path: &Path,
    work_item_id: &str,
) -> Result<Option<WorkItemDto>, String> {
    let rows = sqlite_json(
        db_path,
        &format!(
            "SELECT id, title, description, status, priority, organization_id, project_id, primary_repository_id, blocked_reason, resume_summary, source_type, updated_at
             FROM work_items
             WHERE id = '{}'
             LIMIT 1;",
            escape_sql(work_item_id)
        ),
    )?;

    Ok(rows.first().map(map_work_item_row))
}

pub fn fetch_projects(db_path: &Path) -> Result<Vec<ProjectListItemDto>, String> {
    let rows = sqlite_json(
        db_path,
        "SELECT id, name, organization_id, description, is_active FROM projects WHERE is_active = 1 ORDER BY name ASC;",
    )?;

    Ok(rows
        .into_iter()
        .map(|row| ProjectListItemDto {
            id: get_string(&row, "id").unwrap_or_default(),
            name: get_string(&row, "name").unwrap_or_default(),
            organization_id: get_optional_string(&row, "organization_id"),
            description: get_optional_string(&row, "description"),
            is_active: get_i64(&row, "is_active").unwrap_or(1) == 1,
        })
        .collect())
}

pub fn fetch_project_by_id(
    db_path: &Path,
    project_id: &str,
) -> Result<Option<ProjectListItemDto>, String> {
    let rows = sqlite_json(
        db_path,
        &format!(
            "SELECT id, name, organization_id, description, is_active
             FROM projects
             WHERE id = '{}'
             LIMIT 1;",
            escape_sql(project_id)
        ),
    )?;

    Ok(rows.into_iter().next().map(|row| ProjectListItemDto {
        id: get_string(&row, "id").unwrap_or_default(),
        name: get_string(&row, "name").unwrap_or_default(),
        organization_id: get_optional_string(&row, "organization_id"),
        description: get_optional_string(&row, "description"),
        is_active: get_i64(&row, "is_active").unwrap_or(1) == 1,
    }))
}

pub fn insert_project(
    db_path: &Path,
    organization_id: &str,
    name: &str,
    description: Option<&str>,
) -> Result<ProjectListItemDto, String> {
    let org_rows = sqlite_json(
        db_path,
        &format!(
            "SELECT id FROM organizations WHERE id = '{}' AND is_active = 1 LIMIT 1;",
            escape_sql(organization_id)
        ),
    )?;
    if org_rows.is_empty() {
        return Err("Empresa nao encontrada.".to_string());
    }

    let workspace_id = resolve_primary_workspace_id(db_path)?;
    let project_id = format!("proj-{}", crate::util::unix_timestamp_millis()?);
    let now = crate::util::iso_now()?;

    sqlite_exec(
        db_path,
        &format!(
            "INSERT INTO projects (
              id, workspace_id, organization_id, name, description, is_active, created_at, updated_at
            ) VALUES (
              '{}', '{}', '{}', '{}', {}, 1, '{}', '{}'
            );",
            escape_sql(&project_id),
            escape_sql(&workspace_id),
            escape_sql(organization_id),
            escape_sql(name),
            nullable_sql(description),
            escape_sql(&now),
            escape_sql(&now)
        ),
    )?;

    fetch_project_by_id(db_path, &project_id)?
        .ok_or_else(|| "Nao foi possivel carregar o projeto criado.".to_string())
}

pub fn update_project_record(
    db_path: &Path,
    project_id: &str,
    name: Option<&str>,
    description: Option<&str>,
    is_active: Option<bool>,
) -> Result<ProjectListItemDto, String> {
    let existing = fetch_project_by_id(db_path, project_id)?
        .ok_or_else(|| "Projeto nao encontrado.".to_string())?;

    let resolved_name = name
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or(existing.name);
    let resolved_description = description.map(str::trim).filter(|value| !value.is_empty());
    let resolved_active = is_active.unwrap_or(existing.is_active);
    let now = crate::util::iso_now()?;

    sqlite_exec(
        db_path,
        &format!(
            "UPDATE projects
             SET name = '{}',
                 description = {},
                 is_active = {},
                 updated_at = '{}'
             WHERE id = '{}';",
            escape_sql(&resolved_name),
            nullable_sql(resolved_description),
            if resolved_active { 1 } else { 0 },
            escape_sql(&now),
            escape_sql(project_id)
        ),
    )?;

    fetch_project_by_id(db_path, project_id)?
        .ok_or_else(|| "Nao foi possivel carregar o projeto atualizado.".to_string())
}

pub fn update_repository_context(
    db_path: &Path,
    repository_id: &str,
    organization_id: &str,
    project_id: Option<&str>,
) -> Result<RepositoryListItemDto, String> {
    let org = crate::db::organizations::fetch_organization_by_id(db_path, organization_id)?
        .ok_or_else(|| "Empresa nao encontrada.".to_string())?;

    let now = crate::util::iso_now()?;
    sqlite_exec(
        db_path,
        &format!(
            "UPDATE repositories
             SET organization_id = '{}',
                 project_id = {},
                 updated_at = '{}'
             WHERE id = '{}';",
            escape_sql(organization_id),
            nullable_sql(project_id),
            escape_sql(&now),
            escape_sql(repository_id)
        ),
    )?;

    let profile_id = org.environment_profile_id.as_deref();
    let git_user_name = org.git_user_name.as_deref();
    let git_user_email = org.git_user_email.as_deref();
    let ssh_host_alias = org.ssh_host_alias.as_deref();
    let organization_name = org.name.as_str();

    sqlite_exec(
        db_path,
        &format!(
            "UPDATE repository_identities
             SET environment_profile_id = {},
                 git_user_name = {},
                 git_user_email = {},
                 ssh_host_alias = {},
                 provider_username = {},
                 provider_account_label = {},
                 updated_at = '{}'
             WHERE repository_id = '{}';",
            nullable_sql(profile_id),
            nullable_sql(git_user_name),
            nullable_sql(git_user_email),
            nullable_sql(ssh_host_alias),
            nullable_sql(git_user_name),
            nullable_sql(Some(organization_name)),
            escape_sql(&now),
            escape_sql(repository_id)
        ),
    )?;

    fetch_repository_by_id(db_path, repository_id)?
        .ok_or_else(|| "Nao foi possivel carregar o repositorio atualizado.".to_string())
}

pub fn insert_work_item(
    db_path: &Path,
    workspace_id: &str,
    title: &str,
    description: Option<&str>,
    status: &str,
    priority: i64,
    organization_id: Option<&str>,
    project_id: Option<&str>,
    primary_repository_id: Option<&str>,
    blocked_reason: Option<&str>,
    resume_summary: Option<&str>,
) -> Result<WorkItemDto, String> {
    let work_item_id = format!("wi-{}", crate::util::unix_timestamp_millis()?);
    let now = crate::util::iso_now()?;

    sqlite_exec(
        db_path,
        &format!(
            "INSERT INTO work_items (
              id, workspace_id, organization_id, project_id, primary_repository_id,
              title, description, status, priority, blocked_reason, resume_summary,
              source_type, created_at, updated_at
            ) VALUES (
              '{}', '{}', {}, {}, {},
              '{}', {}, '{}', {}, {}, {},
              'manual', '{}', '{}'
            );",
            escape_sql(&work_item_id),
            escape_sql(workspace_id),
            nullable_sql(organization_id),
            nullable_sql(project_id),
            nullable_sql(primary_repository_id),
            escape_sql(title),
            nullable_sql(description),
            escape_sql(status),
            priority,
            nullable_sql(blocked_reason),
            nullable_sql(resume_summary),
            escape_sql(&now),
            escape_sql(&now)
        ),
    )?;

    fetch_work_item_by_id(db_path, &work_item_id)?
        .ok_or_else(|| "Nao foi possivel carregar a tarefa criada.".to_string())
}

pub fn update_work_item(
    db_path: &Path,
    work_item_id: &str,
    title: &str,
    description: Option<&str>,
    status: &str,
    priority: i64,
    organization_id: Option<&str>,
    project_id: Option<&str>,
    primary_repository_id: Option<&str>,
    blocked_reason: Option<&str>,
    resume_summary: Option<&str>,
) -> Result<WorkItemDto, String> {
    let now = crate::util::iso_now()?;

    sqlite_exec(
        db_path,
        &format!(
            "UPDATE work_items
             SET title = '{}',
                 description = {},
                 status = '{}',
                 priority = {},
                 organization_id = {},
                 project_id = {},
                 primary_repository_id = {},
                 blocked_reason = {},
                 resume_summary = {},
                 updated_at = '{}'
             WHERE id = '{}';",
            escape_sql(title),
            nullable_sql(description),
            escape_sql(status),
            priority,
            nullable_sql(organization_id),
            nullable_sql(project_id),
            nullable_sql(primary_repository_id),
            nullable_sql(blocked_reason),
            nullable_sql(resume_summary),
            escape_sql(&now),
            escape_sql(work_item_id)
        ),
    )?;

    fetch_work_item_by_id(db_path, work_item_id)?
        .ok_or_else(|| "Nao foi possivel carregar a tarefa atualizada.".to_string())
}

fn map_work_item_row(row: &Value) -> WorkItemDto {
    WorkItemDto {
        id: get_string(row, "id").unwrap_or_default(),
        title: get_string(row, "title").unwrap_or_default(),
        description: get_optional_string(row, "description"),
        status: get_string(row, "status").unwrap_or_default(),
        priority: get_i64(row, "priority").unwrap_or(3),
        organization_id: get_optional_string(row, "organization_id"),
        project_id: get_optional_string(row, "project_id"),
        primary_repository_id: get_optional_string(row, "primary_repository_id"),
        blocked_reason: get_optional_string(row, "blocked_reason"),
        resume_summary: get_optional_string(row, "resume_summary"),
        source_type: get_string(row, "source_type").unwrap_or_else(|| "manual".to_string()),
        updated_at: get_string(row, "updated_at").unwrap_or_default(),
    }
}

pub fn fetch_task_dependencies(
    db_path: &Path,
    work_item_id: &str,
) -> Result<Vec<TaskDependencyDto>, String> {
    let rows = sqlite_json(
        db_path,
        &format!(
            "SELECT wd.id, wd.to_work_item_id AS related_work_item_id, wi.title, wi.status, 'depends_on' AS relation, wd.dependency_type
             FROM work_item_dependencies wd
             INNER JOIN work_items wi ON wi.id = wd.to_work_item_id
             WHERE wd.from_work_item_id = '{}'
             UNION ALL
             SELECT wd.id, wd.from_work_item_id AS related_work_item_id, wi.title, wi.status, 'blocks' AS relation, wd.dependency_type
             FROM work_item_dependencies wd
             INNER JOIN work_items wi ON wi.id = wd.from_work_item_id
             WHERE wd.to_work_item_id = '{}';",
            escape_sql(work_item_id),
            escape_sql(work_item_id)
        ),
    )?;

    Ok(rows
        .into_iter()
        .map(|row| TaskDependencyDto {
            id: get_string(&row, "id").unwrap_or_default(),
            related_work_item_id: get_string(&row, "related_work_item_id").unwrap_or_default(),
            title: get_string(&row, "title").unwrap_or_default(),
            status: get_string(&row, "status").unwrap_or_default(),
            relation: get_string(&row, "relation").unwrap_or_default(),
            dependency_type: get_string(&row, "dependency_type").unwrap_or_default(),
        })
        .collect())
}

pub fn fetch_active_session(db_path: &Path) -> Result<Option<SessionLogDto>, String> {
    let rows = sqlite_json(
        db_path,
        "SELECT id, work_item_id, repository_id, branch_name, started_at, ended_at, goal, decisions, result, source_type
         FROM session_logs
         WHERE ended_at IS NULL
         ORDER BY started_at DESC
         LIMIT 1;",
    )?;

    Ok(rows.first().map(map_session_row))
}

pub fn fetch_session_by_id(
    db_path: &Path,
    session_id: &str,
) -> Result<Option<SessionLogDto>, String> {
    let rows = sqlite_json(
        db_path,
        &format!(
            "SELECT id, work_item_id, repository_id, branch_name, started_at, ended_at, goal, decisions, result, source_type
             FROM session_logs
             WHERE id = '{}'
             LIMIT 1;",
            escape_sql(session_id)
        ),
    )?;

    Ok(rows.first().map(map_session_row))
}

pub fn fetch_recent_sessions_by_work_item(
    db_path: &Path,
    work_item_id: &str,
) -> Result<Vec<SessionLogDto>, String> {
    let rows = sqlite_json(
        db_path,
        &format!(
            "SELECT id, work_item_id, repository_id, branch_name, started_at, ended_at, goal, decisions, result, source_type
             FROM session_logs
             WHERE work_item_id = '{}'
             ORDER BY started_at DESC
             LIMIT 5;",
            escape_sql(work_item_id)
        ),
    )?;

    Ok(rows.iter().map(map_session_row).collect())
}

pub fn fetch_notes_for_entity(
    db_path: &Path,
    entity_type: &str,
    entity_id: &str,
) -> Result<Vec<KnowledgeNoteDto>, String> {
    let rows = sqlite_json(
        db_path,
        &format!(
            "SELECT id, entity_type, entity_id, note_type, title, content, source_type, created_at
             FROM knowledge_notes
             WHERE entity_type = '{}' AND entity_id = '{}'
             ORDER BY created_at DESC
             LIMIT 5;",
            escape_sql(entity_type),
            escape_sql(entity_id)
        ),
    )?;

    Ok(rows.iter().map(map_note_row).collect())
}

pub fn fetch_artifacts_for_work_item(
    db_path: &Path,
    work_item_id: &str,
) -> Result<Vec<ArtifactDto>, String> {
    let rows = sqlite_json(
        db_path,
        &format!(
            "SELECT a.id, a.repository_id, a.type, a.title, a.url, a.created_at, a.source_type
             FROM artifacts a
             INNER JOIN entity_links l ON l.to_entity_id = a.id
             WHERE l.from_entity_type = 'work_item'
               AND l.from_entity_id = '{}'
               AND l.to_entity_type = 'artifact'
             ORDER BY a.created_at DESC
             LIMIT 5;",
            escape_sql(work_item_id)
        ),
    )?;

    Ok(rows.iter().map(map_artifact_row).collect())
}

pub fn fetch_note_by_id(db_path: &Path, note_id: &str) -> Result<Option<KnowledgeNoteDto>, String> {
    let rows = sqlite_json(
        db_path,
        &format!(
            "SELECT id, entity_type, entity_id, note_type, title, content, source_type, created_at
             FROM knowledge_notes
             WHERE id = '{}'
             LIMIT 1;",
            escape_sql(note_id)
        ),
    )?;

    Ok(rows.first().map(map_note_row))
}

pub fn fetch_artifact_by_id(
    db_path: &Path,
    artifact_id: &str,
) -> Result<Option<ArtifactDto>, String> {
    let rows = sqlite_json(
        db_path,
        &format!(
            "SELECT id, repository_id, type, title, url, created_at, source_type
             FROM artifacts
             WHERE id = '{}'
             LIMIT 1;",
            escape_sql(artifact_id)
        ),
    )?;

    Ok(rows.first().map(map_artifact_row))
}

pub fn map_repository_list_item(row: &Value) -> RepositoryListItemDto {
    RepositoryListItemDto {
        id: get_string(row, "id").unwrap_or_default(),
        name: get_string(row, "name").unwrap_or_default(),
        local_path: get_optional_string(row, "local_path"),
        provider_host: get_optional_string(row, "provider_host"),
        remote_url: get_optional_string(row, "remote_url"),
        default_branch: get_optional_string(row, "default_branch"),
        is_active: get_i64(row, "is_active").unwrap_or(0) == 1,
        organization_id: get_optional_string(row, "organization_id"),
        organization_name: get_optional_string(row, "organization_name"),
        project_id: get_optional_string(row, "project_id"),
        project_name: get_optional_string(row, "project_name"),
        environment_profile_id: get_optional_string(row, "environment_profile_id"),
        environment_name: get_optional_string(row, "environment_name"),
        expected_git_user_name: get_optional_string(row, "expected_git_user_name"),
        expected_git_user_email: get_optional_string(row, "expected_git_user_email"),
    }
}

pub fn fetch_repositories(db_path: &Path) -> Result<Vec<RepositoryListItemDto>, String> {
    let rows = sqlite_json(
        db_path,
        "SELECT r.id, r.name, r.local_path, r.provider_host, r.remote_url, r.default_branch, r.is_active,
                r.organization_id, org.name AS organization_name,
                r.project_id, p.name AS project_name,
                ri.environment_profile_id AS environment_profile_id,
                ep.name AS environment_name,
                COALESCE(ri.git_user_name, ep.git_user_name) AS expected_git_user_name,
                COALESCE(ri.git_user_email, ep.git_user_email) AS expected_git_user_email
         FROM repositories r
         LEFT JOIN organizations org ON org.id = r.organization_id
         LEFT JOIN projects p ON p.id = r.project_id
         LEFT JOIN repository_identities ri ON ri.repository_id = r.id
         LEFT JOIN environment_profiles ep ON ep.id = ri.environment_profile_id
         ORDER BY org.name ASC, r.name ASC;",
    )?;

    Ok(rows.iter().map(map_repository_list_item).collect())
}

pub fn fetch_repository_by_id(
    db_path: &Path,
    repository_id: &str,
) -> Result<Option<RepositoryListItemDto>, String> {
    let rows = sqlite_json(
        db_path,
        &format!(
            "SELECT r.id, r.name, r.local_path, r.provider_host, r.remote_url, r.default_branch, r.is_active,
                    r.organization_id, org.name AS organization_name,
                    r.project_id, p.name AS project_name,
                    ri.environment_profile_id AS environment_profile_id,
                    ep.name AS environment_name,
                    COALESCE(ri.git_user_name, ep.git_user_name) AS expected_git_user_name,
                    COALESCE(ri.git_user_email, ep.git_user_email) AS expected_git_user_email
             FROM repositories r
             LEFT JOIN organizations org ON org.id = r.organization_id
             LEFT JOIN projects p ON p.id = r.project_id
             LEFT JOIN repository_identities ri ON ri.repository_id = r.id
             LEFT JOIN environment_profiles ep ON ep.id = ri.environment_profile_id
             WHERE r.id = '{}'
             LIMIT 1;",
            escape_sql(repository_id)
        ),
    )?;

    Ok(rows.first().map(map_repository_list_item))
}

pub fn work_item_exists(db_path: &Path, work_item_id: &str) -> Result<bool, String> {
    let rows = sqlite_json(
        db_path,
        &format!(
            "SELECT id FROM work_items WHERE id = '{}' LIMIT 1;",
            escape_sql(work_item_id)
        ),
    )?;
    Ok(!rows.is_empty())
}

pub fn dependency_exists(
    db_path: &Path,
    from_work_item_id: &str,
    to_work_item_id: &str,
) -> Result<bool, String> {
    let rows = sqlite_json(
        db_path,
        &format!(
            "SELECT id FROM work_item_dependencies WHERE from_work_item_id = '{}' AND to_work_item_id = '{}' LIMIT 1;",
            escape_sql(from_work_item_id),
            escape_sql(to_work_item_id)
        ),
    )?;
    Ok(!rows.is_empty())
}

pub fn fetch_all_dependencies(db_path: &Path) -> Result<Vec<(String, String, String)>, String> {
    let rows = sqlite_json(
        db_path,
        "SELECT from_work_item_id, to_work_item_id, dependency_type FROM work_item_dependencies;",
    )?;

    Ok(rows
        .into_iter()
        .map(|row| {
            (
                get_string(&row, "from_work_item_id").unwrap_or_default(),
                get_string(&row, "to_work_item_id").unwrap_or_default(),
                get_string(&row, "dependency_type").unwrap_or_default(),
            )
        })
        .collect())
}

pub fn get_string(value: &Value, key: &str) -> Option<String> {
    value.get(key).and_then(Value::as_str).map(str::to_string)
}

pub fn get_optional_string(value: &Value, key: &str) -> Option<String> {
    get_string(value, key)
}

pub fn get_i64(value: &Value, key: &str) -> Option<i64> {
    value.get(key).and_then(Value::as_i64)
}

pub fn escape_sql(value: &str) -> String {
    value.replace('\'', "''")
}

pub fn nullable_sql(value: Option<&str>) -> String {
    value
        .map(|entry| format!("'{}'", escape_sql(entry)))
        .unwrap_or_else(|| "NULL".to_string())
}

fn map_session_row(row: &Value) -> SessionLogDto {
    SessionLogDto {
        id: get_string(row, "id").unwrap_or_default(),
        work_item_id: get_optional_string(row, "work_item_id"),
        repository_id: get_optional_string(row, "repository_id"),
        branch_name: get_optional_string(row, "branch_name"),
        started_at: get_string(row, "started_at").unwrap_or_default(),
        ended_at: get_optional_string(row, "ended_at"),
        goal: get_optional_string(row, "goal"),
        decisions: get_optional_string(row, "decisions"),
        result: get_optional_string(row, "result"),
        source_type: get_string(row, "source_type").unwrap_or_else(|| "captured".to_string()),
    }
}

fn map_note_row(row: &Value) -> KnowledgeNoteDto {
    KnowledgeNoteDto {
        id: get_string(row, "id").unwrap_or_default(),
        entity_type: get_string(row, "entity_type").unwrap_or_default(),
        entity_id: get_string(row, "entity_id").unwrap_or_default(),
        note_type: get_string(row, "note_type").unwrap_or_default(),
        title: get_string(row, "title").unwrap_or_default(),
        content: get_string(row, "content").unwrap_or_default(),
        source_type: get_string(row, "source_type").unwrap_or_default(),
        created_at: get_string(row, "created_at").unwrap_or_default(),
    }
}

mod history;
mod organizations;
mod search;

pub use history::list_context_history;
pub use organizations::{
    clear_organization_logo, fetch_organization_by_id, fetch_organizations, insert_organization,
    read_organization_logo_data_url, set_organization_logo, update_environment_profile_for_org,
    update_organization_record,
};
pub use search::search_local_history;

fn map_artifact_row(row: &Value) -> ArtifactDto {
    ArtifactDto {
        id: get_string(row, "id").unwrap_or_default(),
        repository_id: get_optional_string(row, "repository_id"),
        artifact_type: get_string(row, "type").unwrap_or_default(),
        title: get_optional_string(row, "title"),
        url: get_optional_string(row, "url"),
        created_at: get_string(row, "created_at").unwrap_or_default(),
        source_type: get_string(row, "source_type").unwrap_or_else(|| "manual".to_string()),
    }
}
