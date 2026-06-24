use crate::db::{escape_sql, get_optional_string, get_string, sqlite_json};
use crate::dto::{
    GitSnapshot, IdentityValidationDto, LocalRepositoryInspectionDto, RepositoryGuardrailDto,
    ValidationCheckDto,
};
use std::path::{Path, PathBuf};
use std::process::Command;

pub fn load_guardrail_for_repository(
    db_path: &Path,
    repository_id: &str,
) -> Result<Option<RepositoryGuardrailDto>, String> {
    let rows = sqlite_json(
        db_path,
        &format!(
            "SELECT r.id, r.name, r.local_path, r.provider_host, r.remote_url, \
                r.organization_id, org.name AS organization_name, \
                r.project_id, p.name AS project_name, \
                ep.name AS environment_name, \
                ri.environment_profile_id, \
                ri.git_user_name AS identity_git_user_name, \
                ri.git_user_email AS identity_git_user_email, \
                ep.git_user_name AS profile_git_user_name, \
                ep.git_user_email AS profile_git_user_email, \
                COALESCE(ep.provider_host, r.provider_host) AS effective_provider_host, \
                COALESCE(ri.git_user_name, ep.git_user_name) AS effective_git_user_name, \
                COALESCE(ri.git_user_email, ep.git_user_email) AS effective_git_user_email, \
                COALESCE(ri.ssh_host_alias, ep.ssh_host_alias) AS effective_ssh_host_alias, \
                ep.branch_pattern AS effective_branch_pattern, \
                ri.provider_username, ri.provider_account_label \
         FROM repositories r \
         LEFT JOIN organizations org ON org.id = r.organization_id \
         LEFT JOIN projects p ON p.id = r.project_id \
         LEFT JOIN repository_identities ri ON ri.repository_id = r.id \
         LEFT JOIN environment_profiles ep ON ep.id = ri.environment_profile_id \
         WHERE r.id = '{}' LIMIT 1;",
            escape_sql(repository_id)
        ),
    )?;

    let Some(row) = rows.first() else {
        return Ok(None);
    };

    let repository_id = get_string(row, "id").unwrap_or_default();
    let repository_name = get_string(row, "name").unwrap_or_default();
    let organization_id = get_optional_string(row, "organization_id");
    let organization_name = get_optional_string(row, "organization_name");
    let project_id = get_optional_string(row, "project_id");
    let project_name = get_optional_string(row, "project_name");
    let environment_name = get_optional_string(row, "environment_name");
    let local_path = get_optional_string(row, "local_path");
    let expected_provider_host = get_optional_string(row, "effective_provider_host");
    let remote_url = get_optional_string(row, "remote_url");
    let expected_user_name = get_optional_string(row, "effective_git_user_name");
    let expected_user_email = get_optional_string(row, "effective_git_user_email");
    let expected_ssh_alias = get_optional_string(row, "effective_ssh_host_alias");
    let provider_username = get_optional_string(row, "provider_username");
    let provider_account_label = get_optional_string(row, "provider_account_label");
    let branch_pattern = get_optional_string(row, "effective_branch_pattern");
    let identity_source = resolve_identity_source(
        get_optional_string(row, "environment_profile_id"),
        get_optional_string(row, "identity_git_user_name"),
        get_optional_string(row, "identity_git_user_email"),
        get_optional_string(row, "profile_git_user_name"),
        get_optional_string(row, "profile_git_user_email"),
    );

    let validation = local_path.as_ref().map(|path| {
        if !Path::new(path).exists() {
            return IdentityValidationDto {
                status: "warning".to_string(),
                checks: vec![ValidationCheckDto {
                    key: "localPath".to_string(),
                    status: "mismatch".to_string(),
                    expected: Some(path.clone()),
                    actual: None,
                    message: format!("Pasta local nao encontrada: {path}"),
                }],
            };
        }

        match git_snapshot(path) {
            Ok(snapshot) => build_identity_validation(
                expected_provider_host.clone(),
                expected_user_name.clone(),
                expected_user_email.clone(),
                expected_ssh_alias.clone(),
                branch_pattern.clone(),
                snapshot,
            ),
            Err(error) => IdentityValidationDto {
                status: "warning".to_string(),
                checks: vec![ValidationCheckDto {
                    key: "localPath".to_string(),
                    status: "warning".to_string(),
                    expected: Some(path.clone()),
                    actual: None,
                    message: format!("Nao foi possivel ler o Git local: {error}"),
                }],
            },
        }
    });

    Ok(Some(RepositoryGuardrailDto {
        repository_id: repository_id.clone(),
        repository_name,
        organization_id: organization_id.clone(),
        organization_name,
        project_id: project_id.clone(),
        project_name,
        environment_name,
        identity_source,
        provider_host: expected_provider_host,
        remote_url,
        local_path,
        expected_git_user_name: expected_user_name.clone(),
        expected_git_user_email: expected_user_email.clone(),
        expected_ssh_host_alias: expected_ssh_alias,
        expected_branch_pattern: branch_pattern,
        provider_username,
        provider_account_label,
        validation,
        chain_label: crate::domain::resolve_work_context(
            db_path,
            organization_id,
            project_id,
            Some(repository_id.clone()),
        )
        .ok()
        .and_then(|context| context.chain_label),
    }))
}

