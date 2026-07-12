use crate::db::{get_optional_string, get_string, sqlite_json};
use crate::dto::ContextEventDto;
use std::path::Path;

const DEFAULT_LIMIT: usize = 150;

pub fn list_context_history(
    db_path: &Path,
    limit: Option<u32>,
) -> Result<Vec<ContextEventDto>, String> {
    let result_limit = limit
        .map(|value| value as usize)
        .unwrap_or(DEFAULT_LIMIT)
        .min(500);

    let rows = sqlite_json(
        db_path,
        &format!(
            "SELECT kind, id, title, detail, created_at, work_item_id, work_item_title,
                    repository_id, repository_name, organization_id, organization_name
             FROM (
              SELECT 'session' AS kind, s.id AS id,
                     COALESCE(
                       CASE
                         WHEN wi.external_key IS NOT NULL AND wi.external_key != ''
                           THEN wi.external_key || ' · ' || COALESCE(s.goal, 'Sessao sem objetivo')
                         ELSE COALESCE(s.goal, 'Sessao sem objetivo')
                       END,
                       'Sessao sem objetivo'
                     ) AS title,
                     trim(
                       COALESCE(s.result, '')
                       || CASE WHEN s.branch_name IS NOT NULL AND s.branch_name != '' THEN ' · ' || s.branch_name ELSE '' END
                       || CASE WHEN wi.external_provider IS NOT NULL AND wi.external_provider != '' THEN ' · ' || wi.external_provider ELSE '' END
                     ) AS detail,
                     s.started_at AS created_at,
                     s.work_item_id AS work_item_id,
                     wi.title AS work_item_title,
                     s.repository_id AS repository_id,
                     r.name AS repository_name,
                     COALESCE(wi.organization_id, r.organization_id) AS organization_id,
                     o.name AS organization_name
              FROM session_logs s
              LEFT JOIN work_items wi ON wi.id = s.work_item_id
              LEFT JOIN repositories r ON r.id = s.repository_id
              LEFT JOIN organizations o ON o.id = COALESCE(wi.organization_id, r.organization_id)

              UNION ALL

              SELECT 'decision' AS kind, s.id || '-decision' AS id,
                     'Decisao registrada' AS title,
                     s.decisions AS detail,
                     COALESCE(s.ended_at, s.started_at) AS created_at,
                     s.work_item_id AS work_item_id,
                     wi.title AS work_item_title,
                     s.repository_id AS repository_id,
                     r.name AS repository_name,
                     COALESCE(wi.organization_id, r.organization_id) AS organization_id,
                     o.name AS organization_name
              FROM session_logs s
              LEFT JOIN work_items wi ON wi.id = s.work_item_id
              LEFT JOIN repositories r ON r.id = s.repository_id
              LEFT JOIN organizations o ON o.id = COALESCE(wi.organization_id, r.organization_id)
              WHERE COALESCE(s.decisions, '') != ''

              UNION ALL

              SELECT 'note' AS kind, n.id AS id,
                     n.title AS title,
                     substr(n.content, 1, 160) AS detail,
                     n.created_at AS created_at,
                     CASE WHEN n.entity_type = 'work_item' THEN n.entity_id ELSE NULL END AS work_item_id,
                     wi.title AS work_item_title,
                     COALESCE(wi.primary_repository_id, CASE WHEN n.entity_type = 'repository' THEN n.entity_id ELSE NULL END) AS repository_id,
                     COALESCE(wi_repo.name, repo.name) AS repository_name,
                     COALESCE(wi.organization_id, repo.organization_id) AS organization_id,
                     COALESCE(wi_org.name, repo_org.name) AS organization_name
              FROM knowledge_notes n
              LEFT JOIN work_items wi ON n.entity_type = 'work_item' AND wi.id = n.entity_id
              LEFT JOIN repositories wi_repo ON wi_repo.id = wi.primary_repository_id
              LEFT JOIN organizations wi_org ON wi_org.id = wi.organization_id
              LEFT JOIN repositories repo ON n.entity_type = 'repository' AND repo.id = n.entity_id
              LEFT JOIN organizations repo_org ON repo_org.id = repo.organization_id
              WHERE n.entity_type = 'work_item'

              UNION ALL

              SELECT 'repository' AS kind, n.id AS id,
                     n.title AS title,
                     substr(n.content, 1, 160) AS detail,
                     n.created_at AS created_at,
                     NULL AS work_item_id,
                     NULL AS work_item_title,
                     n.entity_id AS repository_id,
                     repo.name AS repository_name,
                     repo.organization_id AS organization_id,
                     repo_org.name AS organization_name
              FROM knowledge_notes n
              INNER JOIN repositories repo ON n.entity_type = 'repository' AND repo.id = n.entity_id
              LEFT JOIN organizations repo_org ON repo_org.id = repo.organization_id

              UNION ALL

              SELECT 'artifact' AS kind, a.id AS id,
                     COALESCE(a.title, a.type) AS title,
                     COALESCE(a.url, a.type) AS detail,
                     a.created_at AS created_at,
                     l.from_entity_id AS work_item_id,
                     wi.title AS work_item_title,
                     a.repository_id AS repository_id,
                     r.name AS repository_name,
                     COALESCE(wi.organization_id, r.organization_id) AS organization_id,
                     o.name AS organization_name
              FROM artifacts a
              LEFT JOIN entity_links l
                ON l.to_entity_id = a.id
               AND l.to_entity_type = 'artifact'
               AND l.from_entity_type = 'work_item'
              LEFT JOIN work_items wi ON wi.id = l.from_entity_id
              LEFT JOIN repositories r ON r.id = a.repository_id
              LEFT JOIN organizations o ON o.id = COALESCE(wi.organization_id, r.organization_id)

              UNION ALL

              SELECT 'block' AS kind, wi.id || '-block' AS id,
                     'Bloqueio ativo' AS title,
                     wi.blocked_reason AS detail,
                     wi.updated_at AS created_at,
                     wi.id AS work_item_id,
                     wi.title AS work_item_title,
                     wi.primary_repository_id AS repository_id,
                     r.name AS repository_name,
                     wi.organization_id AS organization_id,
                     o.name AS organization_name
              FROM work_items wi
              LEFT JOIN repositories r ON r.id = wi.primary_repository_id
              LEFT JOIN organizations o ON o.id = wi.organization_id
              WHERE COALESCE(wi.blocked_reason, '') != ''

              UNION ALL

              SELECT 'dependency' AS kind, wd.id AS id,
                     wf.title || ' → ' || wt.title AS title,
                     wd.dependency_type AS detail,
                     wd.created_at AS created_at,
                     wd.from_work_item_id AS work_item_id,
                     wf.title AS work_item_title,
                     wf.primary_repository_id AS repository_id,
                     r.name AS repository_name,
                     wf.organization_id AS organization_id,
                     o.name AS organization_name
              FROM work_item_dependencies wd
              INNER JOIN work_items wf ON wf.id = wd.from_work_item_id
              INNER JOIN work_items wt ON wt.id = wd.to_work_item_id
              LEFT JOIN repositories r ON r.id = wf.primary_repository_id
              LEFT JOIN organizations o ON o.id = wf.organization_id

              UNION ALL

              SELECT 'task' AS kind, wi.id AS id,
                     wi.title AS title,
                     trim(
                       wi.status
                       || CASE WHEN COALESCE(wi.resume_summary, '') != '' THEN ' · ' || wi.resume_summary
                               WHEN COALESCE(wi.description, '') != '' THEN ' · ' || substr(wi.description, 1, 120)
                               WHEN COALESCE(wi.blocked_reason, '') != '' THEN ' · ' || wi.blocked_reason
                               ELSE '' END
                     ) AS detail,
                     wi.updated_at AS created_at,
                     wi.id AS work_item_id,
                     wi.title AS work_item_title,
                     wi.primary_repository_id AS repository_id,
                     r.name AS repository_name,
                     wi.organization_id AS organization_id,
                     o.name AS organization_name
              FROM work_items wi
              LEFT JOIN repositories r ON r.id = wi.primary_repository_id
              LEFT JOIN organizations o ON o.id = wi.organization_id
              WHERE wi.status != 'archived'

              UNION ALL

              SELECT 'repository' AS kind, r.id || '-repo' AS id,
                     r.name AS title,
                     COALESCE(r.local_path, r.remote_url, '') AS detail,
                     r.updated_at AS created_at,
                     NULL AS work_item_id,
                     NULL AS work_item_title,
                     r.id AS repository_id,
                     r.name AS repository_name,
                     r.organization_id AS organization_id,
                     o.name AS organization_name
              FROM repositories r
              LEFT JOIN organizations o ON o.id = r.organization_id
              WHERE r.is_active = 1
            ) AS results
            ORDER BY created_at DESC
            LIMIT {result_limit};"
        ),
    )?;

    Ok(rows
        .into_iter()
        .map(|row| ContextEventDto {
            id: get_string(&row, "id").unwrap_or_default(),
            kind: get_string(&row, "kind").unwrap_or_default(),
            title: get_string(&row, "title").unwrap_or_default(),
            detail: get_string(&row, "detail").unwrap_or_default(),
            created_at: get_string(&row, "created_at").unwrap_or_default(),
            work_item_id: get_optional_string(&row, "work_item_id"),
            work_item_title: get_optional_string(&row, "work_item_title"),
            repository_id: get_optional_string(&row, "repository_id"),
            repository_name: get_optional_string(&row, "repository_name"),
            organization_id: get_optional_string(&row, "organization_id"),
            organization_name: get_optional_string(&row, "organization_name"),
        })
        .collect())
}
