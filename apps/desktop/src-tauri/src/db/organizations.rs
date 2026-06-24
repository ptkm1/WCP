use crate::db::{
    escape_sql, get_i64, get_optional_string, get_string, nullable_sql, resolve_primary_workspace_id,
    sqlite_exec, sqlite_json,
};
use crate::dto::OrganizationListItemDto;
use crate::util::{iso_now, unix_timestamp_millis};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::fs;
use std::path::{Path, PathBuf};

const ORGANIZATION_SELECT: &str = "SELECT o.id, o.name, o.kind, o.is_active, o.logo_path,
                ep.id AS environment_profile_id, ep.name AS environment_name,
                ep.provider_type, ep.provider_host, ep.ssh_host_alias,
                ep.git_user_name, ep.git_user_email, ep.branch_pattern,
                ep.pr_convention, ep.commit_convention, ep.notes_json
         FROM organizations o
         LEFT JOIN environment_profiles ep ON ep.organization_id = o.id
           AND ep.id = (
             SELECT id FROM environment_profiles
             WHERE organization_id = o.id
             ORDER BY is_default DESC, name ASC
             LIMIT 1
           )";

pub fn fetch_organizations(db_path: &Path) -> Result<Vec<OrganizationListItemDto>, String> {
    let rows = sqlite_json(
        db_path,
        &format!(
            "{ORGANIZATION_SELECT}
         WHERE o.is_active = 1
         ORDER BY o.name ASC;"
        ),
    )?;

    Ok(rows.iter().map(map_organization_row).collect())
}

pub fn fetch_organization_by_id(
    db_path: &Path,
    organization_id: &str,
) -> Result<Option<OrganizationListItemDto>, String> {
    let rows = sqlite_json(
        db_path,
        &format!(
            "{ORGANIZATION_SELECT}
         WHERE o.id = '{}'
         LIMIT 1;",
            escape_sql(organization_id)
        ),
    )?;

    Ok(rows.first().map(map_organization_row))
}

pub fn insert_organization(
    db_path: &Path,
    name: &str,
    kind: &str,
) -> Result<OrganizationListItemDto, String> {
    let workspace_id = resolve_primary_workspace_id(db_path)?;
    let organization_id = format!("org-{}", unix_timestamp_millis()?);
    let profile_id = format!("env-{}", unix_timestamp_millis()?);
    let now = iso_now()?;

    sqlite_exec(
        db_path,
        &format!(
            "INSERT INTO organizations (
              id, workspace_id, name, kind, logo_path, is_active, created_at, updated_at
            ) VALUES (
              '{}', '{}', '{}', '{}', NULL, 1, '{}', '{}'
            );",
            escape_sql(&organization_id),
            escape_sql(&workspace_id),
            escape_sql(name),
            escape_sql(kind),
            escape_sql(&now),
            escape_sql(&now)
        ),
    )?;

    sqlite_exec(
        db_path,
        &format!(
            "INSERT INTO environment_profiles (
              id, workspace_id, organization_id, name, is_default, created_at, updated_at
            ) VALUES (
              '{}', '{}', '{}', 'Padrao', 1, '{}', '{}'
            );",
            escape_sql(&profile_id),
            escape_sql(&workspace_id),
            escape_sql(&organization_id),
            escape_sql(&now),
            escape_sql(&now)
        ),
    )?;

    fetch_organization_by_id(db_path, &organization_id)?
        .ok_or_else(|| "Nao foi possivel carregar a empresa criada.".to_string())
}

pub fn update_organization_record(
    db_path: &Path,
    organization_id: &str,
    name: Option<&str>,
    kind: Option<&str>,
    is_active: Option<bool>,
) -> Result<OrganizationListItemDto, String> {
    let existing = fetch_organization_by_id(db_path, organization_id)?
        .ok_or_else(|| "Empresa nao encontrada.".to_string())?;

    let resolved_name = name
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or(existing.name);
    let resolved_kind = kind
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or(existing.kind);
    let resolved_active = is_active.unwrap_or(existing.is_active);
    let now = iso_now()?;

    sqlite_exec(
        db_path,
        &format!(
            "UPDATE organizations
             SET name = '{}',
                 kind = '{}',
                 is_active = {},
                 updated_at = '{}'
             WHERE id = '{}';",
            escape_sql(&resolved_name),
            escape_sql(&resolved_kind),
            if resolved_active { 1 } else { 0 },
            escape_sql(&now),
            escape_sql(organization_id)
        ),
    )?;

    fetch_organization_by_id(db_path, organization_id)?
        .ok_or_else(|| "Nao foi possivel carregar a empresa atualizada.".to_string())
}

