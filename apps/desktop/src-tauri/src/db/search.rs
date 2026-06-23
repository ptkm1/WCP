use crate::db::{get_optional_string, get_string, sqlite_json};
use crate::dto::SearchResultDto;
use std::path::Path;

const MIN_QUERY_LEN: usize = 2;
const RESULT_LIMIT: usize = 40;

pub fn search_local_history(db_path: &Path, query: &str) -> Result<Vec<SearchResultDto>, String> {
    let trimmed = query.trim();
    if trimmed.len() < MIN_QUERY_LEN {
        return Ok(Vec::new());
    }

    let pattern = escape_like_pattern(trimmed);
    let rows = sqlite_json(
        db_path,
        &format!(
            "SELECT kind, id, title, detail, created_at, work_item_id, repository_id FROM (
              SELECT 'task' AS kind, wi.id AS id, wi.title AS title,
                     COALESCE(wi.description, wi.status) AS detail,
                     wi.updated_at AS created_at, wi.id AS work_item_id, NULL AS repository_id
              FROM work_items wi
              WHERE lower(wi.title) LIKE '{pattern}' ESCAPE '\\'
                 OR lower(COALESCE(wi.description, '')) LIKE '{pattern}' ESCAPE '\\'
                 OR lower(COALESCE(wi.blocked_reason, '')) LIKE '{pattern}' ESCAPE '\\'
                 OR lower(COALESCE(wi.resume_summary, '')) LIKE '{pattern}' ESCAPE '\\'

              UNION ALL

              SELECT 'note' AS kind, n.id AS id, n.title AS title,
                     n.entity_type || ' · ' || substr(n.content, 1, 120) AS detail,
                     n.created_at AS created_at,
                     CASE WHEN n.entity_type = 'work_item' THEN n.entity_id ELSE NULL END AS work_item_id,
                     CASE WHEN n.entity_type = 'repository' THEN n.entity_id ELSE NULL END AS repository_id
              FROM knowledge_notes n
              WHERE lower(n.title) LIKE '{pattern}' ESCAPE '\\'
                 OR lower(n.content) LIKE '{pattern}' ESCAPE '\\'

              UNION ALL

              SELECT 'session' AS kind, s.id AS id,
                     COALESCE(s.goal, 'Sessao sem objetivo') AS title,
                     COALESCE(s.result, s.branch_name, '') AS detail,
                     s.started_at AS created_at, s.work_item_id AS work_item_id, s.repository_id AS repository_id
              FROM session_logs s
              WHERE lower(COALESCE(s.goal, '')) LIKE '{pattern}' ESCAPE '\\'
                 OR lower(COALESCE(s.result, '')) LIKE '{pattern}' ESCAPE '\\'
                 OR lower(COALESCE(s.decisions, '')) LIKE '{pattern}' ESCAPE '\\'
                 OR lower(COALESCE(s.branch_name, '')) LIKE '{pattern}' ESCAPE '\\'

              UNION ALL

              SELECT 'artifact' AS kind, a.id AS id,
                     COALESCE(a.title, a.type) AS title,
                     COALESCE(a.url, a.type) AS detail,
                     a.created_at AS created_at, l.from_entity_id AS work_item_id, a.repository_id AS repository_id
              FROM artifacts a
              LEFT JOIN entity_links l
                ON l.to_entity_id = a.id
               AND l.to_entity_type = 'artifact'
               AND l.from_entity_type = 'work_item'
              WHERE lower(COALESCE(a.title, '')) LIKE '{pattern}' ESCAPE '\\'
                 OR lower(COALESCE(a.url, '')) LIKE '{pattern}' ESCAPE '\\'
                 OR lower(a.type) LIKE '{pattern}' ESCAPE '\\'

              UNION ALL

              SELECT 'repository' AS kind, r.id AS id, r.name AS title,
                     COALESCE(r.remote_url, r.local_path, '') AS detail,
                     r.updated_at AS created_at, NULL AS work_item_id, r.id AS repository_id
              FROM repositories r
              WHERE lower(r.name) LIKE '{pattern}' ESCAPE '\\'
                 OR lower(COALESCE(r.remote_url, '')) LIKE '{pattern}' ESCAPE '\\'
                 OR lower(COALESCE(r.local_path, '')) LIKE '{pattern}' ESCAPE '\\'

              UNION ALL

              SELECT 'dependency' AS kind, wd.id AS id,
                     wf.title || ' → ' || wt.title AS title,
                     wd.dependency_type AS detail,
                     wd.created_at AS created_at, wd.from_work_item_id AS work_item_id, NULL AS repository_id
              FROM work_item_dependencies wd
              INNER JOIN work_items wf ON wf.id = wd.from_work_item_id
              INNER JOIN work_items wt ON wt.id = wd.to_work_item_id
              WHERE lower(wf.title) LIKE '{pattern}' ESCAPE '\\'
                 OR lower(wt.title) LIKE '{pattern}' ESCAPE '\\'
                 OR lower(wd.dependency_type) LIKE '{pattern}' ESCAPE '\\'
            ) AS results
            ORDER BY created_at DESC
            LIMIT {RESULT_LIMIT};"
        ),
    )?;

    Ok(rows
        .into_iter()
        .map(|row| SearchResultDto {
            id: get_string(&row, "id").unwrap_or_default(),
            kind: get_string(&row, "kind").unwrap_or_default(),
            title: get_string(&row, "title").unwrap_or_default(),
            detail: get_string(&row, "detail").unwrap_or_default(),
            created_at: get_optional_string(&row, "created_at"),
            work_item_id: get_optional_string(&row, "work_item_id"),
            repository_id: get_optional_string(&row, "repository_id"),
        })
        .collect())
}

fn escape_like_pattern(value: &str) -> String {
    let escaped = value
        .to_lowercase()
        .replace('\\', "\\\\")
        .replace('\'', "''")
        .replace('%', "\\%")
        .replace('_', "\\_");
    format!("%{escaped}%")
}
