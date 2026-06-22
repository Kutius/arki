use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use super::archive::{ArchiveInfo, CreateOptions, CreateProgress, ExtractOptions, ExtractProgress, HealthInfo};

const PROGRESS_CHUNK_SIZE: usize = 1024 * 1024; // 1MB

/// Copies from `reader` to `writer` in 1MB chunks, checking `cancel_flag` and
/// reporting progress after each chunk. Returns `Ok(bytes_copied)` or an error
/// if cancelled or IO fails.
pub fn chunked_copy(
    reader: &mut impl Read,
    writer: &mut impl Write,
    cancel_flag: &Option<Arc<AtomicBool>>,
    progress_callback: &Option<Box<dyn Fn(ExtractProgress) + Send>>,
    current_file: &str,
    files_processed: u32,
    total_files: u32,
    bytes_processed_base: u64,
    total_bytes: u64,
) -> Result<u64, String> {
    let mut chunk_buf = vec![0u8; PROGRESS_CHUNK_SIZE];
    let mut copied: u64 = 0;

    loop {
        if let Some(ref flag) = cancel_flag {
            if flag.load(Ordering::Relaxed) {
                return Err("Operation cancelled".to_string());
            }
        }

        let bytes_read = reader
            .read(&mut chunk_buf)
            .map_err(|e| format!("Failed to read: {}", e))?;
        if bytes_read == 0 {
            break;
        }
        writer
            .write_all(&chunk_buf[..bytes_read])
            .map_err(|e| format!("Failed to write: {}", e))?;
        copied += bytes_read as u64;

        if let Some(ref callback) = progress_callback {
            callback(ExtractProgress {
                current_file: current_file.to_string(),
                files_processed,
                total_files,
                bytes_processed: bytes_processed_base + copied,
                total_bytes,
            });
        }
    }

    writer.flush().map_err(|e| format!("Failed to flush: {}", e))?;
    Ok(copied)
}

pub trait ArchiveHandler: Send + Sync {
    fn list(&self, path: &Path) -> Result<ArchiveInfo, String>;
    fn extract(
        &self,
        path: &Path,
        options: &ExtractOptions,
        progress_callback: Option<Box<dyn Fn(ExtractProgress) + Send>>,
        cancel_flag: Option<Arc<AtomicBool>>,
    ) -> Result<(), String>;
    fn create(
        &self,
        _sources: &[PathBuf],
        _destination: &Path,
        _options: &CreateOptions,
        _progress_callback: Option<Box<dyn Fn(CreateProgress) + Send>>,
        _cancel_flag: Option<Arc<AtomicBool>>,
    ) -> Result<(), String> {
        Err("Creation not supported for this format".to_string())
    }
    fn supports_create(&self) -> bool {
        false
    }
    /// Read the raw bytes of a single entry for preview purposes.
    /// For single-file formats (gz, br, zst), `entry_path` is ignored.
    fn read_entry(&self, _path: &Path, _entry_path: &str) -> Result<Vec<u8>, String> {
        Err("Preview not supported for this format".to_string())
    }
    /// Extract only specific entries by path. Default implementation extracts all.
    fn extract_entries(
        &self,
        path: &Path,
        entry_paths: &[String],
        options: &ExtractOptions,
    ) -> Result<(), String> {
        // Default: extract all (fallback)
        let _ = entry_paths;
        self.extract(path, options, None, None)
    }
    /// Remove entries from archive. Only supported for ZIP.
    fn remove_entries(&self, _path: &Path, _entry_paths: &[String]) -> Result<(), String> {
        Err("Remove not supported for this format".to_string())
    }
    /// Add files to archive. Only supported for ZIP.
    /// `sources` is a list of (source_path, archive_entry_name) pairs.
    fn add_entries(&self, _archive_path: &Path, _sources: &[(PathBuf, String)]) -> Result<(), String> {
        Err("Add not supported for this format".to_string())
    }
    /// Rename an entry in archive. Only supported for ZIP.
    fn rename_entry(&self, _path: &Path, _old_path: &str, _new_name: &str) -> Result<(), String> {
        Err("Rename not supported for this format".to_string())
    }
    /// Extract with password. Default returns unsupported error.
    fn extract_with_password(
        &self,
        _path: &Path,
        _options: &ExtractOptions,
        _password: &str,
        _progress_callback: Option<Box<dyn Fn(ExtractProgress) + Send>>,
        _cancel_flag: Option<Arc<AtomicBool>>,
    ) -> Result<(), String> {
        Err("Password-protected extraction not supported for this format".to_string())
    }
    fn extensions(&self) -> Vec<&'static str>;

    /// Lightweight integrity verification. Returns health status with any warnings.
    /// Default: always OK (override per-handler for real checks).
    fn verify(&self, _path: &Path) -> HealthInfo {
        HealthInfo {
            status: "ok".to_string(),
            warnings: vec![],
        }
    }
}

/// Count total files recursively in a list of source paths.
pub fn count_files_in_sources(sources: &[PathBuf]) -> usize {
    let mut count = 0;
    for source in sources {
        if source.is_file() {
            count += 1;
        } else if source.is_dir() {
            count += count_files_in_dir(source);
        }
    }
    count
}

/// Count files recursively in a directory.
pub fn count_files_in_dir(dir: &Path) -> usize {
    let mut count = 0;
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                count += 1;
            } else if path.is_dir() {
                count += count_files_in_dir(&path);
            }
        }
    }
    count
}

/// Calculate total size of files in source paths.
pub fn calculate_total_size(sources: &[PathBuf]) -> u64 {
    let mut total = 0;
    for source in sources {
        if source.is_file() {
            total += fs::metadata(source).map(|m| m.len()).unwrap_or(0);
        } else if source.is_dir() {
            total += calculate_dir_size(source);
        }
    }
    total
}

/// Calculate total size of files in a directory recursively.
pub fn calculate_dir_size(dir: &Path) -> u64 {
    let mut total = 0;
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                total += fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
            } else if path.is_dir() {
                total += calculate_dir_size(&path);
            }
        }
    }
    total
}
