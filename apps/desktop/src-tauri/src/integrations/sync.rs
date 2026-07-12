use super::clickup::ClickUpClient;
use super::credentials::load_connection_credentials;
use super::filter::parse_sync_filter;
use super::jira::JiraClient;
use super::types::{PmProviderClient, SyncFilter};
use crate::db::{
    deadline_alert_sent_today, fetch_integration_connections, insert_activity_event,
    prune_stale_imported_work_items, update_integration_sync_status, upsert_imported_work_item,
};
use crate::db::{fetch_work_items, resolve_primary_workspace_id};
use crate::dto::{DeadlineAlertItemDto, DeadlineAlertsDto, PmSyncResultDto};
use crate::util::iso_now;
use serde_json::json;
use std::path::Path;

pub fn sync_organization_pm_tasks(
    db_path: &Path,
    organization_id: &str,
    provider_filter: Option<&str>,
) -> Result<PmSyncResultDto, String> {
    let workspace_id = resolve_primary_workspace_id(db_path)?;
    let connections = fetch_integration_connections(db_path, organization_id)?;
    let mut aggregate = PmSyncResultDto {
        created: 0,
        updated: 0,
        unchanged: 0,
        removed: 0,
        errors: Vec::new(),
    };

    for connection in connections {
        if !connection.is_active || !connection.sync_enabled {
            continue;
        }
        if let Some(provider) = provider_filter {
            if connection.provider != provider {
                continue;
            }
        }

        let filter = parse_sync_filter(connection.sync_filter_json.as_deref());
        let secret = match load_connection_credentials(&connection.id) {
            Ok(value) => value,
            Err(error) => {
                aggregate.errors.push(format!("{}: {error}", connection.provider));
                let _ = update_integration_sync_status(
                    db_path,
                    &connection.id,
                    None,
                    Some(&error),
                );
                continue;
            }
        };

        let sync_result = match connection.provider.as_str() {
            "jira" => sync_jira_connection(
                db_path,
                &workspace_id,
                organization_id,
                &connection.config_json,
                &secret,
                &filter,
            ),
            "clickup" => sync_clickup_connection(
                db_path,
                &workspace_id,
                organization_id,
                &connection.config_json,
                &secret,
                &filter,
            ),
            other => Err(format!("Provider nao suportado: {other}")),
        };

        match sync_result {
            Ok(result) => {
                aggregate.created += result.created;
                aggregate.updated += result.updated;
                aggregate.unchanged += result.unchanged;
                aggregate.removed += result.removed;
                let now = iso_now()?;
                update_integration_sync_status(db_path, &connection.id, Some(&now), None)?;
            }
            Err(error) => {
                aggregate.errors.push(format!("{}: {error}", connection.provider));
                update_integration_sync_status(db_path, &connection.id, None, Some(&error))?;
            }
        }
    }

    Ok(aggregate)
}

fn sync_jira_connection(
    db_path: &Path,
    workspace_id: &str,
    organization_id: &str,
    config_json: &str,
    secret_json: &str,
    filter: &SyncFilter,
) -> Result<PmSyncResultDto, String> {
    let config: serde_json::Value = serde_json::from_str(config_json)
        .map_err(|error| format!("Config Jira invalida: {error}"))?;
    let site_url = config
        .get("siteUrl")
        .and_then(|value| value.as_str())
        .ok_or_else(|| "Informe a URL do site Jira.".to_string())?;

    let client = JiraClient::from_credentials(site_url, secret_json)?;
    let tasks = client.list_assigned_tasks(filter)?;
    upsert_external_tasks(
        db_path,
        workspace_id,
        organization_id,
        client.provider_id(),
        tasks,
    )
}

fn sync_clickup_connection(
    db_path: &Path,
    workspace_id: &str,
    organization_id: &str,
    config_json: &str,
    secret_json: &str,
    filter: &SyncFilter,
) -> Result<PmSyncResultDto, String> {
    let config: serde_json::Value = serde_json::from_str(config_json)
        .map_err(|error| format!("Config ClickUp invalida: {error}"))?;
    let team_id = config.get("teamId").and_then(|value| value.as_str());

    let client = ClickUpClient::from_credentials(secret_json, team_id)?;
    let tasks = client.list_assigned_tasks(filter)?;
    upsert_external_tasks(
        db_path,
        workspace_id,
        organization_id,
        client.provider_id(),
        tasks,
    )
}

