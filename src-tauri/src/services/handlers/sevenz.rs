use std::fs::{self, File};
use std::io::{self, BufWriter, Write};
use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use sevenz_rust::{Password, SevenZReader};

const IO_BUFFER_SIZE: usize = 64 * 1024; // 64KB

use crate::services::archive::{ArchiveEntry, ArchiveInfo, ExtractOptions, ExtractProgress, HealthInfo};
use crate::services::archive_handler::ArchiveHandler;

pub struct SevenzHandler;

impl SevenzHandler {
    fn extract_inner(
        &self,
        path: &Path,
        options: &ExtractOptions,
        password: &str,
        progress_callback: Option<Box<dyn Fn(ExtractProgress) + Send>>,
        cancel_flag: Option<Arc<AtomicBool>>,
    ) -> Result<(), String> {
        let pw = if password.is_empty() {
            Password::empty()
        } else {
            Password::from(password)
        };

        let mut archive = match SevenZReader::open(path, pw) {
            Ok(archive) => archive,
            Err(e) => {
                let err_msg = format!("{}", e);
                if err_msg.contains("Password")
                    || err_msg.contains("password")
                    || err_msg.contains("encrypted")
                {
                    return Err(
                        "Archive is password-protected. Please provide a password to extract."
                            .to_string(),
                    );
                }
                return Err(format!("Failed to open 7z archive: {}", e));
            }
        };

        let total_files = archive.archive().files.len() as u32;
        let total_bytes: u64 = archive.archive().files.iter().map(|e| e.size).sum();

        let mut files_processed: u32 = 0;
        let mut bytes_processed: u64 = 0;

        let dest = options.destination.clone();
        let overwrite = options.overwrite;
        let preserve = options.preserve_structure;

        archive
            .for_each_entries(|entry, reader| {
                if let Some(ref flag) = cancel_flag {
                    if flag.load(std::sync::atomic::Ordering::Relaxed) {
                        return Ok(false);
                    }
                }

                let entry_path = if preserve {
                    dest.join(&entry.name)
                } else {
                    dest.join(
                        Path::new(&entry.name)
                            .file_name()
                            .map(|n| n.to_string_lossy().to_string())
                            .unwrap_or_else(|| entry.name.clone()),
                    )
                };

                if entry.is_directory {
                    fs::create_dir_all(&entry_path)
                        .map_err(|e| sevenz_rust::Error::Other(e.to_string().into()))?;
                } else {
                    if let Some(p) = entry_path.parent() {
                        if !p.exists() {
                            fs::create_dir_all(p)
                                .map_err(|e| sevenz_rust::Error::Other(e.to_string().into()))?;
                        }
                    }

                    if entry_path.exists() && !overwrite {
                        files_processed += 1;
                        bytes_processed += entry.size;
                        return Ok(true);
                    }

                    let outfile = File::create(&entry_path)
                        .map_err(|e| sevenz_rust::Error::Other(e.to_string().into()))?;
                    let mut buf_writer = BufWriter::with_capacity(IO_BUFFER_SIZE, outfile);
                    io::copy(reader, &mut buf_writer)
                        .map_err(|e| sevenz_rust::Error::Other(e.to_string().into()))?;
                    buf_writer
                        .flush()
                        .map_err(|e: io::Error| sevenz_rust::Error::Other(e.to_string().into()))?;
                }

                files_processed += 1;
                bytes_processed += entry.size;

                if let Some(ref callback) = progress_callback {
                    callback(ExtractProgress {
                        current_file: entry.name.clone(),
                        files_processed,
                        total_files,
                        bytes_processed,
                        total_bytes,
                    });
                }

                Ok(true)
            })
            .map_err(|e| format!("Failed to extract 7z archive: {}", e))?;

        Ok(())
    }