pub fn set_organization_logo(
    db_path: &Path,
    organization_id: &str,
    source_path: &str,
) -> Result<OrganizationListItemDto, String> {
    let organization = fetch_organization_by_id(db_path, organization_id)?
        .ok_or_else(|| "Empresa nao encontrada.".to_string())?;

    let source = Path::new(source_path.trim());
    if !source.exists() || !source.is_file() {
        return Err("Arquivo de imagem nao encontrado.".to_string());
    }

    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        .filter(|value| {
            matches!(
                value.as_str(),
                "png" | "jpg" | "jpeg" | "webp" | "gif" | "svg"
            )
        })
        .ok_or_else(|| "Use PNG, JPG, WEBP, GIF ou SVG.".to_string())?;

    let logos_dir = resolve_organization_logos_dir(db_path)?;
    fs::create_dir_all(&logos_dir)
        .map_err(|error| format!("Falha ao preparar pasta de logos: {error}"))?;

    if let Some(existing_logo) = organization.logo_path.as_deref() {
        let existing_path = Path::new(existing_logo);
        if existing_path.exists() {
            let _ = fs::remove_file(existing_path);
        }
    }

    let destination = logos_dir.join(format!("{organization_id}.{extension}"));
    fs::copy(source, &destination)
        .map_err(|error| format!("Falha ao copiar logo: {error}"))?;

    let logo_path = destination.to_string_lossy().to_string();
    let now = iso_now()?;

    sqlite_exec(
        db_path,
        &format!(
            "UPDATE organizations
             SET logo_path = '{}',
                 updated_at = '{}'
             WHERE id = '{}';",
            escape_sql(&logo_path),
            escape_sql(&now),
            escape_sql(organization_id)
        ),
    )?;

    fetch_organization_by_id(db_path, organization_id)?
        .ok_or_else(|| "Nao foi possivel carregar a empresa atualizada.".to_string())
}

pub fn clear_organization_logo(
    db_path: &Path,
    organization_id: &str,
) -> Result<OrganizationListItemDto, String> {
    let organization = fetch_organization_by_id(db_path, organization_id)?
        .ok_or_else(|| "Empresa nao encontrada.".to_string())?;

    if let Some(existing_logo) = organization.logo_path.as_deref() {
        let existing_path = Path::new(existing_logo);
        if existing_path.exists() {
            let _ = fs::remove_file(existing_path);
        }
    }

    let now = iso_now()?;

    sqlite_exec(
        db_path,
        &format!(
            "UPDATE organizations
             SET logo_path = NULL,
                 updated_at = '{}'
             WHERE id = '{}';",
            escape_sql(&now),
            escape_sql(organization_id)
        ),
    )?;

    fetch_organization_by_id(db_path, organization_id)?
        .ok_or_else(|| "Nao foi possivel carregar a empresa atualizada.".to_string())
}

pub fn read_organization_logo_data_url(
    db_path: &Path,
    organization_id: &str,
) -> Result<Option<String>, String> {
    let organization = fetch_organization_by_id(db_path, organization_id)?
        .ok_or_else(|| "Empresa nao encontrada.".to_string())?;

    let Some(logo_path) = organization.logo_path else {
        return Ok(None);
    };

    let path = Path::new(&logo_path);
    if !path.exists() || !path.is_file() {
        return Ok(None);
    }

    let bytes =
        fs::read(path).map_err(|error| format!("Falha ao ler logo da empresa: {error}"))?;
    let mime_type = logo_mime_type(path);
    let encoded = STANDARD.encode(bytes);

    Ok(Some(format!("data:{mime_type};base64,{encoded}")))
}

fn resolve_organization_logos_dir(db_path: &Path) -> Result<PathBuf, String> {
    db_path
        .parent()
        .map(|parent| parent.join("organization-logos"))
        .ok_or_else(|| "Caminho do banco invalido.".to_string())
}