fn resolve_identity_source(
    environment_profile_id: Option<String>,
    identity_git_user_name: Option<String>,
    identity_git_user_email: Option<String>,
    profile_git_user_name: Option<String>,
    profile_git_user_email: Option<String>,
) -> Option<String> {
    if environment_profile_id.is_none() {
        return Some("override".to_string());
    }

    if identity_git_user_name != profile_git_user_name
        || identity_git_user_email != profile_git_user_email
    {
        return Some("override".to_string());
    }

    Some("profile".to_string())
}

pub fn inspect_local_repository(local_path: &str) -> Result<LocalRepositoryInspectionDto, String> {
    let trimmed = local_path.trim();
    if trimmed.is_empty() {
        return Err("Informe a pasta local do projeto".to_string());
    }

    let path = PathBuf::from(trimmed);
    let path_exists = path.exists();
    let is_git_repo = path_exists && path.join(".git").exists();

    if !path_exists {
        return Ok(LocalRepositoryInspectionDto {
            local_path: trimmed.to_string(),
            path_exists: false,
            is_git_repo: false,
            suggested_name: path
                .file_name()
                .and_then(|value| value.to_str())
                .map(str::to_string),
            remote_url: None,
            provider_host: None,
            default_branch: None,
            git_user_name: None,
            git_user_email: None,
        });
    }

    if !path.is_dir() {
        return Err("O caminho informado nao e uma pasta".to_string());
    }

    if !is_git_repo {
        return Ok(LocalRepositoryInspectionDto {
            local_path: trimmed.to_string(),
            path_exists: true,
            is_git_repo: false,
            suggested_name: path
                .file_name()
                .and_then(|value| value.to_str())
                .map(str::to_string),
            remote_url: None,
            provider_host: None,
            default_branch: None,
            git_user_name: None,
            git_user_email: None,
        });
    }

    let snapshot = git_snapshot(trimmed)?;
    let remote_url = git_value(trimmed, &["config", "--get", "remote.origin.url"])?;
    let default_branch = git_value(trimmed, &["rev-parse", "--abbrev-ref", "origin/HEAD"])
        .ok()
        .flatten()
        .and_then(|value| value.strip_prefix("origin/").map(str::to_string))
        .or_else(|| {
            git_value(trimmed, &["rev-parse", "--abbrev-ref", "HEAD"])
                .ok()
                .flatten()
        });

    Ok(LocalRepositoryInspectionDto {
        local_path: trimmed.to_string(),
        path_exists: true,
        is_git_repo: true,
        suggested_name: path
            .file_name()
            .and_then(|value| value.to_str())
            .map(str::to_string),
        remote_url: remote_url.clone(),
        provider_host: snapshot.provider_host.clone(),
        default_branch,
        git_user_name: snapshot.git_user_name.clone(),
        git_user_email: snapshot.git_user_email.clone(),
    })
}

pub fn git_snapshot(repository_path: &str) -> Result<GitSnapshot, String> {
    let remote_url = git_value(repository_path, &["config", "--get", "remote.origin.url"])?;
    let provider_host = remote_url
        .as_deref()
        .map(parse_provider_host)
        .transpose()?
        .flatten();

    Ok(GitSnapshot {
        provider_host,
        git_user_name: git_value(
            repository_path,
            &["config", "--local", "--get", "user.name"],
        )?,
        git_user_email: git_value(
            repository_path,
            &["config", "--local", "--get", "user.email"],
        )?,
        ssh_host_alias: remote_url.as_deref().and_then(parse_ssh_host_alias),
        branch_name: git_value(repository_path, &["rev-parse", "--abbrev-ref", "HEAD"])?,
    })
}

pub fn git_value(repository_path: &str, args: &[&str]) -> Result<Option<String>, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(repository_path)
        .output()
        .map_err(|error| format!("Failed to execute git: {error}"))?;

    if output.status.success() {
        let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
        return Ok(if value.is_empty() { None } else { Some(value) });
    }

    Ok(None)
}

