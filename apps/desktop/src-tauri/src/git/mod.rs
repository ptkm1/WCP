use crate::db::{escape_sql, find_work_item_by_external_key, get_optional_string, get_string, sqlite_exec, sqlite_json};
use crate::dto::{
    ApplyFullContextResultDto, FixRepositoryRemoteResultDto, GitSnapshot, IdentityValidationDto,
    LocalRepositoryInspectionDto, OrganizationIdentityImportDto, RepositoryGuardrailDto,
    ValidationCheckDto,
};
use crate::integrations::extract_ticket_keys_from_branch;
use std::path::{Path, PathBuf};
use std::process::Command;

mod ssh_config;
pub use ssh_config::list_ssh_config_hosts;

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
                ep.pr_convention AS effective_pr_convention, \
                ep.commit_convention AS effective_commit_convention, \
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
    let pr_convention = get_optional_string(row, "effective_pr_convention");
    let commit_convention = get_optional_string(row, "effective_commit_convention");
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
                organization_id.as_deref(),
                expected_provider_host.clone(),
                expected_user_name.clone(),
                expected_user_email.clone(),
                expected_ssh_alias.clone(),
                branch_pattern.clone(),
                pr_convention.clone(),
                commit_convention.clone(),
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
            ssh_host_alias: None,
            suggested_provider_type: None,
            git_user_name_source: None,
            git_user_email_source: None,
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
            ssh_host_alias: None,
            suggested_provider_type: None,
            git_user_name_source: None,
            git_user_email_source: None,
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

    let (git_user_name, git_user_name_source) =
        git_config_layered(trimmed, "user.name");
    let (git_user_email, git_user_email_source) =
        git_config_layered(trimmed, "user.email");
    let ssh_host_alias = remote_url.as_deref().and_then(parse_ssh_host_alias);
    let provider_host = snapshot
        .provider_host
        .clone()
        .or_else(|| ssh_host_alias.clone());
    let suggested_provider_type = provider_host
        .as_deref()
        .map(infer_provider_type);

    Ok(LocalRepositoryInspectionDto {
        local_path: trimmed.to_string(),
        path_exists: true,
        is_git_repo: true,
        suggested_name: path
            .file_name()
            .and_then(|value| value.to_str())
            .map(str::to_string),
        remote_url: remote_url.clone(),
        provider_host,
        default_branch,
        git_user_name,
        git_user_email,
        ssh_host_alias,
        suggested_provider_type,
        git_user_name_source,
        git_user_email_source,
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
        git_user_name: git_config_layered(repository_path, "user.name").0,
        git_user_email: git_config_layered(repository_path, "user.email").0,
        ssh_host_alias: remote_url.as_deref().and_then(parse_ssh_host_alias),
        branch_name: git_value(repository_path, &["rev-parse", "--abbrev-ref", "HEAD"])?,
        last_commit_subject: git_value(repository_path, &["log", "-1", "--format=%s"])?,
    })
}

