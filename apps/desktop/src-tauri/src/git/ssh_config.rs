use std::fs;
use std::path::PathBuf;

#[derive(Default, Clone, Debug, PartialEq, Eq)]
pub struct SshHostConfig {
    pub host_name: Option<String>,
    pub identity_file: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SshConfigHostEntry {
    pub section_label: Option<String>,
    pub host_alias: String,
    pub host_name: Option<String>,
    pub identity_file: Option<String>,
    pub line_start: u32,
    pub line_end: u32,
}

pub fn list_ssh_config_hosts() -> Vec<SshConfigHostEntry> {
    let home = match std::env::var_os("HOME").map(PathBuf::from) {
        Some(path) => path,
        None => return Vec::new(),
    };
    let config_path = home.join(".ssh/config");
    if !config_path.exists() {
        return Vec::new();
    }

    let content = match fs::read_to_string(&config_path) {
        Ok(content) => content,
        Err(_) => return Vec::new(),
    };

    parse_ssh_config_hosts(&content)
}

pub fn lookup_ssh_host(host_alias: &str) -> Option<SshHostConfig> {
    let alias = host_alias.trim();
    if alias.is_empty() {
        return None;
    }

    parse_ssh_config_hosts(
        &read_ssh_config_content().unwrap_or_default(),
    )
    .into_iter()
    .find(|entry| entry.host_alias == alias)
    .map(|entry| SshHostConfig {
        host_name: entry.host_name.clone(),
        identity_file: entry.identity_file.clone(),
    })
}

pub fn find_custom_host_aliases_for_hostname(hostname: &str) -> Vec<String> {
    let target = hostname.trim().to_ascii_lowercase();
    if target.is_empty() {
        return Vec::new();
    }

    let mut aliases = parse_ssh_config_hosts(&read_ssh_config_content().unwrap_or_default())
        .into_iter()
        .filter_map(|entry| {
            let resolved = entry
                .host_name
                .as_deref()
                .unwrap_or(entry.host_alias.as_str())
                .to_ascii_lowercase();
            if resolved == target && entry.host_alias.to_ascii_lowercase() != target {
                Some(entry.host_alias)
            } else {
                None
            }
        })
        .collect::<Vec<_>>();

    aliases.sort();
    aliases.dedup();
    aliases
}

fn read_ssh_config_content() -> Option<String> {
    let home = std::env::var_os("HOME").map(PathBuf::from)?;
    let config_path = home.join(".ssh/config");
    if !config_path.exists() {
        return None;
    }
    fs::read_to_string(&config_path).ok()
}

pub fn parse_ssh_config_hosts(content: &str) -> Vec<SshConfigHostEntry> {
    let mut entries = Vec::new();
    let mut current_section_label: Option<String> = None;
    let mut block_hosts: Vec<String> = Vec::new();
    let mut block_host_name: Option<String> = None;
    let mut block_identity_file: Option<String> = None;
    let mut block_line_start: u32 = 0;
    let mut block_line_number: u32 = 0;
    let mut in_block = false;

    let flush_block = |entries: &mut Vec<SshConfigHostEntry>,
                       section_label: &Option<String>,
                       block_hosts: &mut Vec<String>,
                       block_host_name: &mut Option<String>,
                       block_identity_file: &mut Option<String>,
                       block_line_start: &mut u32,
                       block_line_number: u32,
                       in_block: &mut bool| {
        if !*in_block || block_hosts.is_empty() {
            *in_block = false;
            block_hosts.clear();
            *block_host_name = None;
            *block_identity_file = None;
            return;
        }

        let resolved_host_name = block_host_name.clone().or_else(|| {
            block_hosts.first().cloned()
        });

        for host_alias in block_hosts.drain(..) {
            if is_wildcard_host_token(&host_alias) {
                continue;
            }

            entries.push(SshConfigHostEntry {
                section_label: section_label.clone(),
                host_alias: host_alias.clone(),
                host_name: resolved_host_name.clone(),
                identity_file: block_identity_file.clone(),
                line_start: *block_line_start,
                line_end: block_line_number,
            });
        }

        *in_block = false;
        *block_host_name = None;
        *block_identity_file = None;
    };

    for line in content.lines() {
        block_line_number += 1;
        let trimmed = line.trim();

        if trimmed.is_empty() {
            continue;
        }

        if trimmed.starts_with('#') {
            flush_block(
                &mut entries,
                &current_section_label,
                &mut block_hosts,
                &mut block_host_name,
                &mut block_identity_file,
                &mut block_line_start,
                block_line_number.saturating_sub(1),
                &mut in_block,
            );

            let label = trimmed.trim_start_matches('#').trim();
            current_section_label = if label.is_empty() {
                None
            } else {
                Some(label.to_string())
            };
            continue;
        }

        if trimmed.to_ascii_lowercase().starts_with("host ") {
            flush_block(
                &mut entries,
                &current_section_label,
                &mut block_hosts,
                &mut block_host_name,
                &mut block_identity_file,
                &mut block_line_start,
                block_line_number.saturating_sub(1),
                &mut in_block,
            );

            block_hosts = trimmed[5..]
                .split_whitespace()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
                .collect();
            block_line_start = block_line_number;
            in_block = !block_hosts.is_empty();
            continue;
        }

        if !in_block {
            continue;
        }

        if let Some((key, value)) = trimmed.split_once(char::is_whitespace) {
            let key = key.trim().to_ascii_lowercase();
            let value = value.trim();
            match key.as_str() {
                "hostname" if !value.is_empty() => {
                    block_host_name = Some(value.to_string());
                }
                "identityfile" if !value.is_empty() => {
                    block_identity_file = Some(expand_home_path(value));
                }
                _ => {}
            }
        }
    }

    flush_block(
        &mut entries,
        &current_section_label,
        &mut block_hosts,
        &mut block_host_name,
        &mut block_identity_file,
        &mut block_line_start,
        block_line_number,
        &mut in_block,
    );

    entries
}

fn is_wildcard_host_token(token: &str) -> bool {
    token.contains('*') || token.contains('?') || token.contains('!')
}

fn expand_home_path(value: &str) -> String {
    if let Some(rest) = value.strip_prefix("~/") {
        if let Some(home) = std::env::var_os("HOME").map(PathBuf::from) {
            return home.join(rest).to_string_lossy().to_string();
        }
    }
    value.to_string()
}

#[cfg(test)]
mod tests {
    use super::parse_ssh_config_hosts;