fn logo_mime_type(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("gif") => "image/gif",
        Some("svg") => "image/svg+xml",
        _ => "application/octet-stream",
    }
}

pub fn update_environment_profile_for_org(
    db_path: &Path,
    organization_id: &str,
    provider_type: Option<&str>,
    provider_host: Option<&str>,
    ssh_host_alias: Option<&str>,
    git_user_name: Option<&str>,
    git_user_email: Option<&str>,
    branch_pattern: Option<&str>,
    pr_convention: Option<&str>,
    commit_convention: Option<&str>,
    notes_json: Option<&str>,
) -> Result<OrganizationListItemDto, String> {
    let organization = fetch_organization_by_id(db_path, organization_id)?
        .ok_or_else(|| "Empresa nao encontrada.".to_string())?;

    let workspace_id = resolve_primary_workspace_id(db_path)?;
    let now = iso_now()?;
    let profile_id = organization
        .environment_profile_id
        .clone()
        .unwrap_or_else(|| format!("env-{}", unix_timestamp_millis().unwrap_or(0)));

    if organization.environment_profile_id.is_some() {
        sqlite_exec(
            db_path,
            &format!(
                "UPDATE environment_profiles
                 SET provider_type = {},
                     provider_host = {},
                     ssh_host_alias = {},
                     git_user_name = {},
                     git_user_email = {},
                     branch_pattern = {},
                     pr_convention = {},
                     commit_convention = {},
                     notes_json = {},
                     updated_at = '{}'
                 WHERE id = '{}';",
                nullable_sql(provider_type),
                nullable_sql(provider_host),
                nullable_sql(ssh_host_alias),
                nullable_sql(git_user_name),
                nullable_sql(git_user_email),
                nullable_sql(branch_pattern),
                nullable_sql(pr_convention),
                nullable_sql(commit_convention),
                nullable_sql(notes_json),
                escape_sql(&now),
                escape_sql(&profile_id)
            ),
        )?;
    } else {
        sqlite_exec(
            db_path,
            &format!(
                "INSERT INTO environment_profiles (
                  id, workspace_id, organization_id, name, provider_type, provider_host,
                  ssh_host_alias, git_user_name, git_user_email, branch_pattern,
                  pr_convention, commit_convention, notes_json, is_default, created_at, updated_at
                ) VALUES (
                  '{}', '{}', '{}', 'Padrao', {}, {}, {}, {}, {}, {}, {}, {}, {}, 1, '{}', '{}'
                );",
                escape_sql(&profile_id),
                escape_sql(&workspace_id),
                escape_sql(organization_id),
                nullable_sql(provider_type),
                nullable_sql(provider_host),
                nullable_sql(ssh_host_alias),
                nullable_sql(git_user_name),
                nullable_sql(git_user_email),
                nullable_sql(branch_pattern),
                nullable_sql(pr_convention),
                nullable_sql(commit_convention),
                nullable_sql(notes_json),
                escape_sql(&now),
                escape_sql(&now)
            ),
        )?;
    }

    fetch_organization_by_id(db_path, organization_id)?
        .ok_or_else(|| "Nao foi possivel carregar o perfil atualizado.".to_string())
}

fn map_organization_row(row: &serde_json::Value) -> OrganizationListItemDto {
    OrganizationListItemDto {
        id: get_string(row, "id").unwrap_or_default(),
        name: get_string(row, "name").unwrap_or_default(),
        kind: get_string(row, "kind").unwrap_or_else(|| "company".to_string()),
        is_active: get_i64(row, "is_active").unwrap_or(1) == 1,
        logo_path: get_optional_string(row, "logo_path"),
        environment_profile_id: get_optional_string(row, "environment_profile_id"),
        environment_name: get_optional_string(row, "environment_name"),
        provider_type: get_optional_string(row, "provider_type"),
        provider_host: get_optional_string(row, "provider_host"),
        ssh_host_alias: get_optional_string(row, "ssh_host_alias"),
        git_user_name: get_optional_string(row, "git_user_name"),
        git_user_email: get_optional_string(row, "git_user_email"),
        branch_pattern: get_optional_string(row, "branch_pattern"),
        pr_convention: get_optional_string(row, "pr_convention"),
        commit_convention: get_optional_string(row, "commit_convention"),
        notes_json: get_optional_string(row, "notes_json"),
    }
}
