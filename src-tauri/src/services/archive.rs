use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use super::dispatcher;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub size: u64,
    pub compressed_size: Option<u64>,
    pub modified: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HealthInfo {
    /// "ok" | "warning"
    pub status: String,
    pub warnings: Vec<String>,
}

impl Default for HealthInfo {
    fn default() -> Self {
        Self {
            status: "ok".to_string(),
            warnings: vec![],
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveInfo {
    pub entries: Vec<ArchiveEntry>,
    pub total_size: u64,
    pub compressed_size: u64,
    pub format: String,
    pub encrypted: bool,
    pub health: HealthInfo,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExtractOptions {
    pub destination: PathBuf,
    pub overwrite: bool,
    pub preserve_structure: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExtractProgress {
    pub current_file: String,
    pub files_processed: u32,
    pub total_files: u32,
    pub bytes_processed: u64,
    pub total_bytes: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateProgress {
    pub current_file: String,
    pub files_processed: u32,
    pub total_files: u32,
    pub bytes_written: u64,
    pub total_bytes: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateOptions {
    pub format: String,
    pub compression_level: u8,
    pub password: Option<String>,
}

pub struct ArchiveService;

impl ArchiveService {
    /// Open and list contents of an archive file
    pub fn list_archive(path: &Path) -> Result<ArchiveInfo, String> {
        let format = dispatcher::DISPATCHER.detect_format(path)?;
        let handler = dispatcher::DISPATCHER.get_handler(&format)?;
        let mut info = handler.list(path)?;
        // Lightweight integrity check alongside listing
        info.health = handler.verify(path);
        Ok(info)
    }

    /// Extract an archive to the specified destination
    pub fn extract_archive(
        path: &Path,
        options: &ExtractOptions,
        progress_callback: Option<Box<dyn Fn(ExtractProgress) + Send>>,
        cancel_flag: Option<Arc<AtomicBool>>,
    ) -> Result<(), String> {
        let format = dispatcher::DISPATCHER.detect_format(path)?;
        let handler = dispatcher::DISPATCHER.get_handler(&format)?;
        handler.extract(path, options, progress_callback, cancel_flag)
    }

    /// Extract an archive with password and optional progress callback
    pub fn extract_archive_with_password_with_progress(
        path: &Path,
        options: &ExtractOptions,
        password: &str,
        progress_callback: Option<Box<dyn Fn(ExtractProgress) + Send>>,
        cancel_flag: Option<Arc<AtomicBool>>,
    ) -> Result<(), String> {
        let format = dispatcher::DISPATCHER.detect_format(path)?;
        let handler = dispatcher::DISPATCHER.get_handler(&format)?;
        handler.extract_with_password(path, options, password, progress_callback, cancel_flag)
    }

    /// Create an archive from source files
    pub fn create_archive(
        sources: &[PathBuf],
        destination: &Path,
        options: &CreateOptions,
        progress_callback: Option<Box<dyn Fn(CreateProgress) + Send>>,
        cancel_flag: Option<Arc<AtomicBool>>,
    ) -> Result<(), String> {
        let handler = dispatcher::DISPATCHER.get_handler(&options.format)?;
        if !handler.supports_create() {
            return Err(format!(
                "Creation not supported for format: {}",
                options.format
            ));
        }
        handler.create(sources, destination, options, progress_callback, cancel_flag)
    }

    /// Get list of supported format names
    pub fn supported_formats() -> Vec<String> {
        vec![
            "zip".to_string(),
            "tar".to_string(),
            "tar.gz".to_string(),
            "tgz".to_string(),
            "gz".to_string(),
            "7z".to_string(),
            "br".to_string(),
            "zst".to_string(),
            "rar".to_string(),
        ]
    }

    /// Extract only specific entries from an archive
    pub fn extract_entries(
        path: &Path,
        entry_paths: &[String],
        options: &ExtractOptions,
    ) -> Result<(), String> {
        let format = dispatcher::DISPATCHER.detect_format(path)?;
        let handler = dispatcher::DISPATCHER.get_handler(&format)?;
        handler.extract_entries(path, entry_paths, options)
    }

    /// Read a single entry from an archive for preview (returns raw bytes)
    pub fn read_entry(path: &Path, entry_path: &str) -> Result<Vec<u8>, String> {
        let format = dispatcher::DISPATCHER.detect_format(path)?;
        let handler = dispatcher::DISPATCHER.get_handler(&format)?;
        handler.read_entry(path, entry_path)
    }

    /// Remove entries from an archive
    pub fn remove_entries(path: &Path, entry_paths: &[String]) -> Result<(), String> {
        let format = dispatcher::DISPATCHER.detect_format(path)?;
        let handler = dispatcher::DISPATCHER.get_handler(&format)?;
        handler.remove_entries(path, entry_paths)
    }

    /// Add files to an archive
    pub fn add_to_archive(archive_path: &Path, sources: &[(PathBuf, String)]) -> Result<(), String> {
        let format = dispatcher::DISPATCHER.detect_format(archive_path)?;
        let handler = dispatcher::DISPATCHER.get_handler(&format)?;
        handler.add_entries(archive_path, sources)
    }

    /// Rename an entry in an archive
    pub fn rename_entry(path: &Path, old_path: &str, new_name: &str) -> Result<(), String> {
        let format = dispatcher::DISPATCHER.detect_format(path)?;
        let handler = dispatcher::DISPATCHER.get_handler(&format)?;
        handler.rename_entry(path, old_path, new_name)
    }

    /// Get list of formats that support creation
    pub fn creatable_formats() -> Vec<String> {
        vec!["zip".to_string(), "tar".to_string(), "tar.gz".to_string()]
    }

    /// Smart extract: extracts to the archive's parent directory.
    /// If the archive contains a single top-level folder, extracts directly.
    /// Otherwise, creates a subfolder named after the archive.
    pub fn smart_extract(archive_path: &Path) -> Result<String, String> {
        // Get parent directory
        let parent = archive_path
            .parent()
            .ok_or_else(|| "Cannot determine parent directory".to_string())?;

        // List archive contents
        let info = Self::list_archive(archive_path)?;

        // Determine top-level entries
        let top_levels: Vec<String> = info
            .entries
            .iter()
            .filter_map(|e| {
                let path = e.path.replace('\\', "/");
                let normalized = path.trim_start_matches('/');
                normalized.split('/').next().map(|s| s.to_string())
            })
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect();

        let destination = if top_levels.len() == 1 {
            // Single top-level entry — extract directly to parent
            parent.to_path_buf()
        } else {
            // Multiple top-level entries — create a subfolder
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
            parent.join(stem)
        };

        let options = ExtractOptions {
            destination: destination.clone(),
            overwrite: false,
            preserve_structure: true,
        };

        Self::extract_archive(archive_path, &options, None, None)?;

        Ok(destination.to_string_lossy().to_string())
    }
}
