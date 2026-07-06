mod clickup;
mod credentials;
mod jira;
mod sync;
mod types;

pub use clickup::ClickUpClient;
pub use credentials::{
    build_clickup_secret, build_jira_secret, credential_key_for_connection, delete_credentials,
    load_credentials, store_credentials,
};
pub use jira::JiraClient;
pub use sync::{get_deadline_alerts as compute_deadline_alerts, record_deadline_notification, sync_organization_pm_tasks};
use types::PmProviderClient;
pub use types::{ClickUpTeamDto, PmConnectionInfo, SyncFilter};

pub fn test_jira_connection(
    config_json: &str,
    credentials_json: &str,
) -> Result<PmConnectionInfo, String> {
    let config: serde_json::Value = serde_json::from_str(config_json)
        .map_err(|error| format!("Config Jira invalida: {error}"))?;
    let site_url = config
        .get("siteUrl")
        .and_then(|value| value.as_str())
        .ok_or_else(|| "Informe a URL do site Jira.".to_string())?;
    let client = JiraClient::from_credentials(site_url, credentials_json)?;
    client.test_connection()
}

pub fn test_clickup_connection(credentials_json: &str) -> Result<PmConnectionInfo, String> {
    let client = ClickUpClient::from_credentials(credentials_json, None)?;
    client.test_connection()
}

pub fn list_teams_for_clickup(
    credentials_json: &str,
    team_id: Option<&str>,
) -> Result<Vec<ClickUpTeamDto>, String> {
    let client = ClickUpClient::from_credentials(credentials_json, team_id)?;
    client.list_teams()
}
