#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod domain;
mod dto;
mod git;
mod hooks;
mod util;

use commands::{
    apply_repository_identity, attach_task_artifact, create_repository, create_work_item,
    create_work_item_dependency, delete_work_item_dependency, duplicate_work_item, end_session,
    get_repository_guardrail, get_repository_hook_status, get_repository_memory, get_task_context,
    inspect_local_repository_path, install_repository_pre_push_hook, list_context_history,
    list_organizations, list_projects, list_repositories, load_dashboard_data, pick_local_folder,
    remove_repository_pre_push_hook, save_repository_note, save_task_note, search_local_history,
    start_session, update_repository_local_path, update_work_item,
};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            load_dashboard_data,
            list_organizations,
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
            install_repository_pre_push_hook,
            get_repository_hook_status,
            remove_repository_pre_push_hook,
            start_session,
            end_session,
            save_task_note,
            attach_task_artifact,
            save_repository_note,
            create_work_item_dependency,
            delete_work_item_dependency,
            search_local_history,
            list_context_history
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
