use crate::db::{escape_sql, get_i64, get_string, nullable_sql, resolve_primary_workspace_id, sqlite_exec, sqlite_json};
use crate::dto::PlanItemDto;
use crate::util::{iso_now, unix_timestamp_millis};
use std::path::Path;

pub fn today_plan_date() -> String {
    chrono::Utc::now().format("%Y-%m-%d").to_string()
}

pub fn fetch_persisted_today_plan(db_path: &Path) -> Result<Option<Vec<PlanItemDto>>, String> {
    let plan_date = today_plan_date();
    let rows = sqlite_json(
        db_path,
        &format!(
            "SELECT dp.id AS daily_plan_id, dpi.id, dpi.work_item_id, dpi.position, dpi.is_committed
             FROM daily_plans dp
             INNER JOIN daily_plan_items dpi ON dpi.daily_plan_id = dp.id
             WHERE dp.plan_date = '{}'
             ORDER BY dpi.position ASC;",
            escape_sql(&plan_date)
        ),
    )?;

    if rows.is_empty() {
        return Ok(None);
    }

    Ok(Some(
        rows.iter()
            .enumerate()
            .map(|(index, row)| PlanItemDto {
                id: get_string(row, "id").unwrap_or_default(),
                daily_plan_id: get_string(row, "daily_plan_id").unwrap_or_default(),
                work_item_id: get_string(row, "work_item_id").unwrap_or_default(),
                position: get_string(row, "position")
                    .and_then(|value| value.parse().ok())
                    .unwrap_or(index + 1),
                is_committed: get_i64(row, "is_committed").unwrap_or(0) == 1,
            })
            .collect(),
    ))
}

pub fn commit_today_plan(
    db_path: &Path,
    work_item_ids: &[String],
) -> Result<Vec<PlanItemDto>, String> {
    if work_item_ids.is_empty() {
        return Err("Selecione ao menos uma tarefa para o plano do dia.".to_string());
    }

    let workspace_id = resolve_primary_workspace_id(db_path)?;
    let plan_date = today_plan_date();
    let now = iso_now()?;

    let existing = sqlite_json(
        db_path,
        &format!(
            "SELECT id FROM daily_plans WHERE plan_date = '{}' LIMIT 1;",
            escape_sql(&plan_date)
        ),
    )?;

    let daily_plan_id = if let Some(row) = existing.first() {
        let plan_id = get_string(row, "id").unwrap_or_default();
        sqlite_exec(
            db_path,
            &format!(
                "DELETE FROM daily_plan_items WHERE daily_plan_id = '{}';",
                escape_sql(&plan_id)
            ),
        )?;
        plan_id
    } else {
        let plan_id = format!("dp-{}", unix_timestamp_millis()?);
        sqlite_exec(
            db_path,
            &format!(
                "INSERT INTO daily_plans (id, workspace_id, plan_date, summary, created_at, updated_at)
                 VALUES ('{}', '{}', '{}', NULL, '{}', '{}');",
                escape_sql(&plan_id),
                escape_sql(&workspace_id),
                escape_sql(&plan_date),
                escape_sql(&now),
                escape_sql(&now)
            ),
        )?;
        plan_id
    };

    for (index, work_item_id) in work_item_ids.iter().enumerate() {
        let item_id = format!("dpi-{}-{}", daily_plan_id, index + 1);
        let is_committed = index == 0;
        sqlite_exec(
            db_path,
            &format!(
                "INSERT INTO daily_plan_items (id, daily_plan_id, work_item_id, position, is_committed)
                 VALUES ('{}', '{}', '{}', {}, {});",
                escape_sql(&item_id),
                escape_sql(&daily_plan_id),
                escape_sql(work_item_id),
                index + 1,
                if is_committed { 1 } else { 0 }
            ),
        )?;
    }

    fetch_persisted_today_plan(db_path)?
        .ok_or_else(|| "Nao foi possivel carregar o plano salvo.".to_string())
}
