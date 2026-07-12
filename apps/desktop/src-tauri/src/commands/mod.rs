mod dashboard;
mod dialog;
mod entities;
mod git;
mod history;
mod integrations;
mod organization;
mod repository;
mod ssh;
mod task;

pub use dashboard::load_dashboard_data;
pub use dialog::pick_local_folder;
pub use git::{
    apply_repository_full_context, apply_repository_identity, fix_repository_remote_ssh_alias,
    get_repository_hook_status, install_repository_pre_push_hook, remove_repository_pre_push_hook,
};
pub use entities::{delete_organization, delete_project, delete_repository};
pub use integrations::{
    delete_integration_connection, get_deadline_alerts, list_clickup_teams,
    list_integration_connections, list_pm_external_projects, list_pm_project_mappings_command,
    notify_deadline_alerts, save_integration_connection, save_integration_sync_filter,
    save_pm_project_mapping, sync_organization_pm_tasks_command, test_integration_connection,
};
pub use ssh::list_ssh_config_hosts;
pub use history::{list_context_history, search_local_history};
pub use organization::{
    create_organization, create_project, import_organization_identity_from_repository,
    list_organizations, list_projects, read_organization_logo, remove_organization_logo,
    resolve_work_context, update_organization, update_organization_environment,
    update_organization_logo, update_project, update_repository_context,
};
pub use repository::{
    create_repository, get_repository_guardrail, get_repository_memory,
    inspect_local_repository_path, list_repositories, save_repository_note,
    update_repository_local_path,
};
pub use task::{
    apply_work_item_context, attach_task_artifact, commit_today_plan_command, create_work_item,
    create_work_item_dependency, delete_work_item_dependency, dismiss_work_item_command,
    duplicate_work_item, end_session, get_task_context, restore_dismissed_work_item_command,
    save_task_note, start_session, update_work_item,
};
