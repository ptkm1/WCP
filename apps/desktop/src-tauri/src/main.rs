#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod domain;
mod dto;
mod git;
mod hooks;
mod integrations;
mod util;

use commands::{
    apply_repository_full_context, apply_repository_identity, attach_task_artifact,
    create_organization, create_project, create_repository, create_work_item,
    create_work_item_dependency, delete_integration_connection, delete_organization,
    delete_project, delete_repository, delete_work_item_dependency,
    duplicate_work_item, end_session, fix_repository_remote_ssh_alias, get_deadline_alerts,
    get_repository_guardrail, get_repository_hook_status, get_repository_memory, get_task_context,
    import_organization_identity_from_repository, inspect_local_repository_path,
    install_repository_pre_push_hook, list_clickup_teams, list_context_history,
    list_integration_connections, list_organizations, list_projects, list_repositories,
    list_ssh_config_hosts, load_dashboard_data, notify_deadline_alerts, pick_local_folder,
    read_organization_logo, remove_organization_logo, remove_repository_pre_push_hook,
    resolve_work_context, save_integration_connection, save_repository_note, save_task_note,
    search_local_history, start_session, sync_organization_pm_tasks_command,
    test_integration_connection, update_organization, update_organization_environment,
    update_organization_logo, update_project, update_repository_context, update_repository_local_path,
    update_work_item,
};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            load_dashboard_data,
            list_organizations,
            create_organization,
            update_organization,
            update_organization_logo,
            remove_organization_logo,
            read_organization_logo,
            update_organization_environment,
            import_organization_identity_from_repository,
            create_project,
            update_project,
            update_repository_context,
            resolve_work_context,
            list_repositories,
            inspect_local_repository_path,
            pick_local_folder,
            create_repository,
            update_repository_local_path,
            get_repository_guardrail,
            get_repository_memory,
            get_task_context,
            create_work_item,
            update_work_item,
            duplicate_work_item,
            list_projects,
            apply_repository_identity,
            apply_repository_full_context,
            fix_repository_remote_ssh_alias,
            install_repository_pre_push_hook,
            get_repository_hook_status,
            remove_repository_pre_push_hook,
            start_session,
            end_session,
            save_task_note,
            attach_task_artifact,
            save_repository_note,
            create_work_item_dependency,
            delete_organization,
            delete_project,
            delete_repository,
            delete_work_item_dependency,
            search_local_history,
            list_context_history,
            list_ssh_config_hosts,
            list_integration_connections,
            save_integration_connection,
            delete_integration_connection,
            test_integration_connection,
            list_clickup_teams,
            sync_organization_pm_tasks_command,
            get_deadline_alerts,
            notify_deadline_alerts
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
