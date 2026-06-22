use std::fs::{self, File};
use std::io::{self, BufReader, BufWriter};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tar::Archive;

const IO_BUFFER_SIZE: usize = 64 * 1024; // 64KB

use crate::services::archive::{ArchiveEntry, ArchiveInfo, CreateOptions, CreateProgress, ExtractOptions, ExtractProgress, HealthInfo};
use crate::services::archive_handler::{chunked_copy, ArchiveHandler, count_files_in_sources, count_files_in_dir, calculate_total_size, calculate_dir_size};

pub struct TarHandler;

impl ArchiveHandler for TarHandler {
    fn list(&self, path: &Path) -> Result<ArchiveInfo, String> {
        let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
        let buf_reader = BufReader::with_capacity(IO_BUFFER_SIZE, file);
        let mut archive = Archive::new(buf_reader);

        let mut entries = Vec::new();
        let mut total_size: u64 = 0;

        for entry in archive
            .entries()
            .map_err(|e| format!("Failed to read TAR entries: {}", e))?
        {
            let entry = entry.map_err(|e| format!("Failed to read TAR entry: {}", e))?;
            let header = entry.header();

            let path = header
                .path()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            let name = Path::new(&path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| path.clone());
            let is_dir = header.entry_type().is_dir();
            let size = header.size().unwrap_or(0);
            let modified = header
                .mtime()
                .ok()
                .and_then(|t| {
                    if t > 0 {
                        let dt = chrono::DateTime::from_timestamp(t as i64, 0)?;
                        Some(dt.format("%Y-%m-%d").to_string())
                    } else {
                        None
                    }
                });

            entries.push(ArchiveEntry {
                name,
                path,
                is_directory: is_dir,
                size,
                compressed_size: None,
                modified,
            });

            total_size += size;
        }

        let compressed_size = fs::metadata(path)
            .map(|m| m.len())
            .unwrap_or(0);

        Ok(ArchiveInfo {
            entries,
            total_size,
            compressed_size,
            format: "tar".to_string(),
            encrypted: false,
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
        let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
        let buf_reader = BufReader::with_capacity(IO_BUFFER_SIZE, file);
        let mut archive = Archive::new(buf_reader);

        let mut files_processed: u32 = 0;
        let mut bytes_processed: u64 = 0;

        for entry in archive
            .entries()
            .map_err(|e| format!("Failed to read TAR entries: {}", e))?
        {
            if let Some(ref flag) = cancel_flag {
                if flag.load(Ordering::Relaxed) {
                    return Err("Operation cancelled".to_string());
                }
            }

            let mut entry = entry.map_err(|e| format!("Failed to read TAR entry: {}", e))?;

            let entry_path;
            let entry_size;
            let is_dir;
            {
                let header = entry.header();
                entry_path = header
                    .path()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default();
                entry_size = header.size().unwrap_or(0);
                is_dir = header.entry_type().is_dir();
            }

            let outpath = if options.preserve_structure {
                options.destination.join(&entry_path)
            } else {
                options.destination.join(
                    Path::new(&entry_path)
                        .file_name()
                        .unwrap_or_default(),
                )
            };

            if is_dir {
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
                    files_processed += 1;
                    bytes_processed += entry_size;
                    continue;
                }

                let outfile =
                    File::create(&outpath).map_err(|e| format!("Failed to create file: {}", e))?;
                let mut buf_writer = BufWriter::with_capacity(IO_BUFFER_SIZE, outfile);

                chunked_copy(
                    &mut entry,
                    &mut buf_writer,
                    &cancel_flag,
                    &progress_callback,
                    &entry_path,
                    files_processed,
                    0,
                    bytes_processed,
                    0,
                )?;
            }

            files_processed += 1;
            bytes_processed += entry_size;
        }

        Ok(())
    }

    fn create(
        &self,
        sources: &[PathBuf],
        destination: &Path,
        _options: &CreateOptions,
        progress_callback: Option<Box<dyn Fn(CreateProgress) + Send>>,
        cancel_flag: Option<Arc<AtomicBool>>,
    ) -> Result<(), String> {
        let file = File::create(destination)
            .map_err(|e| format!("Failed to create archive file: {}", e))?;
        let buf_writer = BufWriter::with_capacity(IO_BUFFER_SIZE, file);
        let mut archive = tar::Builder::new(buf_writer);

        let total_files = count_files_in_sources(sources) as u32;
        let total_bytes = calculate_total_size(sources);
        let mut files_processed: u32 = 0;
        let mut bytes_written: u64 = 0;

        for source_path in sources {
            if let Some(ref flag) = cancel_flag {
                if flag.load(Ordering::Relaxed) {
                    drop(archive);
                    let _ = fs::remove_file(destination);
                    return Err("Operation cancelled".to_string());
                }
            }

            if source_path.is_dir() {
                archive
                    .append_dir_all(
                        source_path
                            .file_name()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .to_string(),
                        source_path,
                    )
                    .map_err(|e| format!("Failed to add directory to TAR: {}", e))?;

                let dir_file_count = count_files_in_dir(source_path) as u32;
                files_processed += dir_file_count;
                bytes_written += calculate_dir_size(source_path);

                if let Some(ref callback) = progress_callback {
                    callback(CreateProgress {
                        current_file: source_path
                            .file_name()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .to_string(),
                        files_processed,
                        total_files,
                        bytes_written,
                        total_bytes,
                    });
                }
            } else if source_path.is_file() {
                let name = source_path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                let mut f = File::open(source_path)
                    .map_err(|e| format!("Failed to open source file: {}", e))?;
                archive
                    .append_file(&name, &mut f)
                    .map_err(|e| format!("Failed to add file to TAR: {}", e))?;

                files_processed += 1;
                bytes_written += fs::metadata(source_path).map(|m| m.len()).unwrap_or(0);

                if let Some(ref callback) = progress_callback {
                    callback(CreateProgress {
                        current_file: name,
                        files_processed,
                        total_files,
                        bytes_written,
                        total_bytes,
                    });
                }
            }
        }

        archive
            .into_inner()
            .map_err(|e| format!("Failed to finalize TAR archive: {}", e))?;

        Ok(())
    }

    fn read_entry(&self, path: &Path, entry_path: &str) -> Result<Vec<u8>, String> {
        let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
        let buf_reader = BufReader::with_capacity(IO_BUFFER_SIZE, file);
        let mut archive = Archive::new(buf_reader);

        for entry in archive
            .entries()
            .map_err(|e| format!("Failed to read TAR entries: {}", e))?
        {
            let mut entry = entry.map_err(|e| format!("Failed to read TAR entry: {}", e))?;
            let path_str = entry
                .header()
                .path()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();

            if path_str == entry_path {
                let mut buf = Vec::new();
                io::Read::read_to_end(&mut entry, &mut buf)
                    .map_err(|e| format!("Failed to read entry: {}", e))?;
                return Ok(buf);
            }
        }

        Err(format!("Entry not found: {}", entry_path))
    }

    fn supports_create(&self) -> bool {
        true
    }

    fn extensions(&self) -> Vec<&'static str> {
        vec!["tar"]
    }
}
