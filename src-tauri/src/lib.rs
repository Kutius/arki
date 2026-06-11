mod services;

use services::archive::{ArchiveInfo, ArchiveService, ExtractOptions};
use std::path::PathBuf;
use tauri::command;

#[command]
fn list_archive(path: String) -> Result<ArchiveInfo, String> {
    let path = PathBuf::from(path);
    ArchiveService::list_archive(&path)
}

#[command]
fn extract_archive(path: String, destination: String, overwrite: bool) -> Result<(), String> {
    let path = PathBuf::from(path);
    let options = ExtractOptions {
        destination: PathBuf::from(destination),
        overwrite,
        preserve_structure: true,
    };

    ArchiveService::extract_archive(&path, &options, None)
}

#[command]
fn get_archive_info(path: String) -> Result<ArchiveInfo, String> {
    let path = PathBuf::from(path);
    ArchiveService::list_archive(&path)
}

#[command]
fn get_supported_formats() -> Vec<String> {
    vec!["zip".to_string()]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            list_archive,
            extract_archive,
            get_archive_info,
            get_supported_formats
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
