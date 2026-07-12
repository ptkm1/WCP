use super::credentials::parse_jira_credentials;
use super::filter::build_jira_jql;
use super::types::{
    ExternalTaskSnapshot, PmConnectionInfo, PmProviderClient, SyncFilter,
};
use super::types::normalize_pm_status;
use base64::{engine::general_purpose::STANDARD, Engine as _};
use reqwest::blocking::Client;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde::Deserialize;
use serde_json::json;

pub struct JiraClient {
    site_url: String,
    email: String,
    api_token: String,
    client: Client,
}

impl JiraClient {
    pub fn from_credentials(site_url: &str, secret_json: &str) -> Result<Self, String> {
        let creds = parse_jira_credentials(secret_json)?;
        let site_url = normalize_site_url(site_url)?;
        Ok(Self {
            site_url,
            email: creds.email,
            api_token: creds.api_token,
            client: Client::builder()
                .user_agent("wcp-desktop")
                .build()
                .map_err(|error| format!("Falha ao criar cliente HTTP: {error}"))?,
        })
    }

    fn auth_header(&self) -> String {
        let encoded = STANDARD.encode(format!("{}:{}", self.email, self.api_token));
        format!("Basic {encoded}")
    }

    fn api_url(&self, path: &str) -> String {
        format!(
            "{}/rest/api/3{}",
            self.site_url.trim_end_matches('/'),
            path
        )
    }
}

impl PmProviderClient for JiraClient {
    fn provider_id(&self) -> &'static str {
        "jira"
    }

    fn test_connection(&self) -> Result<PmConnectionInfo, String> {
        let response = self
            .client
            .get(self.api_url("/myself"))
            .header(AUTHORIZATION, self.auth_header())
            .header(CONTENT_TYPE, "application/json")
            .send()
            .map_err(|error| format!("Falha ao conectar ao Jira: {error}"))?;

        if !response.status().is_success() {
            return Err(format!(
                "Jira retornou HTTP {}: {}",
                response.status(),
                response.text().unwrap_or_default()
            ));
        }

        let body: JiraMyselfResponse = response
            .json()
            .map_err(|error| format!("Resposta Jira invalida: {error}"))?;

        Ok(PmConnectionInfo {
            provider: "jira".to_string(),
            account_label: body.display_name.unwrap_or_else(|| body.email_address.clone()),
            account_id: body.account_id,
        })
    }

    fn list_assigned_tasks(&self, filter: &SyncFilter) -> Result<Vec<ExternalTaskSnapshot>, String> {
        let jql = build_jira_jql(filter);

        let response = self
            .client
            .post(self.api_url("/search/jql"))
            .header(AUTHORIZATION, self.auth_header())
            .header(CONTENT_TYPE, "application/json")
            .json(&json!({
                "jql": jql,
                "maxResults": 100,
                "fields": ["summary", "description", "status", "duedate", "priority", "project"]
            }))
            .send()
            .map_err(|error| format!("Falha ao buscar issues no Jira: {error}"))?;

        if !response.status().is_success() {
            return Err(format!(
                "Jira search retornou HTTP {}: {}",
                response.status(),
                response.text().unwrap_or_default()
            ));
        }

        let body: JiraSearchResponse = response
            .json()
            .map_err(|error| format!("Resposta de busca Jira invalida: {error}"))?;

        let issues = body.issues.unwrap_or_default();
        Ok(issues
            .into_iter()
            .filter_map(|issue| map_jira_issue(&self.site_url, issue))
            .collect())
    }
}

fn normalize_site_url(site_url: &str) -> Result<String, String> {
    let trimmed = site_url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err("Informe a URL do site Jira.".to_string());
    }
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        Ok(trimmed.to_string())
    } else {
        Ok(format!("https://{trimmed}"))
    }
}

fn map_jira_issue(site_url: &str, issue: JiraIssue) -> Option<ExternalTaskSnapshot> {
    let fields = issue.fields?;
    let status_label = fields.status?.name.unwrap_or_else(|| "Unknown".to_string());
    let key = issue.key?;
    let external_url = Some(format!("{}/browse/{key}", site_url.trim_end_matches('/')));

    Some(ExternalTaskSnapshot {
        external_id: issue.id?,
        external_key: Some(key.clone()),
        external_url,
        external_project_key: fields.project.and_then(|project| project.key),
        title: fields.summary.unwrap_or_else(|| "Sem titulo".to_string()),
        description: fields.description.and_then(flatten_jira_description),
        status: normalize_pm_status("jira", &status_label),
        scheduled_for: fields.duedate,
        priority: map_jira_priority(fields.priority.and_then(|value| value.id)),
    })
}

fn flatten_jira_description(description: JiraDescription) -> Option<String> {
    match description {
        JiraDescription::Text(value) => {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }
        JiraDescription::Object(_) => None,
    }
}

fn map_jira_priority(priority_id: Option<String>) -> i64 {
    match priority_id.as_deref() {
        Some("1") => 1,
        Some("2") => 2,
        Some("3") => 3,
        Some("4") => 4,
        Some("5") => 5,
        _ => 3,
    }
}

#[derive(Debug, Deserialize)]
struct JiraMyselfResponse {
    #[serde(rename = "accountId")]
    account_id: Option<String>,
    #[serde(rename = "displayName")]
    display_name: Option<String>,
    #[serde(rename = "emailAddress")]
    email_address: String,
}

#[derive(Debug, Deserialize)]
struct JiraSearchResponse {
    issues: Option<Vec<JiraIssue>>,
}

#[derive(Debug, Deserialize)]
struct JiraIssue {
    id: Option<String>,
    key: Option<String>,
    fields: Option<JiraIssueFields>,
}

#[derive(Debug, Deserialize)]
struct JiraIssueFields {
    summary: Option<String>,
    description: Option<JiraDescription>,
    status: Option<JiraStatus>,
    duedate: Option<String>,
    priority: Option<JiraPriority>,
    project: Option<JiraProject>,
}

#[derive(Debug, Deserialize)]
struct JiraProject {
    key: Option<String>,
}

#[derive(Debug, Deserialize)]
struct JiraStatus {
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct JiraPriority {
    id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum JiraDescription {
    Text(String),
    Object(serde_json::Value),
}

#[cfg(test)]
mod tests {
    use super::normalize_site_url;

    #[test]
    fn normalize_site_url_adds_https() {
        assert_eq!(
            normalize_site_url("acme.atlassian.net").unwrap(),
            "https://acme.atlassian.net"
        );
    }
}
