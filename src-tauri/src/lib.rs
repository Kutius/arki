pub mod services;

use base64::{Engine as _, engine::general_purpose};
use services::archive::{ArchiveInfo, ArchiveService, CreateOptions, CreateProgress, ExtractOptions, ExtractProgress};
use services::history::{HistoryEntry, HistoryService};
use services::settings::{Settings, SettingsService};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{command, Emitter, Manager, Window};

/// Global cancellation flag for archive operations.
/// Set to `true` to request cancellation of the current operation.
static CANCEL_FLAG: AtomicBool = AtomicBool::new(false);

/// Holds a file path that was passed via CLI before the frontend was ready.
/// The frontend polls this via `get_pending_open` on mount.
struct PendingOpen(Mutex<Option<String>>);

#[command]
fn list_archive(path: String) -> Result<ArchiveInfo, String> {
    let path = PathBuf::from(path);
    ArchiveService::list_archive(&path)
}

/// Cancel the currently running archive operation.
#[command]
fn cancel_operation() {
    CANCEL_FLAG.store(true, Ordering::Relaxed);
}

/// Consume the pending file path from CLI args (called by frontend on mount).
/// Returns the path if one was set, or None.
#[command]
fn get_pending_open(app: tauri::AppHandle) -> Option<String> {
    let state = app.state::<PendingOpen>();
    let mut lock = state.0.lock().unwrap();
    lock.take()
}

#[command]
fn extract_archive(
    path: String,
    destination: String,
    overwrite: bool,
    window: Window,
) -> Result<(), String> {
    // Reset cancellation flag
    CANCEL_FLAG.store(false, Ordering::Relaxed);

    let path = PathBuf::from(path);
    let options = ExtractOptions {
        destination: PathBuf::from(destination),
        overwrite,
        preserve_structure: true,
    };

    let window_clone = window.clone();
    let cancel_flag = Arc::new(AtomicBool::new(false));
    // Link to global flag by checking it in the callback
    let cancel_flag_clone = cancel_flag.clone();
    let callback = Box::new(move |progress: ExtractProgress| {
        let _ = window_clone.emit("extract-progress", &progress);
        // Check global cancellation flag
        if CANCEL_FLAG.load(Ordering::Relaxed) {
            cancel_flag_clone.store(true, Ordering::Relaxed);
        }
    });

    ArchiveService::extract_archive(&path, &options, Some(callback), Some(cancel_flag))
}

#[command]
fn extract_archive_with_password(
    path: String,
    destination: String,
    overwrite: bool,
    password: String,
    window: Window,
) -> Result<(), String> {
    // Reset cancellation flag
    CANCEL_FLAG.store(false, Ordering::Relaxed);

    let path = PathBuf::from(path);
    let options = ExtractOptions {
        destination: PathBuf::from(destination),
        overwrite,
        preserve_structure: true,
    };

    let window_clone = window.clone();
    let cancel_flag = Arc::new(AtomicBool::new(false));
    let cancel_flag_clone = cancel_flag.clone();
    let callback = Box::new(move |progress: ExtractProgress| {
        let _ = window_clone.emit("extract-progress", &progress);
        if CANCEL_FLAG.load(Ordering::Relaxed) {
            cancel_flag_clone.store(true, Ordering::Relaxed);
        }
    });

    ArchiveService::extract_archive_with_password_with_progress(
        &path,
        &options,
        &password,
        Some(callback),
        Some(cancel_flag),
    )
}

#[command]
fn get_supported_formats() -> Vec<String> {
    ArchiveService::supported_formats()
}

#[command]
fn get_creatable_formats() -> Vec<String> {
    ArchiveService::creatable_formats()
}

