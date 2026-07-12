use crate::db::{
    delete_integration_connection as remove_connection_record, delete_imported_work_items_for_provider,
    delete_pm_mappings_for_connection, ensure_db_ready, fetch_integration_connection_by_id,
    fetch_integration_connections, list_distinct_external_project_keys, list_pm_project_mappings,
    resolve_db_path,     resolve_primary_workspace_id, update_integration_sync_filter, upsert_integration_connection,
    upsert_pm_project_mapping,
};
use crate::integrations::default_sync_filter_json;
use crate::dto::{
    ClickUpTeamDto, ClickUpTeamListDto, DeadlineAlertsDto, IntegrationConnectionDto,
    PmConnectionInfoDto, PmConnectionTestResultDto, PmProjectMappingDto, PmSyncResultDto,
    SaveIntegrationConnectionResultDto,
};
use crate::integrations::{
    build_clickup_secret, compute_deadline_alerts, credential_key_for_connection,
    delete_credentials, has_connection_credentials, list_teams_for_clickup,
    load_connection_credentials, record_deadline_notification, store_credentials,
    sync_organization_pm_tasks,
};

#[tauri::command]
pub fn list_integration_connections(
    organization_id: String,
) -> Result<Vec<IntegrationConnectionDto>, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    let mut connections = fetch_integration_connections(&db_path, &organization_id)?;
    for connection in &mut connections {
        connection.has_credentials = has_connection_credentials(&connection.id);
    }
    Ok(connections)
}

#[tauri::command]
pub fn save_integration_connection(
    organization_id: String,
    provider: String,
    display_name: Option<String>,
    config_json: String,
    credentials_json: String,
    sync_filter_json: Option<String>,
) -> Result<SaveIntegrationConnectionResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    let workspace_id = resolve_primary_workspace_id(&db_path)?;

    let provider = provider.trim().to_lowercase();
    if !matches!(provider.as_str(), "jira" | "clickup") {
        return Err("Provider invalido. Use jira ou clickup.".to_string());
    }

    validate_credentials(&provider, &credentials_json)?;

    let existing = fetch_integration_connections(&db_path, &organization_id)?
        .into_iter()
        .find(|entry| entry.provider == provider);
    let connection_id = if let Some(entry) = existing.as_ref() {
        entry.id.clone()
    } else {
        format!(
            "int-{}",
            crate::util::unix_timestamp_millis()
                .map_err(|error| format!("Falha ao gerar id da conexao: {error}"))?
        )
    };

    let credential_key = credential_key_for_connection(&connection_id);

    if let Some(entry) = existing.as_ref() {
        let previous_key = credential_key_for_connection(&entry.id);
        if entry.credential_key != previous_key {
            let _ = delete_credentials(&entry.credential_key);
        }
    }

    store_credentials(&credential_key, &credentials_json)?;
    load_connection_credentials(&connection_id).map_err(|error| {
        format!("Credenciais nao foram persistidas no secure storage: {error}")
    })?;

    let sync_filter = sync_filter_json
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            existing
                .as_ref()
                .and_then(|entry| entry.sync_filter_json.clone())
        })
        .unwrap_or_else(default_sync_filter_json);

    let mut connection = upsert_integration_connection(
        &db_path,
        &workspace_id,
        &organization_id,
        &provider,
        display_name.as_deref(),
        &config_json,
        &connection_id,
        &credential_key,
        Some(&sync_filter),
    )?;
    connection.has_credentials = true;

    Ok(SaveIntegrationConnectionResultDto { connection })
}

#[tauri::command]
pub fn save_integration_sync_filter(
    connection_id: String,
    sync_filter_json: String,
) -> Result<IntegrationConnectionDto, String> {
    if sync_filter_json.trim().is_empty() {
        return Err("Informe os filtros de sincronizacao.".to_string());
    }

    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;

    let connection = fetch_integration_connection_by_id(&db_path, &connection_id)?
        .ok_or_else(|| "Conexao nao encontrada.".to_string())?;

    let mut updated =
        update_integration_sync_filter(&db_path, &connection.id, sync_filter_json.trim())?;
    updated.has_credentials = has_connection_credentials(&updated.id);
    Ok(updated)
}