fn upsert_external_tasks(
    db_path: &Path,
    workspace_id: &str,
    organization_id: &str,
    provider: &str,
    tasks: Vec<super::types::ExternalTaskSnapshot>,
) -> Result<PmSyncResultDto, String> {
    let mut result = PmSyncResultDto {
        created: 0,
        updated: 0,
        unchanged: 0,
        removed: 0,
        errors: Vec::new(),
    };

    let synced_external_ids: Vec<String> = tasks.iter().map(|task| task.external_id.clone()).collect();

    for task in tasks {
        match upsert_imported_work_item(
            db_path,
            workspace_id,
            organization_id,
            provider,
            &task.external_id,
            task.external_key.as_deref(),
            task.external_url.as_deref(),
            task.external_project_key.as_deref(),
            &task.title,
            task.description.as_deref(),
            &task.status,
            task.priority,
            task.scheduled_for.as_deref(),
        ) {
            Ok((id, created)) => {
                if id.is_empty() {
                    continue;
                }
                if created {
                    result.created += 1;
                } else {
                    result.updated += 1;
                }
            }
            Err(error) => result.errors.push(error),
        }
    }

    match prune_stale_imported_work_items(
        db_path,
        organization_id,
        provider,
        &synced_external_ids,
    ) {
        Ok(removed) => result.removed = removed,
        Err(error) => result.errors.push(error),
    }

    Ok(result)
}

pub fn get_deadline_alerts(db_path: &Path) -> Result<DeadlineAlertsDto, String> {
    use crate::db::fetch_organizations;

    let items = fetch_work_items(db_path)?;
    let organizations: std::collections::HashMap<String, String> = fetch_organizations(db_path)?
        .into_iter()
        .map(|org| (org.id, org.name))
        .collect();
    let mut overdue = Vec::new();
    let mut due_today = Vec::new();
    let mut due_soon = Vec::new();

    let now = chrono::Utc::now();

    for item in items {
        if item.wcp_dismissed_at.is_some() {
            continue;
        }
        if item.source_type != "imported" {
            continue;
        }
        let Some(scheduled_for) = item.scheduled_for.clone() else {
            continue;
        };
        if item.status == "done" || item.status == "archived" {
            continue;
        }

        let Some(due) = parse_scheduled_date(&scheduled_for) else {
            continue;
        };

        let hours_until_due = (due - now).num_seconds() as f64 / 3600.0;
        let organization_name = item
            .organization_id
            .as_ref()
            .and_then(|id| organizations.get(id))
            .cloned();
        let alert = DeadlineAlertItemDto {
            work_item_id: item.id.clone(),
            title: item.title.clone(),
            scheduled_for,
            external_provider: item.external_provider.clone(),
            external_url: item.external_url.clone(),
            kind: "due_soon".to_string(),
            hours_until_due,
            organization_id: item.organization_id.clone(),
            organization_name,
        };

        if hours_until_due < 0.0 {
            let mut entry = alert.clone();
            entry.kind = "overdue".to_string();
            overdue.push(entry);
            continue;
        }

        let is_same_day = due.date_naive() == now.date_naive();
        if is_same_day {
            let mut entry = alert.clone();
            entry.kind = "due_today".to_string();
            due_today.push(entry);
            continue;
        }

        if hours_until_due <= 168.0 {
            let mut entry = alert;
            entry.kind = "due_soon".to_string();
            due_soon.push(entry);
        }
    }

    let mut all = overdue.clone();
    all.extend(due_today.clone());
    all.extend(due_soon.clone());

    Ok(DeadlineAlertsDto {
        overdue,
        due_today,
        due_soon,
        items: all,
    })
}

pub fn record_deadline_notification(
    db_path: &Path,
    workspace_id: &str,
    work_item_id: &str,
    threshold: &str,
) -> Result<bool, String> {
    if deadline_alert_sent_today(db_path, work_item_id, threshold)? {
        return Ok(false);
    }

    let payload = json!({ "threshold": threshold }).to_string();
    insert_activity_event(
        db_path,
        workspace_id,
        "work_item",
        work_item_id,
        "deadline_alert",
        Some(&payload),
    )?;
    Ok(true)
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