pub fn suggest_organization_identity_from_repository(
    repository_id: &str,
    repository_name: &str,
    local_path: &str,
) -> Result<OrganizationIdentityImportDto, String> {
    let inspection = inspect_local_repository(local_path)?;

    if !inspection.path_exists {
        return Err(format!(
            "Pasta local nao encontrada: {}",
            inspection.local_path
        ));
    }

    if !inspection.is_git_repo {
        return Err("A pasta local nao parece ser um repositorio Git.".to_string());
    }

    let mut sources = Vec::new();
    let mut provider_host = inspection.provider_host.clone();
    let mut ssh_host_alias = inspection.ssh_host_alias.clone();

    if inspection.remote_url.is_some() {
        sources.push("Remoto origin capturado do Git".to_string());
    }

    if let Some(source) = inspection.git_user_name_source.as_deref() {
        sources.push(format!("user.name lido do Git ({source})"));
    }
    if let Some(source) = inspection.git_user_email_source.as_deref() {
        sources.push(format!("user.email lido do Git ({source})"));
    }

    if let Some(alias) = ssh_host_alias.as_deref() {
        if let Some(ssh_config) = ssh_config::lookup_ssh_host(alias) {
            if let Some(host_name) = ssh_config.host_name {
                if provider_host.as_deref() == Some(alias) || provider_host.is_none() {
                    provider_host = Some(host_name.clone());
                }
                sources.push(format!(
                    "HostName '{}' resolvido via ~/.ssh/config",
                    host_name
                ));
            }
            if ssh_config.identity_file.is_some() {
                sources.push("IdentityFile encontrado no ~/.ssh/config".to_string());
            }
        } else {
            sources.push(format!("Alias SSH inferido do remoto ({alias})"));
        }
    }

    if let (Some(alias), Some(host)) = (
        ssh_host_alias.as_deref(),
        provider_host.as_deref().or(ssh_host_alias.as_deref()),
    ) {
        if alias.eq_ignore_ascii_case(host) {
            let custom_aliases = ssh_config::find_custom_host_aliases_for_hostname(host);
            if custom_aliases.len() == 1 {
                ssh_host_alias = Some(custom_aliases[0].clone());
                sources.push(format!(
                    "Alias SSH '{}' sugerido via ~/.ssh/config",
                    custom_aliases[0]
                ));
            }
        }
    }

    let provider_type = provider_host
        .as_deref()
        .map(infer_provider_type)
        .or(inspection.suggested_provider_type.clone());

    if provider_type.is_some() {
        sources.push("Provider type inferido do host".to_string());
    }

    Ok(OrganizationIdentityImportDto {
        repository_id: repository_id.to_string(),
        repository_name: repository_name.to_string(),
        provider_type,
        provider_host,
        ssh_host_alias,
        git_user_name: inspection.git_user_name,
        git_user_email: inspection.git_user_email,
        remote_url: inspection.remote_url,
        default_branch: inspection.default_branch,
        sources,
    })
}

fn git_config_layered(
    repository_path: &str,
    key: &str,
) -> (Option<String>, Option<String>) {
    if let Ok(Some(value)) = git_value(
        repository_path,
        &["config", "--local", "--get", key],
    ) {
        return (Some(value), Some("local".to_string()));
    }

    if let Ok(Some(value)) = git_global_value(&["config", "--global", "--get", key]) {
        return (Some(value), Some("global".to_string()));
    }

    (None, None)
}

fn git_global_value(args: &[&str]) -> Result<Option<String>, String> {
    let output = Command::new("git")
        .args(args)
        .output()
        .map_err(|error| format!("Failed to execute git: {error}"))?;

    if output.status.success() {
        let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
        return Ok(if value.is_empty() { None } else { Some(value) });
    }

    Ok(None)
}

fn infer_provider_type(host: &str) -> String {
    let normalized = host.trim().to_ascii_lowercase();

    if normalized.contains("github") {
        return "github".to_string();
    }
    if normalized.contains("gitlab") {
        return "gitlab".to_string();
    }
    if normalized.contains("bitbucket") {
        return "bitbucket".to_string();
    }
    if normalized.contains("gitea") {
        return "gitea".to_string();
    }
    if normalized.contains("azure") || normalized.contains("visualstudio") {
        return "azure".to_string();
    }

    "other".to_string()
}

pub fn rewrite_ssh_remote_host(remote_url: &str, new_ssh_alias: &str) -> Option<String> {
    let trimmed_alias = new_ssh_alias.trim();
    if trimmed_alias.is_empty() || !remote_url.starts_with("git@") {
        return None;
    }

    let without_prefix = remote_url.trim().trim_start_matches("git@");
    let (current_host, path) = without_prefix.split_once(':')?;
    if current_host.trim().is_empty() || path.trim().is_empty() {
        return None;
    }

    if current_host.trim() == trimmed_alias {
        return None;
    }

    Some(format!("git@{trimmed_alias}:{path}"))
}

