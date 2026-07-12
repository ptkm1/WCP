use super::credentials::parse_clickup_credentials;
use super::filter::clickup_updated_after_ms;
use super::types::{
    ClickUpTeamDto, ExternalTaskSnapshot, PmConnectionInfo, PmProviderClient, SyncFilter,
};
use super::types::normalize_pm_status;
use reqwest::blocking::Client;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde::Deserialize;

mod flex {
    use serde::{Deserialize, Deserializer};

    pub fn option_string_or_number<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value: Option<serde_json::Value> = Option::deserialize(deserializer)?;
        Ok(value.and_then(json_value_to_string))
    }

    pub fn json_value_to_string(value: serde_json::Value) -> Option<String> {
        match value {
            serde_json::Value::Null => None,
            serde_json::Value::String(text) if text.is_empty() => None,
            serde_json::Value::String(text) => Some(text),
            serde_json::Value::Number(number) => number.as_i64().map(|id| id.to_string()),
            _ => None,
        }
    }
}

fn decode_json_response<T: for<'de> Deserialize<'de>>(
    label: &str,
    body: &str,
) -> Result<T, String> {
    serde_json::from_str(body).map_err(|error| {
        let preview = if body.len() > 240 {
            format!("{}…", &body[..240])
        } else {
            body.to_string()
        };
        format!("Resposta ClickUp invalida ({label}): {error} · corpo: {preview}")
    })
}

pub struct ClickUpClient {
    api_token: String,
    team_id: Option<String>,
    user_id: Option<String>,
    client: Client,
}

impl ClickUpClient {
    pub fn from_credentials(secret_json: &str, team_id: Option<&str>) -> Result<Self, String> {
        let creds = parse_clickup_credentials(secret_json)?;
        Ok(Self {
            api_token: creds.api_token,
            team_id: team_id.map(str::to_string),
            user_id: None,
            client: Client::builder()
                .user_agent("wcp-desktop")
                .build()
                .map_err(|error| format!("Falha ao criar cliente HTTP: {error}"))?,
        })
    }

    fn auth_header(&self) -> String {
        self.api_token.clone()
    }

    pub fn list_teams(&self) -> Result<Vec<ClickUpTeamDto>, String> {
        let response = self
            .client
            .get("https://api.clickup.com/api/v2/team")
            .header(AUTHORIZATION, self.auth_header())
            .send()
            .map_err(|error| format!("Falha ao listar teams ClickUp: {error}"))?;

        if !response.status().is_success() {
            return Err(format!(
                "ClickUp teams retornou HTTP {}: {}",
                response.status(),
                response.text().unwrap_or_default()
            ));
        }

        let raw = response
            .text()
            .map_err(|error| format!("Falha ao ler resposta ClickUp teams: {error}"))?;
        let body: ClickUpTeamsResponse = decode_json_response("teams", &raw)?;

        Ok(body
            .teams
            .unwrap_or_default()
            .into_iter()
            .filter_map(|team| {
                Some(ClickUpTeamDto {
                    id: team.id?,
                    name: team.name.unwrap_or_else(|| "Team".to_string()),
                })
            })
            .collect())
    }

    fn ensure_user_id(&mut self) -> Result<String, String> {
        if let Some(user_id) = self.user_id.clone() {
            return Ok(user_id);
        }

        let response = self
            .client
            .get("https://api.clickup.com/api/v2/user")
            .header(AUTHORIZATION, self.auth_header())
            .send()
            .map_err(|error| format!("Falha ao validar usuario ClickUp: {error}"))?;

        if !response.status().is_success() {
            return Err(format!(
                "ClickUp user retornou HTTP {}: {}",
                response.status(),
                response.text().unwrap_or_default()
            ));
        }

        let raw = response
            .text()
            .map_err(|error| format!("Falha ao ler resposta ClickUp user: {error}"))?;
        let body: ClickUpUserResponse = decode_json_response("user", &raw)?;

        let user_id = body
            .user
            .and_then(|user| user.id)
            .ok_or_else(|| "ClickUp nao retornou user id.".to_string())?;
        self.user_id = Some(user_id.clone());
        Ok(user_id)
    }
}

impl PmProviderClient for ClickUpClient {
    fn provider_id(&self) -> &'static str {
        "clickup"
    }

    fn test_connection(&self) -> Result<PmConnectionInfo, String> {
        let response = self
            .client
            .get("https://api.clickup.com/api/v2/user")
            .header(AUTHORIZATION, self.auth_header())
            .send()
            .map_err(|error| format!("Falha ao conectar ao ClickUp: {error}"))?;

        if !response.status().is_success() {
            return Err(format!(
                "ClickUp retornou HTTP {}: {}",
                response.status(),
                response.text().unwrap_or_default()
            ));
        }

        let raw = response
            .text()
            .map_err(|error| format!("Falha ao ler resposta ClickUp: {error}"))?;
        let body: ClickUpUserResponse = decode_json_response("user", &raw)?;

        let user = body
            .user
            .ok_or_else(|| "ClickUp nao retornou dados do usuario.".to_string())?;

        Ok(PmConnectionInfo {
            provider: "clickup".to_string(),
            account_label: user.username.unwrap_or_else(|| "ClickUp".to_string()),
            account_id: user.id,
        })
    }

    fn list_assigned_tasks(&self, filter: &SyncFilter) -> Result<Vec<ExternalTaskSnapshot>, String> {
        let mut client = self.clone_for_mutation();
        let team_id = client
            .team_id
            .clone()
            .ok_or_else(|| "Selecione um team ClickUp na configuracao.".to_string())?;
        let user_id = client.ensure_user_id()?;

        let include_closed = if filter.include_closed { "true" } else { "false" };
        let mut url = format!(
            "https://api.clickup.com/api/v2/team/{team_id}/task?assignees[]={user_id}&include_closed={include_closed}"
        );
        if let Some(updated_after_ms) = clickup_updated_after_ms(filter) {
            url.push_str(&format!("&date_updated_gt={updated_after_ms}"));
        }

        let response = client
            .client
            .get(url)
            .header(AUTHORIZATION, client.auth_header())
            .header(CONTENT_TYPE, "application/json")
            .send()
            .map_err(|error| format!("Falha ao buscar tasks ClickUp: {error}"))?;

        if !response.status().is_success() {
            return Err(format!(
                "ClickUp tasks retornou HTTP {}: {}",
                response.status(),
                response.text().unwrap_or_default()
            ));
        }

        let raw = response
            .text()
            .map_err(|error| format!("Falha ao ler resposta ClickUp tasks: {error}"))?;
        let body: ClickUpTasksResponse = decode_json_response("tasks", &raw)?;

        Ok(body
            .tasks
            .unwrap_or_default()
            .into_iter()
            .filter_map(map_clickup_task)
            .collect())
    }
}

