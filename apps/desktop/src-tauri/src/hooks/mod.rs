use crate::dto::{RepositoryGuardrailDto, RepositoryHookStatusDto};
use std::fs;
use std::path::PathBuf;
use std::process::Command;

pub fn install_pre_push_hook(
    repository_path: &str,
    guardrail: &RepositoryGuardrailDto,
) -> Result<PathBuf, String> {
    let git_dir = resolve_git_dir(repository_path)?;
    let hooks_dir = git_dir.join("hooks");
    fs::create_dir_all(&hooks_dir)
        .map_err(|error| format!("Failed to create hooks directory: {error}"))?;

    let hook_path = hooks_dir.join("pre-push");
    if hook_path.exists() {
        let existing = fs::read_to_string(&hook_path)
            .map_err(|error| format!("Failed to read existing pre-push hook: {error}"))?;
        if !existing.contains("# work-context-platform pre-push hook") {
            return Err(
                "Ja existe um pre-push nao gerenciado pelo app. Faça merge manual ou remova o hook atual."
                    .to_string(),
            );
        }
    }

    let script = render_pre_push_hook(guardrail);
    fs::write(&hook_path, script)
        .map_err(|error| format!("Failed to write pre-push hook: {error}"))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut permissions = fs::metadata(&hook_path)
            .map_err(|error| format!("Failed to read hook permissions: {error}"))?
            .permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&hook_path, permissions)
            .map_err(|error| format!("Failed to set hook permissions: {error}"))?;
    }

    Ok(hook_path)
}

pub fn read_pre_push_hook_status(
    repository_id: &str,
    repository_path: &str,
) -> Result<RepositoryHookStatusDto, String> {
    let git_dir = resolve_git_dir(repository_path)?;
    let hook_path = git_dir.join("hooks").join("pre-push");

    if !hook_path.exists() {
        return Ok(RepositoryHookStatusDto {
            repository_id: repository_id.to_string(),
            hook_path: Some(hook_path.display().to_string()),
            installed: false,
            managed_by_app: false,
        });
    }

    let contents = fs::read_to_string(&hook_path)
        .map_err(|error| format!("Failed to read pre-push hook: {error}"))?;

    Ok(RepositoryHookStatusDto {
        repository_id: repository_id.to_string(),
        hook_path: Some(hook_path.display().to_string()),
        installed: true,
        managed_by_app: contents.contains("# work-context-platform pre-push hook"),
    })
}

pub fn remove_managed_pre_push_hook(repository_path: &str) -> Result<(), String> {
    let git_dir = resolve_git_dir(repository_path)?;
    let hook_path = git_dir.join("hooks").join("pre-push");

    if !hook_path.exists() {
        return Ok(());
    }

    let contents = fs::read_to_string(&hook_path)
        .map_err(|error| format!("Failed to read pre-push hook: {error}"))?;

    if !contents.contains("# work-context-platform pre-push hook") {
        return Err(
            "O hook pre-push atual nao e gerenciado pelo app. Remocao automatica bloqueada."
                .to_string(),
        );
    }

    fs::remove_file(&hook_path)
        .map_err(|error| format!("Failed to remove pre-push hook: {error}"))?;
    Ok(())
}

fn resolve_git_dir(repository_path: &str) -> Result<PathBuf, String> {
    let output = Command::new("git")
        .args(["rev-parse", "--git-dir"])
        .current_dir(repository_path)
        .output()
        .map_err(|error| format!("Failed to resolve git dir: {error}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let git_dir = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if git_dir.is_empty() {
        return Err("Repositorio Git sem .git resolvido".to_string());
    }

    let git_dir_path = PathBuf::from(&git_dir);
    if git_dir_path.is_absolute() {
        Ok(git_dir_path)
    } else {
        Ok(PathBuf::from(repository_path).join(git_dir_path))
    }
}

fn render_pre_push_hook(guardrail: &RepositoryGuardrailDto) -> String {
    let expected_user_name =
        shell_single_quote(guardrail.expected_git_user_name.as_deref().unwrap_or(""));
    let expected_user_email =
        shell_single_quote(guardrail.expected_git_user_email.as_deref().unwrap_or(""));
    let expected_provider_host =
        shell_single_quote(guardrail.provider_host.as_deref().unwrap_or(""));
    let expected_ssh_alias =
        shell_single_quote(guardrail.expected_ssh_host_alias.as_deref().unwrap_or(""));
    let repository_name = shell_single_quote(&guardrail.repository_name);

    format!(
        r#"#!/bin/sh
# work-context-platform pre-push hook

EXPECTED_USER_NAME='{expected_user_name}'
EXPECTED_USER_EMAIL='{expected_user_email}'
EXPECTED_PROVIDER_HOST='{expected_provider_host}'
EXPECTED_SSH_ALIAS='{expected_ssh_alias}'
REPOSITORY_NAME='{repository_name}'

CURRENT_USER_NAME="$(git config --local --get user.name || true)"
CURRENT_USER_EMAIL="$(git config --local --get user.email || true)"
REMOTE_URL="$(git config --get remote.origin.url || true)"

fail() {{
  printf '%s\n' "Work Context Platform bloqueou o push em $REPOSITORY_NAME."
  printf '%s\n' "$1"
  exit 1
}}

if [ -n "$EXPECTED_USER_NAME" ] && [ "$CURRENT_USER_NAME" != "$EXPECTED_USER_NAME" ]; then
  fail "user.name divergente. esperado=$EXPECTED_USER_NAME atual=$CURRENT_USER_NAME"
fi

if [ -n "$EXPECTED_USER_EMAIL" ] && [ "$CURRENT_USER_EMAIL" != "$EXPECTED_USER_EMAIL" ]; then
  fail "user.email divergente. esperado=$EXPECTED_USER_EMAIL atual=$CURRENT_USER_EMAIL"
fi

if [ -n "$EXPECTED_PROVIDER_HOST" ]; then
  case "$REMOTE_URL" in
    *"$EXPECTED_PROVIDER_HOST"*) ;;
    *)
      fail "remote.origin.url divergente do host esperado. esperado~=$EXPECTED_PROVIDER_HOST atual=$REMOTE_URL"
      ;;
  esac
fi

if [ -n "$EXPECTED_SSH_ALIAS" ]; then
  case "$REMOTE_URL" in
    *"$EXPECTED_SSH_ALIAS"*) ;;
    *)
      fail "alias SSH divergente. esperado~=$EXPECTED_SSH_ALIAS atual=$REMOTE_URL"
      ;;
  esac
fi

exit 0
"#
    )
}

fn shell_single_quote(value: &str) -> String {
    value.replace('\'', "'\"'\"'")
}