#[command]
fn create_archive(
    sources: Vec<String>,
    destination: String,
    format: String,
    compression_level: u8,
    window: Window,
) -> Result<(), String> {
    // Reset cancellation flag
    CANCEL_FLAG.store(false, Ordering::Relaxed);

    let source_paths: Vec<PathBuf> = sources.into_iter().map(PathBuf::from).collect();
    let dest = PathBuf::from(destination);
    let options = CreateOptions {
        format,
        compression_level,
        password: None,
    };

    let window_clone = window.clone();
    let cancel_flag = Arc::new(AtomicBool::new(false));
    let cancel_flag_clone = cancel_flag.clone();
    let callback = Box::new(move |progress: CreateProgress| {
        let _ = window_clone.emit("create-progress", &progress);
        if CANCEL_FLAG.load(Ordering::Relaxed) {
            cancel_flag_clone.store(true, Ordering::Relaxed);
        }
    });

    ArchiveService::create_archive(&source_paths, &dest, &options, Some(callback), Some(cancel_flag))
}

const MAX_PREVIEW_SIZE: u64 = 10 * 1024 * 1024; // 10MB

#[command]
fn preview_file(path: String, entry_path: String) -> Result<String, String> {
    let path = PathBuf::from(path);

    // Check entry size before reading to prevent memory spikes
    let info = ArchiveService::list_archive(&path)?;
    if let Some(entry) = info.entries.iter().find(|e| e.path == entry_path) {
        if entry.size > MAX_PREVIEW_SIZE {
            return Err(format!(
                "File too large to preview ({} > 10MB)",
                entry.size
            ));
        }
    }

    let bytes = ArchiveService::read_entry(&path, &entry_path)?;
    let encoded = general_purpose::STANDARD.encode(&bytes);
    Ok(encoded)
}

#[command]
fn extract_entries(
    path: String,
    entry_paths: Vec<String>,
    destination: String,
    overwrite: bool,
) -> Result<(), String> {
    let path = PathBuf::from(path);
    let options = ExtractOptions {
        destination: PathBuf::from(destination),
        overwrite,
        preserve_structure: true,
    };
    ArchiveService::extract_entries(&path, &entry_paths, &options)
}

#[command]
fn get_history() -> Vec<HistoryEntry> {
    HistoryService::get_history()
}

#[command]
fn add_to_history(path: String, name: String, format: String) -> Result<(), String> {
    HistoryService::add_to_history(&path, &name, &format)
}

#[command]
fn remove_from_history(path: String) -> Result<(), String> {
    HistoryService::remove_from_history(&path)
}

#[command]
fn toggle_favorite(path: String) -> Result<bool, String> {
    HistoryService::toggle_favorite(&path)
}

#[command]
fn clear_history() -> Result<(), String> {
    HistoryService::clear_history()
}

#[command]
fn remove_from_archive(path: String, entry_paths: Vec<String>) -> Result<(), String> {
    let path = PathBuf::from(path);
    ArchiveService::remove_entries(&path, &entry_paths)
}

#[command]
fn add_to_archive(archive_path: String, sources: Vec<String>) -> Result<(), String> {
    let archive_path = PathBuf::from(&archive_path);
    let source_pairs: Vec<(PathBuf, String)> = sources
        .into_iter()
        .map(|s| {
            let name = std::path::Path::new(&s)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| s.clone());
            (PathBuf::from(s), name)
        })
        .collect();
    ArchiveService::add_to_archive(&archive_path, &source_pairs)
}

#[command]
fn rename_in_archive(path: String, entry_path: String, new_name: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    ArchiveService::rename_entry(&path, &entry_path, &new_name)
}

#[command]
fn get_settings() -> Settings {
    SettingsService::get_settings()
}

#[command]
fn save_settings(settings: Settings) -> Result<(), String> {
    SettingsService::save_settings(&settings)
}

