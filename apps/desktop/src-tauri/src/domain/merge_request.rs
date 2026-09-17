use serde::Serialize;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ParsedMergeRequest {
    pub provider: String,
    pub host: String,
    pub project_path: String,
    pub repo: String,
    pub number: String,
    pub ref_symbol: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MergeRequestMetadata {
    kind: &'static str,
    provider: String,
    host: String,
    project_path: String,
    repo: String,
    number: String,
    role: Option<String>,
}

pub fn parse_merge_request_url(raw: &str) -> Option<ParsedMergeRequest> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }

    let without_query = trimmed.split(['?', '#']).next().unwrap_or(trimmed);
    let normalized = without_query.trim_end_matches('/');
    let (scheme_host, path) = split_host_and_path(normalized)?;
    let host = scheme_host
        .rsplit("//")
        .next()
        .unwrap_or(scheme_host)
        .trim_start_matches("www.")
        .to_ascii_lowercase();
    let path = path.trim_end_matches('/');

    if let Some((project_path, number)) = match_gitlab_path(path) {
        let repo = last_path_segment(&project_path);
        return Some(ParsedMergeRequest {
            provider: infer_provider(&host, "gitlab"),
            host,
            project_path,
            repo,
            number,
            ref_symbol: "!".to_string(),
        });
    }

    if let Some((org, repo, number)) = match_two_segment_path(path, &["pull", "pulls"]) {
        return Some(ParsedMergeRequest {
            provider: infer_provider(&host, "github"),
            host,
            project_path: format!("{org}/{repo}"),
            repo,
            number,
            ref_symbol: "#".to_string(),
        });
    }

    if let Some((org, repo, number)) =
        match_two_segment_path(path, &["pull-requests", "pullrequest"])
    {
        return Some(ParsedMergeRequest {
            provider: infer_provider(&host, "bitbucket"),
            host,
            project_path: format!("{org}/{repo}"),
            repo,
            number,
            ref_symbol: "#".to_string(),
        });
    }

    if let Some((repo, number)) = match_azure_path(path) {
        return Some(ParsedMergeRequest {
            provider: infer_provider(&host, "azure"),
            host,
            project_path: repo.clone(),
            repo,
            number,
            ref_symbol: "#".to_string(),
        });
    }

    None
}

pub fn is_merge_request_url(raw: &str) -> bool {
    parse_merge_request_url(raw).is_some()
}

pub fn format_merge_request_title(parsed: &ParsedMergeRequest, role: Option<&str>) -> String {
    let base = format!("{} {}{}", parsed.repo, parsed.ref_symbol, parsed.number);
    match format_role_label(role) {
        Some(label) => format!("{label} · {base}"),
        None => base,
    }
}

pub fn merge_request_metadata_json(
    parsed: &ParsedMergeRequest,
    role: Option<&str>,
) -> Result<String, String> {
    serde_json::to_string(&MergeRequestMetadata {
        kind: "merge_request",
        provider: parsed.provider.clone(),
        host: parsed.host.clone(),
        project_path: parsed.project_path.clone(),
        repo: parsed.repo.clone(),
        number: parsed.number.clone(),
        role: format_role_value(role),
    })
    .map_err(|error| format!("Falha ao serializar metadados do MR: {error}"))
}

fn format_role_value(role: Option<&str>) -> Option<String> {
    let trimmed = role.map(str::trim).filter(|value| !value.is_empty())?;
    Some(
        match trimmed.to_ascii_lowercase().as_str() {
            "front" | "frontend" | "mr front" => "front".to_string(),
            "back" | "backend" | "mr back" => "back".to_string(),
            _ => trimmed.to_string(),
        },
    )
}

fn format_role_label(role: Option<&str>) -> Option<String> {
    format_role_value(role).map(|value| match value.as_str() {
        "front" => "Front".to_string(),
        "back" => "Back".to_string(),
        other => other.to_string(),
    })
}

fn split_host_and_path(value: &str) -> Option<(&str, &str)> {
    let without_scheme = value
        .strip_prefix("https://")
        .or_else(|| value.strip_prefix("http://"))?;
    without_scheme.split_once('/')
}

fn match_gitlab_path(path: &str) -> Option<(String, String)> {
    for marker in ["/-/merge_requests/", "/merge_requests/"] {
        if let Some(index) = path.to_ascii_lowercase().find(marker) {
            let project_path = path[..index].trim_start_matches('/');
            let after = &path[index + marker.len()..];
            let number = after
                .split('/')
                .next()
                .filter(|value| !value.is_empty() && value.chars().all(|ch| ch.is_ascii_digit()))?;
            if !project_path.is_empty() {
                return Some((project_path.to_string(), number.to_string()));
            }
        }
    }
    None
}

fn match_two_segment_path(path: &str, markers: &[&str]) -> Option<(String, String, String)> {
    let segments: Vec<&str> = path.split('/').filter(|part| !part.is_empty()).collect();
    if segments.len() < 4 {
        return None;
    }
    let marker = segments[2].to_ascii_lowercase();
    if !markers.iter().any(|value| marker == *value) {
        return None;
    }
    let number = segments[3];
    if !number.chars().all(|ch| ch.is_ascii_digit()) {
        return None;
    }
    Some((
        segments[0].to_string(),
        segments[1].to_string(),
        number.to_string(),
    ))
}

fn match_azure_path(path: &str) -> Option<(String, String)> {
    let lower = path.to_ascii_lowercase();
    let git_index = lower.find("/_git/")?;
    let after_git = &path[git_index + 6..];
    let mut parts = after_git.split('/');
    let repo = parts.next().filter(|value| !value.is_empty())?;
    if parts.next()?.to_ascii_lowercase() != "pullrequest" {
        return None;
    }
    let number = parts
        .next()
        .filter(|value| !value.is_empty() && value.chars().all(|ch| ch.is_ascii_digit()))?;
    Some((repo.to_string(), number.to_string()))
}

fn last_path_segment(path: &str) -> String {
    path.split('/')
        .filter(|part| !part.is_empty())
        .last()
        .unwrap_or(path)
        .to_string()
}

fn infer_provider(host: &str, fallback: &str) -> String {
    if host.contains("github") {
        return "github".to_string();
    }
    if host.contains("gitlab") {
        return "gitlab".to_string();
    }
    if host.contains("bitbucket") {
        return "bitbucket".to_string();
    }
    if host.contains("azure") || host.contains("visualstudio") {
        return "azure".to_string();
    }
    fallback.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_gitlab_merge_request() {
        let parsed = parse_merge_request_url(
            "https://gitlab.com/carenet/harmonia/view/-/merge_requests/322",
        )
        .expect("gitlab url");
        assert_eq!(parsed.provider, "gitlab");
        assert_eq!(parsed.repo, "view");
        assert_eq!(parsed.number, "322");
        assert_eq!(parsed.project_path, "carenet/harmonia/view");
        assert_eq!(
            format_merge_request_title(&parsed, Some("front")),
            "Front · view !322"
        );
    }

    #[test]
    fn parses_github_pull_request() {
        let parsed = parse_merge_request_url("https://github.com/acme/api/pull/88")
            .expect("github url");
        assert_eq!(parsed.provider, "github");
        assert_eq!(parsed.repo, "api");
        assert_eq!(parsed.number, "88");
        assert_eq!(format_merge_request_title(&parsed, None), "api #88");
    }
}
