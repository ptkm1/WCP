use std::sync::mpsc;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn pick_local_folder(
    app: AppHandle,
    default_path: Option<String>,
) -> Result<Option<String>, String> {
    let (tx, rx) = mpsc::sync_channel(1);

    let mut builder = app
        .dialog()
        .file()
        .set_title("Selecione a pasta do projeto Git");

    if let Some(path) = default_path {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            builder = builder.set_directory(trimmed);
        }
    }

    if let Some(window) = app.get_webview_window("main") {
        builder = builder.set_parent(&window);
    }

    builder.pick_folder(move |folder| {
        let _ = tx.send(folder);
    });

    rx.recv()
        .map_err(|_| "Falha ao aguardar o seletor de pastas.".to_string())
        .map(|folder| folder.map(|file_path| file_path.simplified().to_string()))
}
