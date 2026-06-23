mod dashboard;
mod dialog;
mod git;
mod history;
mod organization;
mod repository;
mod task;

pub use dashboard::load_dashboard_data;
pub use dialog::pick_local_folder;
pub use git::{
    apply_repository_identity, get_repository_hook_status, install_repository_pre_push_hook,
    remove_repository_pre_push_hook,
};
pub use history::{list_context_history, search_local_history};
pub use organization::{list_organizations, list_projects};
pub use repository::{
    create_repository, get_repository_guardrail, get_repository_memory,
    inspect_local_repository_path, list_repositories, save_repository_note,
    update_repository_local_path,
};
pub use task::{
    attach_task_artifact, create_work_item, create_work_item_dependency,
    delete_work_item_dependency, duplicate_work_item, end_session, get_task_context,
    save_task_note, start_session, update_work_item,
};
