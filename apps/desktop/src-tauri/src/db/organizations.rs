use crate::db::{get_optional_string, get_string, sqlite_json};
use crate::dto::OrganizationListItemDto;
use std::path::Path;

pub fn fetch_organizations(db_path: &Path) -> Result<Vec<OrganizationListItemDto>, String> {
    let rows = sqlite_json(
        db_path,
        "SELECT o.id, o.name, ep.id AS environment_profile_id, ep.name AS environment_name, ep.provider_host,
                ep.ssh_host_alias, ep.git_user_name, ep.git_user_email, ep.branch_pattern
         FROM organizations o
         LEFT JOIN environment_profiles ep ON ep.organization_id = o.id
           AND ep.id = (
             SELECT id FROM environment_profiles
             WHERE organization_id = o.id
             ORDER BY is_default DESC, name ASC
             LIMIT 1
           )
         WHERE o.is_active = 1
         ORDER BY o.name ASC;",
    )?;

    Ok(rows
        .into_iter()
        .map(|row| OrganizationListItemDto {
            id: get_string(&row, "id").unwrap_or_default(),
            name: get_string(&row, "name").unwrap_or_default(),
            environment_profile_id: get_optional_string(&row, "environment_profile_id"),
            environment_name: get_optional_string(&row, "environment_name"),
            provider_host: get_optional_string(&row, "provider_host"),
            ssh_host_alias: get_optional_string(&row, "ssh_host_alias"),
            git_user_name: get_optional_string(&row, "git_user_name"),
            git_user_email: get_optional_string(&row, "git_user_email"),
            branch_pattern: get_optional_string(&row, "branch_pattern"),
        })
        .collect())
}