pub fn apply_repository_identity_changes(
    db_path: &Path,
    repository_id: &str,
) -> Result<Vec<String>, String> {
    let guardrail = load_guardrail_for_repository(db_path, repository_id)?
        .ok_or_else(|| "Repositorio nao encontrado".to_string())?;

    let local_path = guardrail
        .local_path
        .clone()
        .ok_or_else(|| "Repositorio sem caminho local configurado".to_string())?;

    let mut applied_changes = Vec::new();

    if let Some(user_name) = guardrail.expected_git_user_name.clone() {
        run_git_config(&local_path, "user.name", &user_name)?;
        applied_changes.push(format!("user.name={user_name}"));
    }

    if let Some(user_email) = guardrail.expected_git_user_email.clone() {
        run_git_config(&local_path, "user.email", &user_email)?;
        applied_changes.push(format!("user.email={user_email}"));
    }

    sqlite_exec(
        db_path,
        &format!(
            "UPDATE repository_identities SET last_validated_at = datetime('now') WHERE repository_id = '{}';",
            escape_sql(repository_id)
        ),
    )?;

    Ok(applied_changes)
}

pub fn apply_repository_full_context(
    db_path: &Path,
    repository_id: &str,
    ssh_host_alias: Option<&str>,
) -> Result<ApplyFullContextResultDto, String> {
    let identity_changes = apply_repository_identity_changes(db_path, repository_id)?;
    let remote_result =
        apply_repository_remote_ssh_alias(db_path, repository_id, ssh_host_alias)?;
    let validation = load_guardrail_for_repository(db_path, repository_id)?
        .and_then(|entry| entry.validation);

    Ok(ApplyFullContextResultDto {
        repository_id: repository_id.to_string(),
        identity_changes,
        remote_changed: remote_result.changed,
        previous_remote_url: remote_result.previous_remote_url,
        updated_remote_url: remote_result.updated_remote_url,
        validation,
    })
}

pub fn apply_repository_remote_ssh_alias(
    db_path: &Path,
    repository_id: &str,
    ssh_host_alias: Option<&str>,
) -> Result<FixRepositoryRemoteResultDto, String> {
    let rows = sqlite_json(
        db_path,
        &format!(
            "SELECT r.local_path, r.remote_url,
                    COALESCE(ri.ssh_host_alias, ep.ssh_host_alias) AS effective_ssh_host_alias
             FROM repositories r
             LEFT JOIN repository_identities ri ON ri.repository_id = r.id
             LEFT JOIN environment_profiles ep ON ep.id = ri.environment_profile_id
             WHERE r.id = '{}'
             LIMIT 1;",
            escape_sql(repository_id)
        ),
    )?;

    let Some(row) = rows.first() else {
        return Err("Repositorio nao encontrado".to_string());
    };

    let local_path = get_optional_string(row, "local_path")
        .ok_or_else(|| "Repositorio sem caminho local configurado".to_string())?;

    if !Path::new(&local_path).exists() {
        return Err(format!("Pasta local nao encontrada: {local_path}"));
    }

    let expected_alias = ssh_host_alias
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .or_else(|| get_optional_string(row, "effective_ssh_host_alias"))
        .ok_or_else(|| "Alias SSH nao configurado no perfil da empresa".to_string())?;

    let current_remote = git_value(
        &local_path,
        &["config", "--get", "remote.origin.url"],
    )?
    .or_else(|| get_optional_string(row, "remote_url"))
    .ok_or_else(|| "Repositorio sem remote.origin.url configurado".to_string())?;

    if !current_remote.starts_with("git@") {
        return Err(
            "Somente remotos SSH (git@host:org/repo.git) podem ser corrigidos automaticamente"
                .to_string(),
        );
    }

    let updated_remote = match rewrite_ssh_remote_host(&current_remote, &expected_alias) {
        Some(url) => url,
        None => {
            return Ok(FixRepositoryRemoteResultDto {
                repository_id: repository_id.to_string(),
                previous_remote_url: Some(current_remote.clone()),
                updated_remote_url: Some(current_remote),
                changed: false,
            });
        }
    };

    run_git_remote_set_url(&local_path, "origin", &updated_remote)?;

    let now = crate::util::iso_now()?;
    sqlite_exec(
        db_path,
        &format!(
            "UPDATE repositories
             SET remote_url = '{}', updated_at = '{}'
             WHERE id = '{}';",
            escape_sql(&updated_remote),
            escape_sql(&now),
            escape_sql(repository_id)
        ),
    )?;

    Ok(FixRepositoryRemoteResultDto {
        repository_id: repository_id.to_string(),
        previous_remote_url: Some(current_remote),
        updated_remote_url: Some(updated_remote),
        changed: true,
    })
}

