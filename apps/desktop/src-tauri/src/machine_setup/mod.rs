//! Bootstrap genérico de ambiente de desenvolvimento (macOS-first).
//! Passos são opcionais e montados pelo usuário via recipe.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MachineSetupRecipeConfigDto {
    pub git_user_name: Option<String>,
    pub git_user_email: Option<String>,
    pub clone_urls: Option<Vec<String>>,
    pub clone_dir: Option<String>,
    pub gh_token: Option<String>,
    pub gitlab_token: Option<String>,
    pub gitlab_host: Option<String>,
    pub ssh_key_comment: Option<String>,
    pub include_secrets_in_script: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MachineSetupRecipeDto {
    pub selected_step_ids: Vec<String>,
    pub config: MachineSetupRecipeConfigDto,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MachineSetupProbeItemDto {
    pub id: String,
    pub label: String,
    pub present: bool,
    pub detail: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MachineSetupProbeResultDto {
    pub items: Vec<MachineSetupProbeItemDto>,
    pub platform: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MachineSetupStepResultDto {
    pub step_id: String,
    pub ok: bool,
    pub skipped: bool,
    pub message: String,
    pub details: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MachineSetupRunResultDto {
    pub results: Vec<MachineSetupStepResultDto>,
    pub ok_count: usize,
    pub fail_count: usize,
    pub skip_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MachineSetupExportResultDto {
    pub script: String,
    pub selected_step_ids: Vec<String>,
    pub includes_secrets: bool,
}

fn trim_opt(value: &Option<String>) -> Option<String> {
    value
        .as_ref()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

fn expand_home(path: &str) -> PathBuf {
    let trimmed = path.trim();
    if trimmed == "~" {
        return dirs_home().unwrap_or_else(|| PathBuf::from("."));
    }
    if let Some(rest) = trimmed.strip_prefix("~/") {
        if let Some(home) = dirs_home() {
            return home.join(rest);
        }
    }
    PathBuf::from(trimmed)
}

fn dirs_home() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}

fn command_exists(bin: &str) -> bool {
    which_bin(bin).is_some()
}

fn which_bin(bin: &str) -> Option<PathBuf> {
    let output = Command::new("which").arg(bin).output().ok()?;
    if !output.status.success() {
        return None;
    }
    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if path.is_empty() {
        None
    } else {
        Some(PathBuf::from(path))
    }
}

fn ensure_brew_in_path() {
    for brew_bin in ["/opt/homebrew/bin", "/usr/local/bin"] {
        let brew_path = Path::new(brew_bin).join("brew");
        if brew_path.is_file() {
            let current = std::env::var_os("PATH").unwrap_or_default();
            let mut entries = vec![std::ffi::OsString::from(brew_bin)];
            for part in std::env::split_paths(&current) {
                entries.push(part.into_os_string());
            }
            if let Ok(joined) = std::env::join_paths(entries) {
                std::env::set_var("PATH", joined);
            }
            break;
        }
    }
}

fn run_capture(program: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new(program)
        .args(args)
        .output()
        .map_err(|error| format!("Falha ao executar {program}: {error}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if !stderr.is_empty() {
            stderr
        } else {
            stdout
        };
        return Err(if detail.is_empty() {
            format!("{program} falhou")
        } else {
            detail
        });
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn first_line(value: &str) -> String {
    value.lines().next().unwrap_or(value).trim().to_string()
}

fn tool_version(bin: &str, args: &[&str]) -> Option<String> {
    run_capture(bin, args).ok().map(|v| first_line(&v))
}

fn probe_item(id: &str, label: &str, present: bool, detail: Option<String>) -> MachineSetupProbeItemDto {
    let status = if present { "ready" } else { "missing" }.to_string();
    MachineSetupProbeItemDto {
        id: id.to_string(),
        label: label.to_string(),
        present,
        detail,
        status,
    }
}

pub fn probe_environment() -> MachineSetupProbeResultDto {
    ensure_brew_in_path();

    let brew_present = command_exists("brew");
    let brew_detail = if brew_present {
        tool_version("brew", &["--version"])
    } else {
        None
    };

    let git_present = command_exists("git");
    let git_detail = if git_present {
        tool_version("git", &["--version"])
    } else {
        None
    };

    let node_present = command_exists("node");
    let node_detail = if node_present {
        let node_v = tool_version("node", &["-v"]).unwrap_or_default();
        let npm_v = tool_version("npm", &["-v"]).unwrap_or_else(|| "?".into());
        let yarn_v = tool_version("yarn", &["-v"]).unwrap_or_else(|| "ausente".into());
        Some(format!("node {node_v} · npm {npm_v} · yarn {yarn_v}"))
    } else {
        None
    };

    let python_present = command_exists("python3");
    let python_detail = if python_present {
        tool_version("python3", &["--version"])
    } else {
        None
    };

    let ssh_pub = find_ssh_public_key();
    let ssh_present = ssh_pub.is_some();
    let ssh_detail = ssh_pub.map(|(path, _)| path.display().to_string());

    let gh_present = command_exists("gh");
    let gh_detail = if gh_present {
        tool_version("gh", &["--version"])
    } else {
        None
    };

    let glab_present = command_exists("glab");
    let glab_detail = if glab_present {
        tool_version("glab", &["version"]).or_else(|| tool_version("glab", &["--version"]))
    } else {
        None
    };

    let platform = std::env::consts::OS.to_string();

    MachineSetupProbeResultDto {
        items: vec![
            probe_item("prereq_homebrew", "Homebrew", brew_present, brew_detail),
            probe_item("prereq_git", "Git", git_present, git_detail),
            probe_item("prereq_node", "Node.js", node_present, node_detail),
            probe_item("prereq_python", "Python 3", python_present, python_detail),
            probe_item("ssh_key", "Chave SSH", ssh_present, ssh_detail),
            probe_item("cli_gh", "GitHub CLI", gh_present, gh_detail),
            probe_item("cli_glab", "GitLab CLI", glab_present, glab_detail),
        ],
        platform,
    }
}

fn find_ssh_public_key() -> Option<(PathBuf, String)> {
    let home = dirs_home()?;
    for name in ["id_ed25519.pub", "id_rsa.pub"] {
        let path = home.join(".ssh").join(name);
        if path.is_file() {
            if let Ok(content) = fs::read_to_string(&path) {
                let trimmed = content.trim().to_string();
                if !trimmed.is_empty() {
                    return Some((path, trimmed));
                }
            }
        }
    }
    None
}

fn require_brew() -> Result<(), String> {
    ensure_brew_in_path();
    if command_exists("brew") {
        Ok(())
    } else {
        Err("Homebrew nao encontrado. Inclua e execute o passo Homebrew primeiro.".into())
    }
}

fn brew_install(formula: &str) -> Result<String, String> {
    require_brew()?;
    run_capture("brew", &["install", formula])
}

fn step_result(
    step_id: &str,
    ok: bool,
    skipped: bool,
    message: impl AsRef<str>,
    details: Vec<String>,
) -> MachineSetupStepResultDto {
    MachineSetupStepResultDto {
        step_id: step_id.to_string(),
        ok,
        skipped,
        message: message.as_ref().to_string(),
        details,
    }
}

fn run_prereq_homebrew() -> MachineSetupStepResultDto {
    ensure_brew_in_path();
    if command_exists("brew") {
        let _ = Command::new("brew").arg("update").status();
        let version = tool_version("brew", &["--version"]).unwrap_or_default();
        return step_result(
            "prereq_homebrew",
            true,
            false,
            format!("Homebrew pronto: {version}"),
            vec![],
        );
    }

    #[cfg(target_os = "macos")]
    {
        let status = Command::new("/bin/bash")
            .arg("-c")
            .arg("NONINTERACTIVE=1 /bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"")
            .status();
        ensure_brew_in_path();
        match status {
            Ok(code) if code.success() && command_exists("brew") => step_result(
                "prereq_homebrew",
                true,
                false,
                "Homebrew instalado com sucesso.",
                vec![],
            ),
            Ok(_) | Err(_) => {
                if command_exists("brew") {
                    step_result(
                        "prereq_homebrew",
                        true,
                        false,
                        "Homebrew disponivel apos instalacao.",
                        vec![],
                    )
                } else {
                    step_result(
                        "prereq_homebrew",
                        false,
                        false,
                        "Nao foi possivel instalar o Homebrew automaticamente. Abra o Terminal e rode o instalador oficial, depois tente de novo.",
                        vec![
                            "https://brew.sh".into(),
                        ],
                    )
                }
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        step_result(
            "prereq_homebrew",
            false,
            false,
            "Instalacao automatica do Homebrew so e suportada no macOS neste MVP.",
            vec![],
        )
    }
}

fn run_prereq_git() -> MachineSetupStepResultDto {
    if command_exists("git") {
        let version = tool_version("git", &["--version"]).unwrap_or_default();
        return step_result("prereq_git", true, false, format!("Git ja presente: {version}"), vec![]);
    }
    match brew_install("git") {
        Ok(_) => {
            let version = tool_version("git", &["--version"]).unwrap_or_default();
            step_result("prereq_git", true, false, format!("Git instalado: {version}"), vec![])
        }
        Err(error) => step_result("prereq_git", false, false, error, vec![]),
    }
}

fn run_prereq_node() -> MachineSetupStepResultDto {
    let mut details = Vec::new();
    if !command_exists("node") {
        if let Err(error) = brew_install("node") {
            return step_result("prereq_node", false, false, error, details);
        }
        details.push("node instalado via brew".into());
    }
    if !command_exists("yarn") {
        match brew_install("yarn") {
            Ok(_) => details.push("yarn instalado via brew".into()),
            Err(error) => details.push(format!("yarn: {error}")),
        }
    }
    let node_v = tool_version("node", &["-v"]).unwrap_or_else(|| "?".into());
    let npm_v = tool_version("npm", &["-v"]).unwrap_or_else(|| "?".into());
    let yarn_v = tool_version("yarn", &["-v"]).unwrap_or_else(|| "ausente".into());
    step_result(
        "prereq_node",
        command_exists("node"),
        false,
        format!("Node {node_v} · npm {npm_v} · yarn {yarn_v}"),
        details,
    )
}

fn run_prereq_python() -> MachineSetupStepResultDto {
    if command_exists("python3") {
        let version = tool_version("python3", &["--version"]).unwrap_or_default();
        return step_result(
            "prereq_python",
            true,
            false,
            format!("Python ja presente: {version}"),
            vec![],
        );
    }
    match brew_install("python@3") {
        Ok(_) => {
            let version = tool_version("python3", &["--version"]).unwrap_or_default();
            step_result(
                "prereq_python",
                true,
                false,
                format!("Python instalado: {version}"),
                vec![],
            )
        }
        Err(error) => step_result("prereq_python", false, false, error, vec![]),
    }
}

fn run_git_identity(config: &MachineSetupRecipeConfigDto) -> MachineSetupStepResultDto {
    if !command_exists("git") {
        return step_result(
            "git_identity",
            false,
            false,
            "Git nao encontrado. Inclua o passo Git nos pre-requisitos.",
            vec![],
        );
    }

    let name = trim_opt(&config.git_user_name);
    let email = trim_opt(&config.git_user_email);
    if name.is_none() && email.is_none() {
        return step_result(
            "git_identity",
            false,
            true,
            "Informe user.name e/ou user.email na configuracao do recipe.",
            vec![],
        );
    }

    let mut details = Vec::new();
    if let Some(name) = &name {
        if let Err(error) = run_capture("git", &["config", "--global", "user.name", name]) {
            return step_result("git_identity", false, false, error, details);
        }
        details.push(format!("user.name = {name}"));
    }
    if let Some(email) = &email {
        if let Err(error) = run_capture("git", &["config", "--global", "user.email", email]) {
            return step_result("git_identity", false, false, error, details);
        }
        details.push(format!("user.email = {email}"));
    }
    let _ = run_capture("git", &["config", "--global", "init.defaultBranch", "main"]);
    step_result(
        "git_identity",
        true,
        false,
        "Identidade Git global aplicada nesta maquina.",
        details,
    )
}

fn run_ssh_key(config: &MachineSetupRecipeConfigDto) -> MachineSetupStepResultDto {
    if let Some((path, pub_key)) = find_ssh_public_key() {
        return step_result(
            "ssh_key",
            true,
            false,
            format!("Chave publica ja existe em {}", path.display()),
            vec![pub_key],
        );
    }

    let home = match dirs_home() {
        Some(h) => h,
        None => {
            return step_result(
                "ssh_key",
                false,
                false,
                "HOME nao definido; nao foi possivel criar ~/.ssh.",
                vec![],
            )
        }
    };

    let ssh_dir = home.join(".ssh");
    if let Err(error) = fs::create_dir_all(&ssh_dir) {
        return step_result(
            "ssh_key",
            false,
            false,
            format!("Falha ao criar ~/.ssh: {error}"),
            vec![],
        );
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&ssh_dir, fs::Permissions::from_mode(0o700));
    }

    let comment = trim_opt(&config.ssh_key_comment)
        .or_else(|| trim_opt(&config.git_user_email))
        .unwrap_or_else(|| "wcp-machine-setup".into());
    let key_path = ssh_dir.join("id_ed25519");

    let status = Command::new("ssh-keygen")
        .args([
            "-t",
            "ed25519",
            "-C",
            &comment,
            "-f",
            key_path.to_str().unwrap_or(""),
            "-N",
            "",
        ])
        .status();

    match status {
        Ok(code) if code.success() => {
            let pub_path = ssh_dir.join("id_ed25519.pub");
            let pub_key = fs::read_to_string(&pub_path)
                .map(|v| v.trim().to_string())
                .unwrap_or_default();
            let _ = Command::new("ssh-add").arg(&key_path).status();
            step_result(
                "ssh_key",
                true,
                false,
                "Chave ed25519 gerada. Adicione a chave publica no GitHub/GitLab.",
                vec![pub_key],
            )
        }
        Ok(_) => step_result(
            "ssh_key",
            false,
            false,
            "ssh-keygen falhou ao gerar a chave.",
            vec![],
        ),
        Err(error) => step_result(
            "ssh_key",
            false,
            false,
            format!("Falha ao executar ssh-keygen: {error}"),
            vec![],
        ),
    }
}

fn run_clone_repos(config: &MachineSetupRecipeConfigDto) -> MachineSetupStepResultDto {
    if !command_exists("git") {
        return step_result(
            "clone_repos",
            false,
            false,
            "Git nao encontrado. Inclua o passo Git nos pre-requisitos.",
            vec![],
        );
    }

    let urls: Vec<String> = config
        .clone_urls
        .clone()
        .unwrap_or_default()
        .into_iter()
        .map(|u| u.trim().to_string())
        .filter(|u| !u.is_empty() && !u.starts_with('#'))
        .collect();

    if urls.is_empty() {
        return step_result(
            "clone_repos",
            false,
            true,
            "Nenhuma URL de repositorio informada.",
            vec![],
        );
    }

    let dir_raw = trim_opt(&config.clone_dir).unwrap_or_else(|| "~/Projects".into());
    let dir = expand_home(&dir_raw);
    if let Err(error) = fs::create_dir_all(&dir) {
        return step_result(
            "clone_repos",
            false,
            false,
            format!("Falha ao criar diretorio {}: {error}", dir.display()),
            vec![],
        );
    }

    let mut details = Vec::new();
    let mut ok = true;
    for url in urls {
        let name = url
            .trim_end_matches('/')
            .trim_end_matches(".git")
            .rsplit('/')
            .next()
            .unwrap_or("repo")
            .to_string();
        let target = dir.join(&name);
        if target.join(".git").is_dir() {
            details.push(format!("ja existe: {}", target.display()));
            continue;
        }
        match run_capture(
            "git",
            &[
                "clone",
                &url,
                target.to_str().unwrap_or(name.as_str()),
            ],
        ) {
            Ok(_) => details.push(format!("clonado: {} -> {}", url, target.display())),
            Err(error) => {
                ok = false;
                details.push(format!("erro em {url}: {error}"));
            }
        }
    }

    step_result(
        "clone_repos",
        ok,
        false,
        if ok {
            "Clone concluido."
        } else {
            "Clone concluido com erros."
        },
        details,
    )
}

fn run_cli_gh(config: &MachineSetupRecipeConfigDto) -> MachineSetupStepResultDto {
    let mut details = Vec::new();
    if !command_exists("gh") {
        if let Err(error) = brew_install("gh") {
            return step_result("cli_gh", false, false, error, details);
        }
        details.push("gh instalado via brew".into());
    }

    let version = tool_version("gh", &["--version"]).unwrap_or_default();
    if let Some(token) = trim_opt(&config.gh_token) {
        let mut child = match Command::new("gh")
            .args(["auth", "login", "--with-token"])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
        {
            Ok(child) => child,
            Err(error) => {
                return step_result(
                    "cli_gh",
                    false,
                    false,
                    format!("Falha ao autenticar gh: {error}"),
                    details,
                )
            }
        };
        if let Some(stdin) = child.stdin.as_mut() {
            use std::io::Write;
            let _ = writeln!(stdin, "{token}");
        }
        match child.wait_with_output() {
            Ok(output) if output.status.success() => {
                details.push("autenticado com token".into());
            }
            Ok(output) => {
                let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
                details.push(if err.is_empty() {
                    "token informado mas login falhou".into()
                } else {
                    err
                });
            }
            Err(error) => details.push(format!("login falhou: {error}")),
        }
    } else {
        details.push("sem token — rode `gh auth login` depois se precisar".into());
    }

    step_result(
        "cli_gh",
        command_exists("gh"),
        false,
        format!("GitHub CLI: {version}"),
        details,
    )
}

fn run_cli_glab(config: &MachineSetupRecipeConfigDto) -> MachineSetupStepResultDto {
    let mut details = Vec::new();
    if !command_exists("glab") {
        if let Err(error) = brew_install("glab") {
            return step_result("cli_glab", false, false, error, details);
        }
        details.push("glab instalado via brew".into());
    }

    let version = tool_version("glab", &["version"])
        .or_else(|| tool_version("glab", &["--version"]))
        .unwrap_or_default();

    if let Some(token) = trim_opt(&config.gitlab_token) {
        let host = trim_opt(&config.gitlab_host).unwrap_or_else(|| "gitlab.com".into());
        match run_capture(
            "glab",
            &["auth", "login", "--hostname", &host, "--token", &token],
        ) {
            Ok(_) => details.push(format!("autenticado em {host}")),
            Err(error) => details.push(format!("login falhou: {error}")),
        }
    } else {
        details.push("sem token — rode `glab auth login` depois se precisar".into());
    }

    step_result(
        "cli_glab",
        command_exists("glab"),
        false,
        format!("GitLab CLI: {version}"),
        details,
    )
}

pub fn run_recipe(recipe: &MachineSetupRecipeDto) -> MachineSetupRunResultDto {
    let selected: Vec<&str> = recipe
        .selected_step_ids
        .iter()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect();

    let mut results = Vec::new();
    for step_id in &selected {
        let result = match *step_id {
            "prereq_homebrew" => run_prereq_homebrew(),
            "prereq_git" => run_prereq_git(),
            "prereq_node" => run_prereq_node(),
            "prereq_python" => run_prereq_python(),
            "git_identity" => run_git_identity(&recipe.config),
            "ssh_key" => run_ssh_key(&recipe.config),
            "clone_repos" => run_clone_repos(&recipe.config),
            "cli_gh" => run_cli_gh(&recipe.config),
            "cli_glab" => run_cli_glab(&recipe.config),
            other => step_result(
                other,
                false,
                true,
                format!("Passo desconhecido: {other}"),
                vec![],
            ),
        };
        results.push(result);
    }

    let ok_count = results.iter().filter(|r| r.ok && !r.skipped).count();
    let fail_count = results.iter().filter(|r| !r.ok && !r.skipped).count();
    let skip_count = results.iter().filter(|r| r.skipped).count();

    MachineSetupRunResultDto {
        results,
        ok_count,
        fail_count,
        skip_count,
    }
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}

pub fn export_script(recipe: &MachineSetupRecipeDto) -> MachineSetupExportResultDto {
    let include_secrets = recipe.config.include_secrets_in_script.unwrap_or(false);
    let selected = recipe
        .selected_step_ids
        .iter()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>();

    let mut lines: Vec<String> = vec![
        "#!/usr/bin/env bash".into(),
        "# Gerado pelo WCP Machine Setup — recipe personalizado".into(),
        "# Todos os passos abaixo refletem apenas o que voce marcou no app.".into(),
        "set -uo pipefail".into(),
        "".into(),
        "info() { echo \"[ok] $*\"; }".into(),
        "warn() { echo \"[!] $*\" >&2; }".into(),
        "err()  { echo \"[x] $*\" >&2; }".into(),
        "command_exists() { command -v \"$1\" &>/dev/null; }".into(),
        "ensure_brew_in_path() {".into(),
        "  if [[ -x /opt/homebrew/bin/brew ]]; then eval \"$(/opt/homebrew/bin/brew shellenv)\"; fi".into(),
        "  if [[ -x /usr/local/bin/brew ]]; then eval \"$(/usr/local/bin/brew shellenv)\"; fi".into(),
        "}".into(),
        "".into(),
    ];

    let name = trim_opt(&recipe.config.git_user_name);
    let email = trim_opt(&recipe.config.git_user_email);
    let clone_dir = trim_opt(&recipe.config.clone_dir).unwrap_or_else(|| "$HOME/Projects".into());
    let clone_dir_export = if clone_dir.starts_with('~') {
        clone_dir.replacen('~', "$HOME", 1)
    } else {
        clone_dir
    };
    let gitlab_host = trim_opt(&recipe.config.gitlab_host).unwrap_or_else(|| "gitlab.com".into());
    let ssh_comment = trim_opt(&recipe.config.ssh_key_comment)
        .or_else(|| email.clone())
        .unwrap_or_else(|| "wcp-machine-setup".into());

    lines.push("# --- Configuracao do recipe ---".into());
    if let Some(name) = &name {
        lines.push(format!("GIT_USER_NAME={}", shell_quote(name)));
    } else {
        lines.push("GIT_USER_NAME=\"\"".into());
    }
    if let Some(email) = &email {
        lines.push(format!("GIT_USER_EMAIL={}", shell_quote(email)));
    } else {
        lines.push("GIT_USER_EMAIL=\"\"".into());
    }
    lines.push(format!("GIT_REPOS_DIR={}", shell_quote(&clone_dir_export)));
    lines.push(format!("GITLAB_HOST={}", shell_quote(&gitlab_host)));
    lines.push(format!("SSH_KEY_COMMENT={}", shell_quote(&ssh_comment)));

    if include_secrets {
        if let Some(token) = trim_opt(&recipe.config.gh_token) {
            lines.push(format!("GH_TOKEN={}", shell_quote(&token)));
        } else {
            lines.push("GH_TOKEN=\"\"".into());
        }
        if let Some(token) = trim_opt(&recipe.config.gitlab_token) {
            lines.push(format!("GITLAB_TOKEN={}", shell_quote(&token)));
        } else {
            lines.push("GITLAB_TOKEN=\"\"".into());
        }
    } else {
        lines.push("# Tokens omitidos (recomendado). Preencha localmente se precisar:".into());
        lines.push("# GH_TOKEN=\"\"".into());
        lines.push("# GITLAB_TOKEN=\"\"".into());
    }

    let urls = recipe
        .config
        .clone_urls
        .clone()
        .unwrap_or_default()
        .into_iter()
        .map(|u| u.trim().to_string())
        .filter(|u| !u.is_empty() && !u.starts_with('#'))
        .collect::<Vec<_>>();
    if !urls.is_empty() {
        lines.push("GIT_CLONE_URLS=$(cat <<'WCP_REPOS'".into());
        for url in &urls {
            lines.push(url.clone());
        }
        lines.push("WCP_REPOS".into());
        lines.push(")".into());
    } else {
        lines.push("GIT_CLONE_URLS=\"\"".into());
    }

    lines.push("".into());
    lines.push("ensure_brew_in_path".into());
    lines.push("".into());

    for step in &selected {
        lines.push(format!("# --- {step} ---"));
        match step.as_str() {
            "prereq_homebrew" => {
                lines.push("if ! command_exists brew; then".into());
                lines.push("  NONINTERACTIVE=1 /bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"".into());
                lines.push("  ensure_brew_in_path".into());
                lines.push("fi".into());
                lines.push("command_exists brew && brew update || warn \"Homebrew indisponivel\"".into());
            }
            "prereq_git" => {
                lines.push("command_exists git || brew install git".into());
                lines.push("info \"Git: $(git --version)\"".into());
            }
            "prereq_node" => {
                lines.push("command_exists node || brew install node".into());
                lines.push("command_exists yarn || brew install yarn".into());
                lines.push("info \"Node $(node -v) · npm $(npm -v) · yarn $(yarn -v 2>/dev/null || echo ausente)\"".into());
            }
            "prereq_python" => {
                lines.push("command_exists python3 || brew install python@3".into());
                lines.push("info \"$(python3 --version)\"".into());
            }
            "git_identity" => {
                lines.push("if [[ -n \"${GIT_USER_NAME:-}\" ]]; then git config --global user.name \"$GIT_USER_NAME\"; fi".into());
                lines.push("if [[ -n \"${GIT_USER_EMAIL:-}\" ]]; then git config --global user.email \"$GIT_USER_EMAIL\"; fi".into());
                lines.push("git config --global init.defaultBranch main 2>/dev/null || true".into());
                lines.push("info \"Identidade Git global configurada\"".into());
            }
            "ssh_key" => {
                lines.push("mkdir -p \"$HOME/.ssh\" && chmod 700 \"$HOME/.ssh\"".into());
                lines.push("if [[ ! -f \"$HOME/.ssh/id_ed25519.pub\" && ! -f \"$HOME/.ssh/id_rsa.pub\" ]]; then".into());
                lines.push("  ssh-keygen -t ed25519 -C \"${SSH_KEY_COMMENT}\" -f \"$HOME/.ssh/id_ed25519\" -N \"\"".into());
                lines.push("  eval \"$(ssh-agent -s)\" >/dev/null".into());
                lines.push("  ssh-add \"$HOME/.ssh/id_ed25519\" 2>/dev/null || true".into());
                lines.push("fi".into());
                lines.push("info \"Chave publica:\"".into());
                lines.push("cat \"$HOME/.ssh/id_ed25519.pub\" 2>/dev/null || cat \"$HOME/.ssh/id_rsa.pub\" 2>/dev/null || warn \"Nenhuma chave publica\"".into());
            }
            "clone_repos" => {
                lines.push("mkdir -p \"$GIT_REPOS_DIR\"".into());
                lines.push("while IFS= read -r url; do".into());
                lines.push("  [[ -z \"$url\" || \"$url\" =~ ^# ]] && continue".into());
                lines.push("  name=\"$(basename \"$url\" .git)\"".into());
                lines.push("  if [[ -d \"$GIT_REPOS_DIR/$name/.git\" ]]; then info \"Ja existe: $GIT_REPOS_DIR/$name\"; continue; fi".into());
                lines.push("  git clone \"$url\" \"$GIT_REPOS_DIR/$name\"".into());
                lines.push("done <<< \"$GIT_CLONE_URLS\"".into());
            }
            "cli_gh" => {
                lines.push("command_exists gh || brew install gh".into());
                lines.push("if [[ -n \"${GH_TOKEN:-}\" ]]; then printf '%s\\n' \"$GH_TOKEN\" | gh auth login --with-token || warn \"gh auth falhou\"; else warn \"GH_TOKEN vazio\"; fi".into());
            }
            "cli_glab" => {
                lines.push("command_exists glab || brew install glab".into());
                lines.push("if [[ -n \"${GITLAB_TOKEN:-}\" ]]; then glab auth login --hostname \"$GITLAB_HOST\" --token \"$GITLAB_TOKEN\" || warn \"glab auth falhou\"; else warn \"GITLAB_TOKEN vazio\"; fi".into());
            }
            other => {
                lines.push(format!("warn \"Passo nao suportado no export: {other}\""));
            }
        }
        lines.push("".into());
    }

    lines.push("info \"Machine setup WCP concluido.\"".into());

    MachineSetupExportResultDto {
        script: lines.join("\n") + "\n",
        selected_step_ids: selected,
        includes_secrets: include_secrets,
    }
}