pub fn run_git_config(repository_path: &str, key: &str, value: &str) -> Result<(), String> {
    let output = Command::new("git")
        .args(["config", "--local", key, value])
        .current_dir(repository_path)
        .output()
        .map_err(|error| format!("Failed to execute git config: {error}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    Ok(())
}

fn parse_provider_host(remote_url: &str) -> Result<Option<String>, String> {
    if remote_url.starts_with("git@") {
        let trimmed = remote_url.trim_start_matches("git@");
        let host = trimmed.split(':').next().unwrap_or_default().trim();
        return Ok(if host.is_empty() {
            None
        } else {
            Some(host.to_string())
        });
    }

    if remote_url.starts_with("https://") || remote_url.starts_with("http://") {
        let without_protocol = remote_url
            .split("//")
            .nth(1)
            .ok_or_else(|| "Invalid remote URL".to_string())?;
        let host = without_protocol
            .split('/')
            .next()
            .unwrap_or_default()
            .trim();
        return Ok(if host.is_empty() {
            None
        } else {
            Some(host.to_string())
        });
    }

    Ok(Some(remote_url.to_string()))
}

fn parse_ssh_host_alias(remote_url: &str) -> Option<String> {
    if remote_url.starts_with("git@") {
        return remote_url
            .trim_start_matches("git@")
            .split(':')
            .next()
            .map(|value| value.to_string());
    }

    None
}

fn build_identity_validation(
    expected_provider_host: Option<String>,
    expected_user_name: Option<String>,
    expected_user_email: Option<String>,
    expected_ssh_alias: Option<String>,
    branch_pattern: Option<String>,
    snapshot: GitSnapshot,
) -> IdentityValidationDto {
    let checks = vec![
        compare_value(
            "providerHost",
            expected_provider_host,
            snapshot.provider_host,
            "Host do provider",
        ),
        compare_value(
            "gitUserName",
            expected_user_name,
            snapshot.git_user_name,
            "Git user.name",
        ),
        compare_value(
            "gitUserEmail",
            expected_user_email,
            snapshot.git_user_email,
            "Git user.email",
        ),
        compare_value(
            "sshHostAlias",
            expected_ssh_alias,
            snapshot.ssh_host_alias,
            "Alias SSH",
        ),
        compare_branch_pattern(branch_pattern, snapshot.branch_name),
    ];

    let status = if checks.iter().any(|check| check.status == "mismatch") {
        "mismatch"
    } else if checks.iter().any(|check| check.status == "warning") {
        "warning"
    } else {
        "ok"
    };

    IdentityValidationDto {
        status: status.to_string(),
        checks,
    }
}

fn compare_value(
    key: &str,
    expected: Option<String>,
    actual: Option<String>,
    label: &str,
) -> ValidationCheckDto {
    match (&expected, &actual) {
        (None, None) => ValidationCheckDto {
            key: key.to_string(),
            status: "warning".to_string(),
            expected: None,
            actual: None,
            message: format!("{label} nao configurado"),
        },
        (Some(expected_value), Some(actual_value)) if expected_value == actual_value => {
            ValidationCheckDto {
                key: key.to_string(),
                status: "ok".to_string(),
                expected,
                actual,
                message: format!("{label} consistente"),
            }
        }
        _ => ValidationCheckDto {
            key: key.to_string(),
            status: "mismatch".to_string(),
            expected,
            actual,
            message: format!("{label} divergente"),
        },
    }
}

fn compare_branch_pattern(
    pattern: Option<String>,
    branch_name: Option<String>,
) -> ValidationCheckDto {
    match (pattern, branch_name) {
        (Some(pattern_value), Some(branch_value)) => {
            let matches = branch_matches_pattern(&pattern_value, &branch_value);

            ValidationCheckDto {
                key: "branchPattern".to_string(),
                status: if matches { "ok" } else { "warning" }.to_string(),
                expected: Some(pattern_value),
                actual: Some(branch_value),
                message: if matches {
                    "Branch segue o padrao esperado".to_string()
                } else {
                    "Branch fora do padrao esperado".to_string()
                },
            }
        }
        (pattern_value, branch_value) => ValidationCheckDto {
            key: "branchPattern".to_string(),
            status: "warning".to_string(),
            expected: pattern_value,
            actual: branch_value,
            message: "Branch pattern nao pode ser validado".to_string(),
        },
    }
}

fn branch_matches_pattern(pattern: &str, branch: &str) -> bool {
    if let Some(start) = pattern.find('(') {
        if let Some(relative_end) = pattern[start..].find(')') {
            let alternatives = &pattern[start + 1..start + relative_end];
            let prefixes: Vec<&str> = alternatives.split('|').map(str::trim).collect();
            if !prefixes.is_empty() {
                return prefixes
                    .iter()
                    .filter(|prefix| !prefix.is_empty())
                    .any(|prefix| branch.starts_with(&format!("{prefix}/")));
            }
        }
    }

    branch.starts_with("feat/")
        || branch.starts_with("fix/")
        || branch.starts_with("chore/")
}
