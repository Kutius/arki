use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use crate::services::archive::{ArchiveEntry, ArchiveInfo, ExtractOptions, ExtractProgress, HealthInfo};
use crate::services::archive_handler::ArchiveHandler;

pub struct RarHandler;

impl ArchiveHandler for RarHandler {
    fn list(&self, path: &Path) -> Result<ArchiveInfo, String> {
        let archive = unrar::Archive::new(path)
            .open_for_listing()
            .map_err(|e| format!("Failed to open RAR archive: {}", e))?;

        let mut entries = Vec::new();
        let mut total_size: u64 = 0;

        let mut cursor = archive;
        loop {
            let header = cursor
                .read_header()
                .map_err(|e| format!("Failed to read RAR header: {}", e))?;

            let header = match header {
                Some(h) => h,
                None => break,
            };

            let entry = header.entry();
            let name = Path::new(&entry.filename)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| entry.filename.to_string_lossy().to_string());

            entries.push(ArchiveEntry {
                name,
                path: entry.filename.to_string_lossy().to_string(),
                is_directory: entry.is_directory(),
                size: entry.unpacked_size as u64,
                compressed_size: None, // RAR doesn't expose per-file compressed size in this API
                modified: None,
            });

            total_size += entry.unpacked_size as u64;
            cursor = header.skip().map_err(|e| format!("Failed to skip RAR entry: {}", e))?;
        }

        let file_metadata =
            fs::metadata(path).map_err(|e| format!("Failed to read file metadata: {}", e))?;
        let compressed_size = file_metadata.len();

        Ok(ArchiveInfo {
            entries,
            total_size,
            compressed_size,
            format: "rar".to_string(),
            encrypted: false, // RAR encryption detection not implemented
            health: HealthInfo::default(),
        })
    }

    fn extract(
        &self,
        path: &Path,
        options: &ExtractOptions,
        progress_callback: Option<Box<dyn Fn(ExtractProgress) + Send>>,
        cancel_flag: Option<Arc<AtomicBool>>,
    ) -> Result<(), String> {
        // Pre-scan to count total files for progress reporting
        let listing = unrar::Archive::new(path)
            .open_for_listing()
            .map_err(|e| format!("Failed to open RAR archive: {}", e))?;
        let mut total_files: u32 = 0;
        let mut total_bytes: u64 = 0;
        let mut cursor = listing;
        loop {
            let header = cursor
                .read_header()
                .map_err(|e| format!("Failed to read RAR header: {}", e))?;
            let header = match header {
                Some(h) => h,
                None => break,
            };
            total_files += 1;
            total_bytes += header.entry().unpacked_size as u64;
            cursor = header.skip().map_err(|e| format!("Failed to skip RAR entry: {}", e))?;
        }

        let archive = unrar::Archive::new(path)
            .open_for_processing()
            .map_err(|e| format!("Failed to open RAR archive: {}", e))?;

        let mut files_processed: u32 = 0;
        let mut bytes_processed: u64 = 0;
        let dest = options.destination.clone();

        let mut cursor = archive;
        loop {
            // Check cancellation between entries
            if let Some(ref flag) = cancel_flag {
                if flag.load(Ordering::Relaxed) {
                    return Err("Operation cancelled".to_string());
                }
            }

            let header = cursor
                .read_header()
                .map_err(|e| format!("Failed to read RAR header: {}", e))?;

            let header = match header {
                Some(h) => h,
                None => break,
            };

            let entry = header.entry();
            let filename = entry.filename.to_string_lossy().to_string();
            let entry_size = entry.unpacked_size as u64;

            if entry.is_directory() {
                let dir_path = dest.join(&entry.filename);
                fs::create_dir_all(&dir_path)
                    .map_err(|e| format!("Failed to create directory: {}", e))?;
                cursor = header
                    .skip()
                    .map_err(|e| format!("Failed to skip RAR entry: {}", e))?;
            } else {
                let file_path = if options.preserve_structure {
                    dest.join(&entry.filename)
                } else {
                    dest.join(
                        Path::new(&entry.filename)
                            .file_name()
                            .map(|n| n.to_string_lossy().to_string())
                            .unwrap_or_else(|| entry.filename.to_string_lossy().to_string()),
                    )
                };

                if let Some(p) = file_path.parent() {
                    if !p.exists() {
                        fs::create_dir_all(p)
                            .map_err(|e| format!("Failed to create parent directory: {}", e))?;
                    }
                }

                if file_path.exists() && !options.overwrite {
                    cursor = header
                        .skip()
                        .map_err(|e| format!("Failed to skip RAR entry: {}", e))?;
                } else {
                    cursor = header
                        .extract_to(&file_path)
                        .map_err(|e| format!("Failed to extract RAR entry: {}", e))?;
                }
            }

            files_processed += 1;
            bytes_processed += entry_size;

            if let Some(ref callback) = progress_callback {
                callback(ExtractProgress {
                    current_file: filename,
                    files_processed,
                    total_files,
                    bytes_processed,
                    total_bytes,
                });
            }
        }

        Ok(())
    }

    fn read_entry(&self, path: &Path, entry_path: &str) -> Result<Vec<u8>, String> {
        let archive = unrar::Archive::new(path)
            .open_for_processing()
            .map_err(|e| format!("Failed to open RAR archive: {}", e))?;

        let temp_dir = std::env::temp_dir().join("arki_preview");
        std::fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to create temp dir: {}", e))?;

        let mut cursor = archive;
        loop {
            let header = cursor
                .read_header()
                .map_err(|e| format!("Failed to read RAR header: {}", e))?;

            let header = match header {
                Some(h) => h,
                None => break,
            };

            let filename = header.entry().filename.to_string_lossy().to_string();
            if filename == entry_path {
                let temp_file = temp_dir.join(
                    Path::new(&filename)
                        .file_name()
                        .unwrap_or_default(),
                );
                let _cursor = header
                    .extract_to(&temp_file)
                    .map_err(|e| format!("Failed to extract RAR entry: {}", e))?;

                let buf = std::fs::read(&temp_file)
                    .map_err(|e| format!("Failed to read extracted file: {}", e))?;

                // Cleanup
                let _ = std::fs::remove_file(&temp_file);
                return Ok(buf);
            }

            cursor = header
                .skip()
                .map_err(|e| format!("Failed to skip RAR entry: {}", e))?;
        }

        Err(format!("Entry not found: {}", entry_path))
    }

    fn supports_create(&self) -> bool {
        false // RAR creation not supported due to patent restrictions
    }

    fn extensions(&self) -> Vec<&'static str> {
        vec!["rar"]
    }
}