pub fn run_git_remote_set_url(
    repository_path: &str,
    remote_name: &str,
    url: &str,
) -> Result<(), String> {
    let output = Command::new("git")
        .args(["remote", "set-url", remote_name, url])
        .current_dir(repository_path)
        .output()
        .map_err(|error| format!("Failed to execute git remote: {error}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    Ok(())
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
    organization_id: Option<&str>,
    expected_provider_host: Option<String>,
    expected_user_name: Option<String>,
    expected_user_email: Option<String>,
    expected_ssh_alias: Option<String>,
    branch_pattern: Option<String>,
    pr_convention: Option<String>,
    commit_convention: Option<String>,
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
        compare_branch_pattern(branch_pattern, snapshot.branch_name.clone()),
        compare_ticket_branch_match(organization_id, snapshot.branch_name.clone()),
        compare_pr_convention(
            pr_convention,
            snapshot.branch_name.clone(),
            snapshot.last_commit_subject.clone(),
        ),
        compare_commit_convention(commit_convention, snapshot.last_commit_subject.clone()),
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
    if let Ok(regex) = regex::Regex::new(pattern) {
        if regex.is_match(branch) {
            return true;
        }
    }

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

fn compare_ticket_branch_match(
    organization_id: Option<&str>,
    branch_name: Option<String>,
) -> ValidationCheckDto {
    let Some(organization_id) = organization_id else {
        return ValidationCheckDto {
            key: "ticketBranchMatch".to_string(),
            status: "warning".to_string(),
            expected: None,
            actual: branch_name,
            message: "Ticket da branch nao pode ser validado sem empresa".to_string(),
        };
    };

    let Some(branch_name) = branch_name.filter(|value| !value.trim().is_empty()) else {
        return ValidationCheckDto {
            key: "ticketBranchMatch".to_string(),
            status: "warning".to_string(),
            expected: None,
            actual: None,
            message: "Branch atual indisponivel para validar ticket".to_string(),
        };
    };

    let keys = extract_ticket_keys_from_branch(&branch_name);
    if keys.is_empty() {
        return ValidationCheckDto {
            key: "ticketBranchMatch".to_string(),
            status: "warning".to_string(),
            expected: Some("Ticket Jira na branch".to_string()),
            actual: Some(branch_name),
            message: "Branch sem ticket Jira detectavel".to_string(),
        };
    }

    let db_path = match crate::db::resolve_db_path() {
        Ok(path) => path,
        Err(_) => {
            return ValidationCheckDto {
                key: "ticketBranchMatch".to_string(),
                status: "warning".to_string(),
                expected: Some(keys.join(", ")),
                actual: Some(branch_name),
                message: "Nao foi possivel validar ticket no backlog".to_string(),
            };
        }
    };

    let matched = keys.iter().any(|key| {
        find_work_item_by_external_key(&db_path, organization_id, key)
            .ok()
            .flatten()
            .is_some()
    });

    ValidationCheckDto {
        key: "ticketBranchMatch".to_string(),
        status: if matched { "ok" } else { "warning" }.to_string(),
        expected: Some(keys.join(", ")),
        actual: Some(branch_name),
        message: if matched {
            "Ticket da branch encontrado no backlog importado".to_string()
        } else {
            "Ticket da branch nao encontrado no backlog importado".to_string()
        },
    }
}

fn compare_pr_convention(
    pr_convention: Option<String>,
    branch_name: Option<String>,
    commit_subject: Option<String>,
) -> ValidationCheckDto {
    let Some(convention) = pr_convention.filter(|value| !value.trim().is_empty()) else {
        return ValidationCheckDto {
            key: "prConvention".to_string(),
            status: "warning".to_string(),
            expected: None,
            actual: branch_name,
            message: "Convencao de PR nao configurada".to_string(),
        };
    };

    if !convention.to_lowercase().contains("ticket") {
        return ValidationCheckDto {
            key: "prConvention".to_string(),
            status: "ok".to_string(),
            expected: Some(convention),
            actual: branch_name,
            message: "Convencao de PR registrada".to_string(),
        };
    }

    let branch_keys = branch_name
        .as_deref()
        .map(extract_ticket_keys_from_branch)
        .unwrap_or_default();
    let commit_keys = commit_subject
        .as_deref()
        .map(extract_ticket_keys_from_branch)
        .unwrap_or_default();
    let has_ticket = !branch_keys.is_empty() || !commit_keys.is_empty();

    ValidationCheckDto {
        key: "prConvention".to_string(),
        status: if has_ticket { "ok" } else { "warning" }.to_string(),
        expected: Some(convention),
        actual: branch_name.or(commit_subject),
        message: if has_ticket {
            "Ticket detectado na branch ou no ultimo commit".to_string()
        } else {
            "Convencao pede ticket, mas nenhum foi detectado".to_string()
        },
    }
}

fn compare_commit_convention(
    commit_convention: Option<String>,
    commit_subject: Option<String>,
) -> ValidationCheckDto {
    let Some(convention) = commit_convention.filter(|value| !value.trim().is_empty()) else {
        return ValidationCheckDto {
            key: "commitConvention".to_string(),
            status: "warning".to_string(),
            expected: None,
            actual: commit_subject,
            message: "Convencao de commit nao configurada".to_string(),
        };
    };

    let Some(subject) = commit_subject.filter(|value| !value.trim().is_empty()) else {
        return ValidationCheckDto {
            key: "commitConvention".to_string(),
            status: "warning".to_string(),
            expected: Some(convention),
            actual: None,
            message: "Ultimo commit indisponivel para validar convencao".to_string(),
        };
    };

    let conventional = subject.contains(':')
        && subject
            .split(':')
            .next()
            .is_some_and(|prefix| {
                matches!(
                    prefix.trim(),
                    "feat" | "fix" | "chore" | "docs" | "refactor" | "test" | "build" | "ci"
                )
            });

    ValidationCheckDto {
        key: "commitConvention".to_string(),
        status: if conventional { "ok" } else { "warning" }.to_string(),
        expected: Some(convention),
        actual: Some(subject),
        message: if conventional {
            "Ultimo commit segue conventional commits".to_string()
        } else {
            "Ultimo commit fora do padrao conventional commits".to_string()
        },
    }
}

#[cfg(test)]
mod tests {
    use super::rewrite_ssh_remote_host;

    #[test]
    fn rewrite_ssh_remote_host_replaces_alias() {
        assert_eq!(
            rewrite_ssh_remote_host("git@github.com:ptkm1/WCP.git", "github-ptkm1"),
            Some("git@github-ptkm1:ptkm1/WCP.git".to_string())
        );
    }

    #[test]
    fn rewrite_ssh_remote_host_is_idempotent() {
        assert_eq!(
            rewrite_ssh_remote_host("git@github-ptkm1:ptkm1/WCP.git", "github-ptkm1"),
            None
        );
    }
}