#[command]
fn extract_single_file(path: String, entry_path: String) -> Result<String, String> {
    let path = PathBuf::from(path);
    let bytes = ArchiveService::read_entry(&path, &entry_path)?;

    // Extract to temp directory
    let temp_dir = std::env::temp_dir().join("arki_preview");
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp dir: {}", e))?;

    let file_name = std::path::Path::new(&entry_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "preview".to_string());

    let file_path = temp_dir.join(&file_name);
    std::fs::write(&file_path, &bytes)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

/// Check if an error message indicates a password-related failure.
fn is_password_error(err: &str) -> bool {
    let lower = err.to_lowercase();
    lower.contains("password")
        || lower.contains("encrypted")
        || lower.contains("decrypt")
        || lower.contains("aes")
}

/// Check if archive is encrypted, returning true/false/unknown.
fn check_encrypted(archive_path: &PathBuf) -> Option<bool> {
    match ArchiveService::list_archive(archive_path) {
        Ok(info) => Some(info.encrypted),
        Err(e) if is_password_error(&e) => Some(true),
        _ => None,
    }
}

/// Handle --smart-extract: try headless extraction, fall back to GUI if
/// the archive is password-protected or extraction fails.
/// Returns Some(path) to open in GUI, or None if extraction succeeded (caller should exit).
fn handle_smart_extract(archive_path: &PathBuf) -> Option<String> {
    // Check if archive is encrypted before attempting extraction
    if let Some(true) = check_encrypted(archive_path) {
        return Some(archive_path.to_string_lossy().to_string());
    }

    // Not encrypted (or detection failed) — try headless extraction
    match ArchiveService::smart_extract(archive_path) {
        Ok(dest) => {
            eprintln!("Smart extract succeeded: {}", dest);
            None
        }
        Err(e) => {
            eprintln!("Smart extract failed: {}", e);
            // Fall back to GUI so the user can see the error and try manually
            Some(archive_path.to_string_lossy().to_string())
        }
    }
}

/// Handle --extract-here: extract to the archive's parent directory.
/// Returns Some(path) to open in GUI on failure, or None on success.
fn handle_extract_here(archive_path: &PathBuf) -> Option<String> {
    if let Some(true) = check_encrypted(archive_path) {
        return Some(archive_path.to_string_lossy().to_string());
    }

    let parent = match archive_path.parent() {
        Some(p) => p.to_path_buf(),
        None => return Some(archive_path.to_string_lossy().to_string()),
    };

    let options = ExtractOptions {
        destination: parent,
        overwrite: false,
        preserve_structure: true,
    };

    match ArchiveService::extract_archive(archive_path, &options, None, None) {
        Ok(()) => {
            eprintln!("Extract here succeeded");
            None
        }
        Err(e) => {
            eprintln!("Extract here failed: {}", e);
            Some(archive_path.to_string_lossy().to_string())
        }
    }
}

/// Handle --extract-to-folder: extract to a subfolder named after the archive.
/// Returns Some(path) to open in GUI on failure, or None on success.
fn handle_extract_to_folder(archive_path: &PathBuf) -> Option<String> {
    if let Some(true) = check_encrypted(archive_path) {
        return Some(archive_path.to_string_lossy().to_string());
    }

    let parent = match archive_path.parent() {
        Some(p) => p.to_path_buf(),
        None => return Some(archive_path.to_string_lossy().to_string()),
    };

    // Get archive name without extension(s)
    let stem = archive_path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "extracted".to_string());
    // Handle double extensions like .tar.gz
    let stem = if archive_path
        .to_string_lossy()
        .to_lowercase()
        .ends_with(".tar.gz")
    {
        stem.trim_end_matches(".tar").to_string()
    } else {
        stem
    };

    let destination = parent.join(stem);

    let options = ExtractOptions {
        destination,
        overwrite: false,
        preserve_structure: true,
    };

    match ArchiveService::extract_archive(archive_path, &options, None, None) {
        Ok(()) => {
            eprintln!("Extract to folder succeeded");
            None
        }
        Err(e) => {
            eprintln!("Extract to folder failed: {}", e);
            Some(archive_path.to_string_lossy().to_string())
        }
    }
}

