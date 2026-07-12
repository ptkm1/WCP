use super::types::SyncFilter;
use serde_json::{json, Value};

pub const DEFAULT_UPDATED_WITHIN_DAYS: u32 = 21;

pub fn default_sync_filter_json() -> String {
    json!({
        "assigneeOnly": true,
        "includeClosed": false,
        "focusCurrentWork": true,
        "updatedWithinDays": DEFAULT_UPDATED_WITHIN_DAYS,
        "jql": null
    })
    .to_string()
}

pub fn parse_sync_filter(raw: Option<&str>) -> SyncFilter {
    let Some(raw) = raw else {
        return SyncFilter::default();
    };

    let Ok(value) = serde_json::from_str::<Value>(raw) else {
        return SyncFilter::default();
    };

    SyncFilter {
        assignee_only: value
            .get("assigneeOnly")
            .and_then(|entry| entry.as_bool())
            .unwrap_or(true),
        include_closed: value
            .get("includeClosed")
            .and_then(|entry| entry.as_bool())
            .unwrap_or(false),
        focus_current_work: value
            .get("focusCurrentWork")
            .and_then(|entry| entry.as_bool())
            .unwrap_or(true),
        updated_within_days: value
            .get("updatedWithinDays")
            .and_then(|entry| entry.as_u64())
            .map(|days| days.clamp(1, 365) as u32)
            .unwrap_or(DEFAULT_UPDATED_WITHIN_DAYS),
        jql: value
            .get("jql")
            .and_then(|entry| entry.as_str())
            .map(str::trim)
            .filter(|entry| !entry.is_empty())
            .map(str::to_string),
    }
}

pub fn build_jira_jql(filter: &SyncFilter) -> String {
    if let Some(jql) = filter.jql.as_ref() {
        return jql.trim().to_string();
    }

    let mut clauses = Vec::new();

    if filter.assignee_only {
        clauses.push("assignee = currentUser()".to_string());
    }

    if !filter.include_closed {
        clauses.push("resolution = Unresolved".to_string());
    }

    if filter.focus_current_work {
        let days = filter.updated_within_days.max(1);
        clauses.push(format!(
            "(sprint in openSprints() OR updated >= -{days}d)"
        ));
    }

    let mut jql = if clauses.is_empty() {
        "updated IS NOT EMPTY".to_string()
    } else {
        clauses.join(" AND ")
    };
    jql.push_str(" ORDER BY updated DESC");
    jql
}

pub fn clickup_updated_after_ms(filter: &SyncFilter) -> Option<i64> {
    if !filter.focus_current_work {
        return None;
    }

    let days = filter.updated_within_days.max(1) as i64;
    let now_ms = chrono::Utc::now().timestamp_millis();
    Some(now_ms - days * 24 * 60 * 60 * 1000)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_jql_focuses_current_work() {
        let filter = SyncFilter::default();
        let jql = build_jira_jql(&filter);
        assert!(jql.contains("assignee = currentUser()"));
        assert!(jql.contains("resolution = Unresolved"));
        assert!(jql.contains("sprint in openSprints()"));
        assert!(jql.contains("updated >= -21d"));
        assert!(jql.contains("ORDER BY updated DESC"));
    }

    #[test]
    fn custom_jql_wins() {
        let filter = SyncFilter {
            jql: Some("project = ABC".to_string()),
            ..SyncFilter::default()
        };
        assert_eq!(build_jira_jql(&filter), "project = ABC");
    }

    #[test]
    fn all_open_mode_skips_focus_clause() {
        let filter = SyncFilter {
            focus_current_work: false,
            ..SyncFilter::default()
        };
        let jql = build_jira_jql(&filter);
        assert!(!jql.contains("openSprints"));
        assert!(!jql.contains("updated >="));
    }
}