impl ClickUpClient {
    fn clone_for_mutation(&self) -> ClickUpClient {
        ClickUpClient {
            api_token: self.api_token.clone(),
            team_id: self.team_id.clone(),
            user_id: self.user_id.clone(),
            client: self.client.clone(),
        }
    }
}

fn map_clickup_task(task: ClickUpTask) -> Option<ExternalTaskSnapshot> {
    let id = task.id?;
    let status_label = task
        .status
        .and_then(|status| status.status.or(status.r#type))
        .unwrap_or_else(|| "Unknown".to_string());

    Some(ExternalTaskSnapshot {
        external_id: id.clone(),
        external_key: Some(id),
        external_url: task.url,
        external_project_key: None,
        title: task.name.unwrap_or_else(|| "Sem titulo".to_string()),
        description: task.description,
        status: normalize_pm_status("clickup", &status_label),
        scheduled_for: clickup_due_date(task.due_date),
        priority: map_clickup_priority(task.priority.and_then(|value| value.priority)),
    })
}

fn clickup_due_date(due_date: Option<String>) -> Option<String> {
    let parsed = due_date?.parse::<i64>().ok()?;
    clickup_due_date_from_millis(parsed)
}

fn clickup_due_date_from_millis(parsed: i64) -> Option<String> {
    if parsed <= 0 {
        return None;
    }
    let date = chrono::DateTime::from_timestamp_millis(parsed)?;
    Some(date.format("%Y-%m-%d").to_string())
}

fn map_clickup_priority(priority: Option<String>) -> i64 {
    match priority.as_deref() {
        Some("urgent") => 1,
        Some("high") => 2,
        Some("normal") => 3,
        Some("low") => 4,
        _ => 3,
    }
}

#[derive(Debug, Deserialize)]
struct ClickUpUserResponse {
    user: Option<ClickUpUser>,
}

#[derive(Debug, Deserialize)]
struct ClickUpUser {
    #[serde(default, deserialize_with = "flex::option_string_or_number")]
    id: Option<String>,
    username: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ClickUpTeamsResponse {
    teams: Option<Vec<ClickUpTeam>>,
}

#[derive(Debug, Deserialize)]
struct ClickUpTeam {
    #[serde(default, deserialize_with = "flex::option_string_or_number")]
    id: Option<String>,
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ClickUpTasksResponse {
    tasks: Option<Vec<ClickUpTask>>,
}

#[derive(Debug, Deserialize)]
struct ClickUpTask {
    #[serde(default, deserialize_with = "flex::option_string_or_number")]
    id: Option<String>,
    name: Option<String>,
    description: Option<String>,
    status: Option<ClickUpStatus>,
    #[serde(default, deserialize_with = "flex::option_string_or_number")]
    due_date: Option<String>,
    priority: Option<ClickUpPriority>,
    url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ClickUpStatus {
    status: Option<String>,
    #[serde(rename = "type")]
    r#type: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ClickUpPriority {
    #[serde(default, deserialize_with = "flex::option_string_or_number")]
    priority: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_clickup_user_with_numeric_id() {
        let json = r#"{"user":{"id":123456,"username":"Test User"}}"#;
        let body: ClickUpUserResponse = serde_json::from_str(json).unwrap();
        let user = body.user.expect("user");
        assert_eq!(user.id.as_deref(), Some("123456"));
        assert_eq!(user.username.as_deref(), Some("Test User"));
    }

    #[test]
    fn parse_clickup_teams_with_numeric_ids() {
        let json = r#"{"teams":[{"id":123,"name":"My Team"}]}"#;
        let body: ClickUpTeamsResponse = serde_json::from_str(json).unwrap();
        let teams = body.teams.expect("teams");
        assert_eq!(teams[0].id.as_deref(), Some("123"));
        assert_eq!(teams[0].name.as_deref(), Some("My Team"));
    }

    #[test]
    fn parse_clickup_task_with_numeric_due_date() {
        let json = r#"{"tasks":[{"id":"abc","name":"Task","due_date":1680000000000}]}"#;
        let body: ClickUpTasksResponse = serde_json::from_str(json).unwrap();
        let task = &body.tasks.expect("tasks")[0];
        assert_eq!(task.due_date.as_deref(), Some("1680000000000"));
        assert!(clickup_due_date(task.due_date.clone()).is_some());
    }
}