#[tauri::command]
pub fn delete_integration_connection(connection_id: String) -> Result<(), String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;

    let connection = fetch_integration_connection_by_id(&db_path, &connection_id)?
        .ok_or_else(|| "Conexao nao encontrada.".to_string())?;

    delete_imported_work_items_for_provider(
        &db_path,
        &connection.organization_id,
        &connection.provider,
    )?;
    delete_pm_mappings_for_connection(&db_path, &connection_id)?;
    delete_credentials(&credential_key_for_connection(&connection.id))?;
    remove_connection_record(&db_path, &connection_id)
}

#[tauri::command]
pub fn test_integration_connection(
    provider: String,
    config_json: String,
    credentials_json: String,
    connection_id: Option<String>,
) -> Result<PmConnectionTestResultDto, String> {
    let provider = provider.trim().to_lowercase();
    let credentials_json = resolve_credentials_json(connection_id.as_deref(), &credentials_json)?;

    match test_provider(&provider, &config_json, &credentials_json) {
        Ok(info) => Ok(PmConnectionTestResultDto {
            ok: true,
            info: Some(info),
            error: None,
        }),
        Err(error) => Ok(PmConnectionTestResultDto {
            ok: false,
            info: None,
            error: Some(error),
        }),
    }
}

#[tauri::command]
pub fn list_clickup_teams(
    api_token: Option<String>,
    connection_id: Option<String>,
) -> Result<ClickUpTeamListDto, String> {
    let credentials_json = if let Some(token) = api_token.filter(|value| !value.trim().is_empty()) {
        build_clickup_secret(&token)?
    } else {
        let db_path = resolve_db_path()?;
        ensure_db_ready(&db_path)?;
        let connection_id = connection_id.ok_or_else(|| "Informe connectionId ou apiToken.".to_string())?;
        let connection = fetch_integration_connection_by_id(&db_path, &connection_id)?
            .ok_or_else(|| "Conexao nao encontrada.".to_string())?;
        load_connection_credentials(&connection.id)?
    };

    let teams = list_teams_for_clickup(&credentials_json, None)?;
    Ok(ClickUpTeamListDto {
        teams: teams
            .into_iter()
            .map(|team| ClickUpTeamDto {
                id: team.id,
                name: team.name,
            })
            .collect(),
    })
}

#[tauri::command]
pub fn sync_organization_pm_tasks_command(
    organization_id: String,
    provider: Option<String>,
) -> Result<PmSyncResultDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    sync_organization_pm_tasks(
        &db_path,
        organization_id.trim(),
        provider.as_deref().map(str::trim),
    )
}

#[tauri::command]
pub fn get_deadline_alerts() -> Result<DeadlineAlertsDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    compute_deadline_alerts(&db_path)
}

#[tauri::command]
pub fn notify_deadline_alerts() -> Result<usize, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    let workspace_id = resolve_primary_workspace_id(&db_path)?;
    let alerts = compute_deadline_alerts(&db_path)?;

    let mut sent = 0usize;
    for item in alerts
        .overdue
        .iter()
        .chain(alerts.due_today.iter())
        .chain(
            alerts
                .due_soon
                .iter()
                .filter(|entry| entry.hours_until_due <= 24.0),
        )
    {
        let threshold = match item.kind.as_str() {
            "overdue" => "overdue",
            "due_today" => "due_today",
            _ => "due_24h",
        };

        if record_deadline_notification(&db_path, &workspace_id, &item.work_item_id, threshold)? {
            let title = match item.kind.as_str() {
                "overdue" => "Prazo vencido",
                "due_today" => "Entrega hoje",
                _ => "Prazo em 24h",
            };
            let _ = notify_rust::Notification::new()
                .summary(title)
                .body(&format!("{} · {}", item.title, item.scheduled_for))
                .show();
            sent += 1;
        }
    }

    Ok(sent)
}