    const FIXTURE: &str = r#"
# GitHub gok

Host github_gok
HostName github.com
AddKeysToAgent yes
UseKeychain yes
IdentityFile ~/.ssh/github_gok

# GitHub Decathlon

Host github_decathlon
HostName github.com
AddKeysToAgent yes
UseKeychain yes
IdentityFile ~/.ssh/github_decatlhon

Host legacy
HostName gitlab.com
"#;

    #[test]
    fn parse_ssh_config_hosts_groups_by_comment_sections() {
        let entries = parse_ssh_config_hosts(FIXTURE);

        assert_eq!(entries.len(), 3);

        assert_eq!(entries[0].section_label, Some("GitHub gok".to_string()));
        assert_eq!(entries[0].host_alias, "github_gok");
        assert_eq!(entries[0].host_name, Some("github.com".to_string()));
        assert!(entries[0]
            .identity_file
            .as_ref()
            .unwrap()
            .ends_with("github_gok"));
        assert_eq!(entries[0].line_start, 4);
        assert_eq!(entries[0].line_end, 9);

        assert_eq!(
            entries[1].section_label,
            Some("GitHub Decathlon".to_string())
        );
        assert_eq!(entries[1].host_alias, "github_decathlon");
        assert_eq!(entries[1].host_name, Some("github.com".to_string()));
        assert!(entries[1]
            .identity_file
            .as_ref()
            .unwrap()
            .ends_with("github_decatlhon"));
        assert_eq!(entries[1].line_start, 12);
        assert_eq!(entries[1].line_end, 17);

        assert_eq!(entries[2].section_label, Some("GitHub Decathlon".to_string()));
        assert_eq!(entries[2].host_alias, "legacy");
        assert_eq!(entries[2].host_name, Some("gitlab.com".to_string()));
    }

    #[test]
    fn parse_ssh_config_hosts_uses_alias_when_hostname_missing() {
        let content = "Host plain\n  IdentityFile ~/.ssh/plain\n";
        let entries = parse_ssh_config_hosts(content);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].host_alias, "plain");
        assert_eq!(entries[0].host_name, Some("plain".to_string()));
    }

    #[test]
    fn parse_ssh_config_hosts_skips_wildcard_hosts() {
        let content = "Host *\nHostName github.com\n";
        let entries = parse_ssh_config_hosts(content);
        assert!(entries.is_empty());
    }
}