    fn list_with_password(&self, path: &Path, password: &str) -> Result<ArchiveInfo, String> {
        let pw = if password.is_empty() {
            Password::empty()
        } else {
            Password::from(password)
        };

        // Try to open the archive
        let archive = match SevenZReader::open(path, pw) {
            Ok(archive) => archive,
            Err(e) => {
                let err_msg = format!("{}", e);
                // Check if this is a password-related error
                if err_msg.contains("Password") || err_msg.contains("password") || err_msg.contains("encrypted") {
                    // Return empty archive info with encrypted flag
                    let file_metadata = fs::metadata(path)
                        .map_err(|e| format!("Failed to read file metadata: {}", e))?;
                    return Ok(ArchiveInfo {
                        entries: Vec::new(),
                        total_size: 0,
                        compressed_size: file_metadata.len(),
                        format: "7z".to_string(),
                        encrypted: true,
                        health: HealthInfo::default(),
                    });
                }
                return Err(format!("Failed to open 7z archive: {}", e));
            }
        };

        let mut entries = Vec::new();
        let mut total_size: u64 = 0;

        for entry in archive.archive().files.iter() {
            let name = Path::new(&entry.name)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| entry.name.clone());

            let entry_info = ArchiveEntry {
                name,
                path: entry.name.clone(),
                is_directory: entry.is_directory,
                size: entry.size,
                compressed_size: None,
                modified: None,
            };

            total_size += entry.size;
            entries.push(entry_info);
        }

        let file_metadata =
            fs::metadata(path).map_err(|e| format!("Failed to read file metadata: {}", e))?;
        let compressed_size = file_metadata.len();

        Ok(ArchiveInfo {
            entries,
            total_size,
            compressed_size,
            format: "7z".to_string(),
            encrypted: false,
            health: HealthInfo::default(),
        })
    }
}

impl ArchiveHandler for SevenzHandler {
    fn list(&self, path: &Path) -> Result<ArchiveInfo, String> {
        self.list_with_password(path, "")
    }

    fn extract(
        &self,
        path: &Path,
        options: &ExtractOptions,
        progress_callback: Option<Box<dyn Fn(ExtractProgress) + Send>>,
        cancel_flag: Option<Arc<AtomicBool>>,
    ) -> Result<(), String> {
        self.extract_inner(path, options, "", progress_callback, cancel_flag)
    }

    fn read_entry(&self, path: &Path, entry_path: &str) -> Result<Vec<u8>, String> {
        let mut archive = SevenZReader::open(path, Password::empty())
            .map_err(|e| format!("Failed to open 7z archive: {}", e))?;

        let temp_dir = std::env::temp_dir().join("arki_preview_7z");
        std::fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to create temp dir: {}", e))?;

        let target_name = entry_path.to_string();
        let result_buf: std::sync::Arc<std::sync::Mutex<Option<Vec<u8>>>> =
            std::sync::Arc::new(std::sync::Mutex::new(None));
        let result_clone = result_buf.clone();

        archive
            .for_each_entries(|entry, reader| {
                if entry.name == target_name {
                    let mut buf = Vec::new();
                    std::io::Read::read_to_end(reader, &mut buf)
                        .map_err(|e| sevenz_rust::Error::Other(e.to_string().into()))?;
                    *result_clone.lock().unwrap() = Some(buf);
                    return Ok(false); // stop iteration
                }
                Ok(true)
            })
            .map_err(|e| format!("Failed to read 7z archive: {}", e))?;

        let buf = result_buf
            .lock()
            .unwrap()
            .take()
            .ok_or_else(|| format!("Entry not found: {}", entry_path))?;
        Ok(buf)
    }

    fn extract_with_password(
        &self,
        path: &Path,
        options: &ExtractOptions,
        password: &str,
        progress_callback: Option<Box<dyn Fn(ExtractProgress) + Send>>,
        cancel_flag: Option<Arc<AtomicBool>>,
    ) -> Result<(), String> {
        self.extract_inner(path, options, password, progress_callback, cancel_flag)
    }

    fn supports_create(&self) -> bool {
        false
    }

    fn extensions(&self) -> Vec<&'static str> {
        vec!["7z"]
    }
}
