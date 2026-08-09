use crate::dto::SessionGitActivityDto;
use serde::{Deserialize, Serialize};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionLinksPayload {
    v: u32,
    git: SessionGitActivityDto,
}

pub fn encode_session_links_json(activity: &SessionGitActivityDto) -> Result<String, String> {
    serde_json::to_string(&SessionLinksPayload {
        v: 1,
        git: activity.clone(),
    })
    .map_err(|error| format!("Falha ao serializar atividade Git da sessao: {error}"))
}

pub fn parse_session_git_activity(links_json: Option<&str>) -> Option<SessionGitActivityDto> {
    let raw = links_json.map(str::trim).filter(|value| !value.is_empty())?;
    serde_json::from_str::<SessionLinksPayload>(raw)
        .ok()
        .map(|payload| payload.git)
}

pub fn iso_now() -> Result<String, String> {
    let output = Command::new("date")
        .args(["-u", "+%Y-%m-%dT%H:%M:%SZ"])
        .output()
        .map_err(|error| format!("Failed to execute date: {error}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

pub fn unix_timestamp_millis() -> Result<u128, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .map_err(|error| format!("Failed to get system time: {error}"))
}

pub fn compose_handoff_resume_summary(
    stopped_here: Option<&str>,
    next_step: Option<&str>,
) -> Option<String> {
    let stopped = stopped_here.map(str::trim).filter(|value| !value.is_empty());
    let next = next_step.map(str::trim).filter(|value| !value.is_empty());

    match (stopped, next) {
        (Some(stopped), Some(next)) => Some(format!("{stopped} Proximo passo: {next}")),
        (Some(stopped), None) => Some(stopped.to_string()),
        (None, Some(next)) => Some(format!("Proximo passo: {next}")),
        (None, None) => None,
    }
}

pub fn format_session_duration_label(started_at: &str, ended_at: Option<&str>) -> String {
    let Some(start) = parse_iso_to_unix(started_at) else {
        return "duracao indisponivel".to_string();
    };
    let end = ended_at
        .and_then(parse_iso_to_unix)
        .or_else(|| unix_timestamp_millis().ok().map(|ms| (ms / 1000) as i64))
        .unwrap_or(start);
    let seconds = (end - start).max(0);
    let hours = seconds / 3600;
    let minutes = (seconds % 3600) / 60;
    if hours > 0 {
        format!("{hours}h {minutes}min")
    } else if minutes > 0 {
        format!("{minutes}min")
    } else {
        format!("{seconds}s")
    }
}

pub fn is_iso_date_yesterday(iso: &str) -> bool {
    let Some(date) = iso.get(0..10) else {
        return false;
    };
    let output = Command::new("date")
        .args(["-u", "-v-1d", "+%Y-%m-%d"])
        .output()
        .ok();
    let yesterday = output
        .filter(|entry| entry.status.success())
        .map(|entry| String::from_utf8_lossy(&entry.stdout).trim().to_string())
        .unwrap_or_default();
    !yesterday.is_empty() && date == yesterday
}

fn parse_iso_to_unix(value: &str) -> Option<i64> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }
    let output = Command::new("date")
        .args(["-u", "-j", "-f", "%Y-%m-%dT%H:%M:%SZ", trimmed, "+%s"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    String::from_utf8_lossy(&output.stdout)
        .trim()
        .parse::<i64>()
        .ok()
}