/// Parse CLI arguments directly from env args.
/// Returns Some(path) if --open was passed or if an extraction needs GUI (password/error).
fn handle_cli_args() -> Option<String> {
    let args: Vec<String> = std::env::args().collect();

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--open" | "-o" => {
                if i + 1 < args.len() {
                    return Some(args[i + 1].clone());
                }
            }
            "--smart-extract" | "-s" => {
                if i + 1 < args.len() {
                    let archive_path = PathBuf::from(&args[i + 1]);
                    match handle_smart_extract(&archive_path) {
                        Some(gui_path) => return Some(gui_path),
                        None => std::process::exit(0),
                    }
                }
            }
            "--extract-here" => {
                if i + 1 < args.len() {
                    let archive_path = PathBuf::from(&args[i + 1]);
                    match handle_extract_here(&archive_path) {
                        Some(gui_path) => return Some(gui_path),
                        None => std::process::exit(0),
                    }
                }
            }
            "--extract-to-folder" => {
                if i + 1 < args.len() {
                    let archive_path = PathBuf::from(&args[i + 1]);
                    match handle_extract_to_folder(&archive_path) {
                        Some(gui_path) => return Some(gui_path),
                        None => std::process::exit(0),
                    }
                }
            }
            _ => {}
        }
        i += 1;
    }
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Single instance: forward args to existing window if already running
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // When a second instance is launched, parse its args
            let mut file_path: Option<String> = None;
            let mut action: Option<&str> = None;
            let mut i = 0;
            while i < args.len() {
                match args[i].as_str() {
                    "--open" | "-o" => {
                        action = Some("open");
                        if i + 1 < args.len() {
                            file_path = Some(args[i + 1].clone());
                            i += 1;
                        }
                    }
                    "--smart-extract" | "-s" => {
                        action = Some("smart-extract");
                        if i + 1 < args.len() {
                            file_path = Some(args[i + 1].clone());
                            i += 1;
                        }
                    }
                    "--extract-here" => {
                        action = Some("extract-here");
                        if i + 1 < args.len() {
                            file_path = Some(args[i + 1].clone());
                            i += 1;
                        }
                    }
                    "--extract-to-folder" => {
                        action = Some("extract-to-folder");
                        if i + 1 < args.len() {
                            file_path = Some(args[i + 1].clone());
                            i += 1;
                        }
                    }
                    _ => {}
                }
                i += 1;
            }

            // Handle extraction actions
            if let Some(path) = &file_path {
                let archive_path = PathBuf::from(path);
                let result = match action {
                    Some("smart-extract") => handle_smart_extract(&archive_path),
                    Some("extract-here") => handle_extract_here(&archive_path),
                    Some("extract-to-folder") => handle_extract_to_folder(&archive_path),
                    _ => None,
                };

                if let Some(gui_path) = result {
                    // Need GUI (password or error) — open in existing window
                    let _ = app.emit("cli-open", &gui_path);
                } else if action != Some("open") {
                    // Extraction succeeded, nothing more to do
                    return;
                }
            }

            // For --open, emit event to existing window
            if let Some(path) = file_path {
                let _ = app.emit("cli-open", &path);
            }

            // Focus the existing window
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }));
    }

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .manage(PendingOpen(Mutex::new(None)))
        .setup(|app| {
            // Set AppUserModelId so Windows shows the correct icon in
            // taskbar, Start menu, and right-click jump list.
            #[cfg(target_os = "windows")]
            {
                use windows::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;
                use windows::core::HSTRING;
                let _ = unsafe {
                    SetCurrentProcessExplicitAppUserModelID(&HSTRING::from("com.kutius.arki"))
                };
            }

            // Handle CLI args on startup
            if let Some(open_path) = handle_cli_args() {
                // Store the path — frontend will poll via get_pending_open on mount.
                // We cannot emit here because the frontend listener isn't registered yet.
                let state = app.state::<PendingOpen>();
                let mut lock = state.0.lock().unwrap();
                *lock = Some(open_path);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_archive,
            extract_archive,
            extract_archive_with_password,
            get_supported_formats,
            get_creatable_formats,
            create_archive,
            preview_file,
            extract_entries,
            get_history,
            add_to_history,
            remove_from_history,
            toggle_favorite,
            clear_history,
            remove_from_archive,
            add_to_archive,
            rename_in_archive,
            get_settings,
            save_settings,
            extract_single_file,
            cancel_operation,
            get_pending_open
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
