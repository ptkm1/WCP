use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JiraCredentials {
    pub email: String,
    pub api_token: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClickUpCredentials {
    pub api_token: String,
}

#[derive(Clone, Debug)]
pub struct ExternalTaskSnapshot {
    pub external_id: String,
    pub external_key: Option<String>,
    pub external_url: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub scheduled_for: Option<String>,
    pub priority: i64,
}

#[derive(Clone, Debug, Default)]
pub struct SyncFilter {
    pub assignee_only: bool,
    pub include_closed: bool,
    pub jql: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PmConnectionInfo {
    pub provider: String,
    pub account_label: String,
    pub account_id: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClickUpTeamDto {
    pub id: String,
    pub name: String,
}

pub trait PmProviderClient {
    fn provider_id(&self) -> &'static str;
    fn test_connection(&self) -> Result<PmConnectionInfo, String>;
    fn list_assigned_tasks(&self, filter: &SyncFilter) -> Result<Vec<ExternalTaskSnapshot>, String>;
}

pub fn normalize_pm_status(provider: &str, status_label: &str) -> String {
    let normalized = status_label.trim().to_lowercase();

    if provider == "clickup" {
        if normalized.contains("closed") || normalized.contains("complete") {
            return "done".to_string();
        }
        if normalized.contains("progress") {
            return "doing".to_string();
        }
        if normalized.contains("block") {
            return "blocked".to_string();
        }
        if normalized.contains("open") || normalized.contains("to do") {
            return "todo".to_string();
        }
        return "backlog".to_string();
    }

    if normalized.contains("done")
        || normalized.contains("closed")
        || normalized.contains("resolved")
    {
        return "done".to_string();
    }
    if normalized.contains("progress") || normalized.contains("doing") {
        return "doing".to_string();
    }
    if normalized.contains("block") {
        return "blocked".to_string();
    }
    if normalized.contains("to do") || normalized == "todo" || normalized == "open" {
        return "todo".to_string();
    }
    "backlog".to_string()
}
