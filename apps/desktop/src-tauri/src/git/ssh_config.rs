use std::fs;
use std::path::PathBuf;

#[derive(Default, Clone)]
pub struct SshHostConfig {
    pub host_name: Option<String>,
    pub identity_file: Option<String>,
}

pub fn lookup_ssh_host(host_alias: &str) -> Option<SshHostConfig> {
    let alias = host_alias.trim();
    if alias.is_empty() {
        return None;
    }

    let home = std::env::var_os("HOME").map(PathBuf::from)?;
    let config_path = home.join(".ssh/config");
    if !config_path.exists() {
        return None;
    }

    let content = fs::read_to_string(&config_path).ok()?;
    parse_ssh_config_for_host(&content, alias)
}

pub fn find_custom_host_aliases_for_hostname(hostname: &str) -> Vec<String> {
    let target = hostname.trim().to_ascii_lowercase();
    if target.is_empty() {
        return Vec::new();
    }

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

    parse_custom_host_aliases_for_hostname(&content, &target)
}

fn parse_custom_host_aliases_for_hostname(content: &str, hostname: &str) -> Vec<String> {
    let mut aliases = Vec::new();
    let mut current_hosts: Vec<String> = Vec::new();
    let mut current_host_name: Option<String> = None;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        if trimmed.to_ascii_lowercase().starts_with("host ") {
            if let Some(resolved) = current_host_name.as_deref() {
                if resolved == hostname {
                    for host in &current_hosts {
                        if host != hostname {
                            aliases.push(host.clone());
                        }
                    }
                }
            }

            current_hosts = trimmed[5..]
                .split_whitespace()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
                .collect();
            current_host_name = None;
            continue;
        }

        if current_hosts.is_empty() {
            continue;
        }

        if let Some((key, value)) = trimmed.split_once(char::is_whitespace) {
            if key.trim().eq_ignore_ascii_case("hostname") {
                let value = value.trim().to_ascii_lowercase();
                if !value.is_empty() {
                    current_host_name = Some(value);
                }
            }
        }
    }

    if let Some(resolved) = current_host_name.as_deref() {
        if resolved == hostname {
            for host in &current_hosts {
                if host != hostname {
                    aliases.push(host.clone());
                }
            }
        }
    }

    aliases.sort();
    aliases.dedup();
    aliases
}

fn parse_ssh_config_for_host(content: &str, host_alias: &str) -> Option<SshHostConfig> {
    let mut active = false;
    let mut result = SshHostConfig::default();

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        if trimmed.to_ascii_lowercase().starts_with("host ") {
            let hosts = trimmed[5..]
                .split_whitespace()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .collect::<Vec<_>>();

            active = hosts.iter().any(|host| *host == host_alias);
            if active {
                result = SshHostConfig::default();
            }
            continue;
        }

        if !active {
            continue;
        }

        if let Some((key, value)) = trimmed.split_once(char::is_whitespace) {
            let key = key.trim().to_ascii_lowercase();
            let value = value.trim();
            match key.as_str() {
                "hostname" if !value.is_empty() => result.host_name = Some(value.to_string()),
                "identityfile" if !value.is_empty() => {
                    result.identity_file = Some(expand_home_path(value));
                }
                _ => {}
            }
        }
    }

    if result.host_name.is_some() || result.identity_file.is_some() {
        Some(result)
    } else {
        None
    }
}

fn expand_home_path(value: &str) -> String {
    if let Some(rest) = value.strip_prefix("~/") {
        if let Some(home) = std::env::var_os("HOME").map(PathBuf::from) {
            return home.join(rest).to_string_lossy().to_string();
        }
    }
    value.to_string()
}
