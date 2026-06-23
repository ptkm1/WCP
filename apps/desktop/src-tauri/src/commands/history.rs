use crate::db::{
    ensure_db_ready, list_context_history as db_list_context_history, resolve_db_path,
    search_local_history as db_search_local_history,
};
use crate::dto::{ContextEventDto, SearchResultDto};

#[tauri::command]
pub fn search_local_history(query: String) -> Result<Vec<SearchResultDto>, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    db_search_local_history(&db_path, &query)
}

#[tauri::command]
pub fn list_context_history(limit: Option<u32>) -> Result<Vec<ContextEventDto>, String> {
    let db_path = resolve_db_path()?;
    ensure_db_ready(&db_path)?;
    db_list_context_history(&db_path, limit)
}
