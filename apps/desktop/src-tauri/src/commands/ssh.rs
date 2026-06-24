use crate::dto::SshConfigHostEntryDto;
use crate::git::list_ssh_config_hosts as load_ssh_config_hosts;

#[tauri::command]
pub fn list_ssh_config_hosts() -> Result<Vec<SshConfigHostEntryDto>, String> {
    Ok(load_ssh_config_hosts()
        .into_iter()
        .map(|entry| SshConfigHostEntryDto {
            section_label: entry.section_label,
            host_alias: entry.host_alias,
            host_name: entry.host_name,
            identity_file: entry.identity_file,
            line_start: entry.line_start,
            line_end: entry.line_end,
        })
        .collect())
}