fn resolve_credentials_json(
    connection_id: Option<&str>,
    fallback_json: &str,
) -> Result<String, String> {
    if fallback_json.trim().starts_with('{') && !fallback_json.trim().is_empty() {
        return Ok(fallback_json.to_string());
    }

    if let Some(connection_id) = connection_id {
        let db_path = resolve_db_path()?;
        ensure_db_ready(&db_path)?;
        fetch_integration_connection_by_id(&db_path, connection_id)?
            .ok_or_else(|| "Conexao nao encontrada.".to_string())?;
        return load_connection_credentials(connection_id);
    }

    Err("Informe credenciais ou connectionId.".to_string())
}

fn validate_credentials(provider: &str, credentials_json: &str) -> Result<(), String> {
    match provider {
        "jira" => {
            let value: serde_json::Value = serde_json::from_str(credentials_json)
                .map_err(|error| format!("Credenciais Jira invalidas: {error}"))?;
            if value.get("email").and_then(|entry| entry.as_str()).unwrap_or("").is_empty() {
                return Err("Informe o email do Jira.".to_string());
            }
            if value
                .get("apiToken")
                .or_else(|| value.get("api_token"))
                .and_then(|entry| entry.as_str())
                .unwrap_or("")
                .is_empty()
            {
                return Err("Informe o API token do Jira.".to_string());
            }
        }
        "clickup" => {
            let value: serde_json::Value = serde_json::from_str(credentials_json)
                .map_err(|error| format!("Credenciais ClickUp invalidas: {error}"))?;
            if value
                .get("apiToken")
                .or_else(|| value.get("api_token"))
                .and_then(|entry| entry.as_str())
                .unwrap_or("")
                .is_empty()
            {
                return Err("Informe o API token do ClickUp.".to_string());
            }
        }
        _ => return Err("Provider invalido.".to_string()),
    }
    Ok(())
}

fn test_provider(
    provider: &str,
    config_json: &str,
    credentials_json: &str,
) -> Result<PmConnectionInfoDto, String> {
    match provider {
        "jira" => test_jira_connection_cmd(config_json, credentials_json),
        "clickup" => test_clickup_connection_cmd(credentials_json),
        _ => Err("Provider invalido.".to_string()),
    }
}

fn test_jira_connection_cmd(
    config_json: &str,
    credentials_json: &str,
) -> Result<PmConnectionInfoDto, String> {
    Ok(map_connection_info(crate::integrations::test_jira_connection(
        config_json,
        credentials_json,
    )?))
}

fn test_clickup_connection_cmd(credentials_json: &str) -> Result<PmConnectionInfoDto, String> {
    Ok(map_connection_info(crate::integrations::test_clickup_connection(
        credentials_json,
    )?))
}

fn map_connection_info(info: crate::integrations::PmConnectionInfo) -> PmConnectionInfoDto {
    PmConnectionInfoDto {
        provider: info.provider,
        account_label: info.account_label,
        account_id: info.account_id,
    }
}

#[tauri::command]
pub fn list_pm_external_projects(organization_id: String) -> Result<Vec<String>, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    list_distinct_external_project_keys(&db_path, &organization_id)
}

#[tauri::command]
pub fn list_pm_project_mappings_command(
    organization_id: String,
) -> Result<Vec<PmProjectMappingDto>, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    list_pm_project_mappings(&db_path, &organization_id)
}

#[tauri::command]
pub fn save_pm_project_mapping(
    organization_id: String,
    integration_connection_id: Option<String>,
    external_project_key: String,
    project_id: String,
    default_repository_id: Option<String>,
) -> Result<PmProjectMappingDto, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    upsert_pm_project_mapping(
        &db_path,
        &organization_id,
        integration_connection_id.as_deref(),
        &external_project_key,
        &project_id,
        default_repository_id.as_deref(),
    )
}
