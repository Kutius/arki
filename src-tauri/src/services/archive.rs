use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io;
use std::path::{Path, PathBuf};
use zip::read::ZipArchive;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ArchiveEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub size: u64,
    pub compressed_size: Option<u64>,
    pub modified: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ArchiveInfo {
    pub entries: Vec<ArchiveEntry>,
    pub total_size: u64,
    pub compressed_size: u64,
    pub format: String,
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

pub struct ArchiveService;

impl ArchiveService {
    /// Open and list contents of an archive file
    pub fn list_archive(path: &Path) -> Result<ArchiveInfo, String> {
        let extension = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        match extension.as_str() {
            "zip" => Self::list_zip(path),
            _ => Err(format!("Unsupported archive format: {}", extension)),
        }
    }

    /// Extract an archive to the specified destination
    pub fn extract_archive(
        path: &Path,
        options: &ExtractOptions,
        progress_callback: Option<Box<dyn Fn(ExtractProgress) + Send>>,
    ) -> Result<(), String> {
        let extension = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        match extension.as_str() {
            "zip" => Self::extract_zip(path, options, progress_callback),
            _ => Err(format!("Unsupported archive format: {}", extension)),
        }
    }

    /// List contents of a ZIP archive
    fn list_zip(path: &Path) -> Result<ArchiveInfo, String> {
        let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
        let mut archive =
            ZipArchive::new(file).map_err(|e| format!("Failed to read ZIP archive: {}", e))?;

        let mut entries = Vec::new();
        let mut total_size: u64 = 0;
        let mut compressed_size: u64 = 0;

        for i in 0..archive.len() {
            let file = archive
                .by_index(i)
                .map_err(|e| format!("Failed to read entry {}: {}", i, e))?;

            let entry = ArchiveEntry {
                name: file
                    .mangled_name()
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default(),
                path: file.name().to_string(),
                is_directory: file.is_dir(),
                size: file.size(),
                compressed_size: Some(file.compressed_size()),
                modified: file
                    .last_modified()
                    .map(|dt| format!("{:04}-{:02}-{:02}", dt.year(), dt.month(), dt.day())),
            };

            total_size += file.size();
            compressed_size += file.compressed_size();
            entries.push(entry);
        }

        Ok(ArchiveInfo {
            entries,
            total_size,
            compressed_size,
            format: "zip".to_string(),
        })
    }

    /// Extract a ZIP archive
    fn extract_zip(
        path: &Path,
        options: &ExtractOptions,
        progress_callback: Option<Box<dyn Fn(ExtractProgress) + Send>>,
    ) -> Result<(), String> {
        let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
        let mut archive =
            ZipArchive::new(file).map_err(|e| format!("Failed to read ZIP archive: {}", e))?;

        let total_files = archive.len() as u32;
        let mut files_processed: u32 = 0;
        let mut bytes_processed: u64 = 0;

        // Calculate total bytes
        let total_bytes: u64 = (0..archive.len())
            .map(|i| archive.by_index(i).map(|f| f.size()).unwrap_or(0))
            .sum();

        for i in 0..archive.len() {
            let mut file = archive
                .by_index(i)
                .map_err(|e| format!("Failed to read entry {}: {}", i, e))?;

            let outpath = if options.preserve_structure {
                options.destination.join(file.mangled_name())
            } else {
                options.destination.join(
                    file.mangled_name()
                        .file_name()
                        .unwrap_or_default(),
                )
            };

            if file.is_dir() {
                fs::create_dir_all(&outpath)
                    .map_err(|e| format!("Failed to create directory: {}", e))?;
            } else {
                if let Some(p) = outpath.parent() {
                    if !p.exists() {
                        fs::create_dir_all(p)
                            .map_err(|e| format!("Failed to create parent directory: {}", e))?;
                    }
                }

                if outpath.exists() && !options.overwrite {
                    continue;
                }

                let mut outfile =
                    File::create(&outpath).map_err(|e| format!("Failed to create file: {}", e))?;
                io::copy(&mut file, &mut outfile)
                    .map_err(|e| format!("Failed to write file: {}", e))?;
            }

            files_processed += 1;
            bytes_processed += file.size();

            if let Some(ref callback) = progress_callback {
                callback(ExtractProgress {
                    current_file: file.name().to_string(),
                    files_processed,
                    total_files,
                    bytes_processed,
                    total_bytes,
                });
            }
        }

        Ok(())
    }

    /// Get file size in human readable format
    #[allow(dead_code)]
    pub fn format_size(size: u64) -> String {
        const UNITS: [&str; 5] = ["B", "KB", "MB", "GB", "TB"];
        let mut size = size as f64;
        let mut unit_index = 0;

        while size >= 1024.0 && unit_index < UNITS.len() - 1 {
            size /= 1024.0;
            unit_index += 1;
        }

        format!("{:.1} {}", size, UNITS[unit_index])
    }
}
