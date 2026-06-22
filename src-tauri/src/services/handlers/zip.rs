use std::fs::{self, File};
use std::io::{self, BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use zip::read::ZipArchive;
use zip::write::SimpleFileOptions;
use zip::CompressionMethod;
use zip::ZipWriter;

const IO_BUFFER_SIZE: usize = 64 * 1024; // 64KB

use crate::services::archive::{ArchiveEntry, ArchiveInfo, CreateOptions, CreateProgress, ExtractOptions, ExtractProgress, HealthInfo};
use crate::services::archive_handler::{chunked_copy, ArchiveHandler, count_files_in_sources, calculate_total_size};

pub struct ZipHandler;

impl ArchiveHandler for ZipHandler {
    fn list(&self, path: &Path) -> Result<ArchiveInfo, String> {
        let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
        let buf_reader = BufReader::with_capacity(IO_BUFFER_SIZE, file);
        let mut archive =
            ZipArchive::new(buf_reader).map_err(|e| format!("Failed to read ZIP archive: {}", e))?;

        let mut entries = Vec::new();
        let mut total_size: u64 = 0;
        let mut compressed_size: u64 = 0;

        // Use raw access for listing to avoid decryption issues
        for i in 0..archive.len() {
            let raw = archive
                .by_index_raw(i)
                .map_err(|e| format!("Failed to read entry {}: {}", i, e))?;

            let entry = ArchiveEntry {
                name: raw
                    .mangled_name()
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default(),
                path: raw.name().to_string(),
                is_directory: raw.is_dir(),
                size: raw.size(),
                compressed_size: Some(raw.compressed_size()),
                modified: raw
                    .last_modified()
                    .map(|dt| format!("{:04}-{:02}-{:02}", dt.year(), dt.month(), dt.day())),
            };

            total_size += raw.size();
            compressed_size += raw.compressed_size();
            entries.push(entry);
        }

        // Check if any entry is encrypted
        let encrypted = archive
            .by_index_raw(0)
            .map(|f| f.encrypted())
            .unwrap_or(false);

        Ok(ArchiveInfo {
            entries,
            total_size,
            compressed_size,
            format: "zip".to_string(),
            encrypted,
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
        let mut archive =
            ZipArchive::new(buf_reader).map_err(|e| format!("Failed to read ZIP archive: {}", e))?;

        let total_files = archive.len() as u32;
        let mut files_processed: u32 = 0;
        let mut bytes_processed: u64 = 0;

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

                let outfile =
                    File::create(&outpath).map_err(|e| format!("Failed to create file: {}", e))?;
                let mut buf_writer = BufWriter::with_capacity(IO_BUFFER_SIZE, outfile);

                let entry_name = file.name().to_string();
                let result = chunked_copy(
                    &mut file,
                    &mut buf_writer,
                    &cancel_flag,
                    &progress_callback,
                    &entry_name,
                    files_processed,
                    total_files,
                    bytes_processed,
                    total_bytes,
                );

                if result.is_err() {
                    // Cancel: clean up partial file
                    drop(buf_writer);
                    let _ = fs::remove_file(&outpath);
                    return result.map(|_| ());
                }
            }

            files_processed += 1;
            bytes_processed += file.size();
        }

        Ok(())
    }

    fn create(
        &self,
        sources: &[PathBuf],
        destination: &Path,
        options: &CreateOptions,
        progress_callback: Option<Box<dyn Fn(CreateProgress) + Send>>,
        cancel_flag: Option<Arc<AtomicBool>>,
    ) -> Result<(), String> {
        let file = File::create(destination)
            .map_err(|e| format!("Failed to create archive file: {}", e))?;
        let buf_writer = BufWriter::with_capacity(IO_BUFFER_SIZE, file);
        let mut zip = ZipWriter::new(buf_writer);

        let compression_method = match options.compression_level {
            0 => CompressionMethod::Stored,
            _ => CompressionMethod::Deflated,
        };

        let write_options = SimpleFileOptions::default()
            .compression_method(compression_method)
            .compression_level(Some(options.compression_level as i64));

        // Count total files for progress
        let total_files = count_files_in_sources(sources) as u32;
        let total_bytes = calculate_total_size(sources);
        let mut files_processed: u32 = 0;
        let mut bytes_written: u64 = 0;

        for source_path in sources {
            // Check cancellation
            if let Some(ref flag) = cancel_flag {
                if flag.load(Ordering::Relaxed) {
                    // Clean up partial archive
                    drop(zip);
                    let _ = fs::remove_file(destination);
                    return Err("Operation cancelled".to_string());
                }
            }

            if source_path.is_dir() {
                add_directory_to_zip_with_progress(
                    &mut zip,
                    source_path,
                    source_path,
                    write_options,
                    &progress_callback,
                    &mut files_processed,
                    &mut bytes_written,
                    total_files,
                    total_bytes,
                    &cancel_flag,
                )?;
            } else if source_path.is_file() {
                let name = source_path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();

                zip.start_file(&name, write_options)
                    .map_err(|e| format!("Failed to add file to ZIP: {}", e))?;

                let f = File::open(source_path)
                    .map_err(|e| format!("Failed to open source file: {}", e))?;
                let mut buf_reader = BufReader::with_capacity(IO_BUFFER_SIZE, f);
                let written = io::copy(&mut buf_reader, &mut zip)
                    .map_err(|e| format!("Failed to write file contents: {}", e))?;

                files_processed += 1;
                bytes_written += written;

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

        zip.finish()
            .map_err(|e| format!("Failed to finalize ZIP archive: {}", e))?;

        Ok(())
    }

    fn extract_entries(
        &self,
        path: &Path,
        entry_paths: &[String],
        options: &ExtractOptions,
    ) -> Result<(), String> {
        let path_set: std::collections::HashSet<&str> =
            entry_paths.iter().map(|s| s.as_str()).collect();

        let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
        let buf_reader = BufReader::with_capacity(IO_BUFFER_SIZE, file);
        let mut archive =
            ZipArchive::new(buf_reader).map_err(|e| format!("Failed to read ZIP archive: {}", e))?;

        for i in 0..archive.len() {
            let mut file = archive
                .by_index(i)
                .map_err(|e| format!("Failed to read entry {}: {}", i, e))?;

            let entry_name = file.name().to_string();
            if !path_set.contains(entry_name.as_str()) {
                continue;
            }

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

                let outfile =
                    File::create(&outpath).map_err(|e| format!("Failed to create file: {}", e))?;
                let mut buf_writer = BufWriter::with_capacity(IO_BUFFER_SIZE, outfile);
                io::copy(&mut file, &mut buf_writer)
                    .map_err(|e| format!("Failed to write file: {}", e))?;
                buf_writer.flush().map_err(|e| format!("Failed to flush file: {}", e))?;
            }
        }

        Ok(())
    }

    fn remove_entries(&self, path: &Path, entry_paths: &[String]) -> Result<(), String> {
        let path_set: std::collections::HashSet<&str> =
            entry_paths.iter().map(|s| s.as_str()).collect();

        let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
        let buf_reader = BufReader::with_capacity(IO_BUFFER_SIZE, file);
        let mut archive =
            ZipArchive::new(buf_reader).map_err(|e| format!("Failed to read ZIP archive: {}", e))?;

        let temp_path = path.with_extension("zip.tmp");
        {
            let temp_file = File::create(&temp_path)
                .map_err(|e| format!("Failed to create temp file: {}", e))?;
            let buf_writer = BufWriter::with_capacity(IO_BUFFER_SIZE, temp_file);
            let mut zip = ZipWriter::new(buf_writer);

            for i in 0..archive.len() {
                let file = archive
                    .by_index(i)
                    .map_err(|e| format!("Failed to read entry {}: {}", i, e))?;

                let name = file.name().to_string();
                if path_set.contains(name.as_str()) {
                    continue; // Skip entries to remove
                }

                zip.raw_copy_file(file)
                    .map_err(|e| format!("Failed to copy entry: {}", e))?;
            }

            zip.finish()
                .map_err(|e| format!("Failed to finalize ZIP: {}", e))?;
        }

        // Replace original with temp file
        std::fs::rename(&temp_path, path)
            .map_err(|e| format!("Failed to replace archive: {}", e))?;

        Ok(())
    }

    fn add_entries(&self, archive_path: &Path, sources: &[(PathBuf, String)]) -> Result<(), String> {
        let file = File::open(archive_path).map_err(|e| format!("Failed to open file: {}", e))?;
        let buf_reader = BufReader::with_capacity(IO_BUFFER_SIZE, file);
        let mut archive =
            ZipArchive::new(buf_reader).map_err(|e| format!("Failed to read ZIP archive: {}", e))?;

        let temp_path = archive_path.with_extension("zip.tmp");
        {
            let temp_file = File::create(&temp_path)
                .map_err(|e| format!("Failed to create temp file: {}", e))?;
            let buf_writer = BufWriter::with_capacity(IO_BUFFER_SIZE, temp_file);
            let mut zip = ZipWriter::new(buf_writer);

            // Copy existing entries
            for i in 0..archive.len() {
                let file = archive
                    .by_index(i)
                    .map_err(|e| format!("Failed to read entry {}: {}", i, e))?;
                zip.raw_copy_file(file)
                    .map_err(|e| format!("Failed to copy entry: {}", e))?;
            }

            // Add new entries
            let write_options = SimpleFileOptions::default()
                .compression_method(CompressionMethod::Deflated)
                .compression_level(Some(6));

            for (source_path, entry_name) in sources {
                if source_path.is_dir() {
                    add_directory_to_zip(&mut zip, source_path, source_path, write_options)?;
                } else if source_path.is_file() {
                    zip.start_file(entry_name, write_options)
                        .map_err(|e| format!("Failed to add file: {}", e))?;
                    let f = File::open(source_path)
                        .map_err(|e| format!("Failed to open source: {}", e))?;
                    let mut buf_reader = BufReader::with_capacity(IO_BUFFER_SIZE, f);
                    io::copy(&mut buf_reader, &mut zip)
                        .map_err(|e| format!("Failed to write file: {}", e))?;
                }
            }

            zip.finish()
                .map_err(|e| format!("Failed to finalize ZIP: {}", e))?;
        }

        std::fs::rename(&temp_path, archive_path)
            .map_err(|e| format!("Failed to replace archive: {}", e))?;

        Ok(())
    }

    fn rename_entry(&self, path: &Path, old_path: &str, new_name: &str) -> Result<(), String> {
        let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
        let buf_reader = BufReader::with_capacity(IO_BUFFER_SIZE, file);
        let mut archive =
            ZipArchive::new(buf_reader).map_err(|e| format!("Failed to read ZIP archive: {}", e))?;

        // Build new path
        let old_p = std::path::Path::new(old_path);
        let parent = old_p.parent().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
        let new_entry_path = if parent.is_empty() {
            new_name.to_string()
        } else {
            format!("{}/{}", parent, new_name)
        };

        let temp_path = path.with_extension("zip.tmp");
        {
            let temp_file = File::create(&temp_path)
                .map_err(|e| format!("Failed to create temp file: {}", e))?;
            let buf_writer = BufWriter::with_capacity(IO_BUFFER_SIZE, temp_file);
            let mut zip = ZipWriter::new(buf_writer);

            for i in 0..archive.len() {
                let mut file = archive
                    .by_index(i)
                    .map_err(|e| format!("Failed to read entry {}: {}", i, e))?;

                let name = file.name().to_string();
                let target_name = if name == old_path {
                    &new_entry_path
                } else {
                    &name
                };

                let options = SimpleFileOptions::default()
                    .compression_method(file.compression());

                if file.is_dir() {
                    zip.add_directory(target_name, options)
                        .map_err(|e| format!("Failed to add directory: {}", e))?;
                } else {
                    zip.start_file(target_name, options)
                        .map_err(|e| format!("Failed to start file: {}", e))?;
                    io::copy(&mut file, &mut zip)
                        .map_err(|e| format!("Failed to copy entry: {}", e))?;
                }
            }

            zip.finish()
                .map_err(|e| format!("Failed to finalize ZIP: {}", e))?;
        }

        std::fs::rename(&temp_path, path)
            .map_err(|e| format!("Failed to replace archive: {}", e))?;

        Ok(())
    }

    fn read_entry(&self, path: &Path, entry_path: &str) -> Result<Vec<u8>, String> {
        let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
        let buf_reader = BufReader::with_capacity(IO_BUFFER_SIZE, file);
        let mut archive =
            ZipArchive::new(buf_reader).map_err(|e| format!("Failed to read ZIP archive: {}", e))?;

        let mut zip_file = archive
            .by_name(entry_path)
            .map_err(|e| format!("Entry '{}' not found: {}", entry_path, e))?;

        let mut buf = Vec::new();
        zip_file.read_to_end(&mut buf)
            .map_err(|e| format!("Failed to read entry: {}", e))?;
        Ok(buf)
    }

    fn supports_create(&self) -> bool {
        true
    }

    fn extensions(&self) -> Vec<&'static str> {
        vec!["zip"]
    }

    fn extract_with_password(
        &self,
        path: &Path,
        options: &ExtractOptions,
        password: &str,
        progress_callback: Option<Box<dyn Fn(ExtractProgress) + Send>>,
        cancel_flag: Option<Arc<AtomicBool>>,
    ) -> Result<(), String> {
        let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
        let buf_reader = BufReader::with_capacity(IO_BUFFER_SIZE, file);
        let mut archive = ZipArchive::new(buf_reader)
            .map_err(|e| format!("Failed to read ZIP archive: {}", e))?;

        let total_files = archive.len() as u32;
        let mut files_processed: u32 = 0;

        let total_bytes: u64 = (0..archive.len())
            .map(|i| archive.by_index(i).map(|f| f.size()).unwrap_or(0))
            .sum();
        let mut bytes_processed: u64 = 0;

        for i in 0..archive.len() {
            // Check cancellation
            if let Some(ref flag) = cancel_flag {
                if flag.load(Ordering::Relaxed) {
                    return Err("Operation cancelled".to_string());
                }
            }

            let mut zip_file = archive
                .by_index_decrypt(i, password.as_bytes())
                .map_err(|e| format!("Failed to decrypt entry {}: {}", i, e))?;

            let filename = zip_file.name().to_string();
            let entry_size = zip_file.size();
            let outpath = if options.preserve_structure {
                options.destination.join(zip_file.mangled_name())
            } else {
                options.destination.join(
                    zip_file
                        .mangled_name()
                        .file_name()
                        .unwrap_or_default(),
                )
            };

            if zip_file.is_dir() {
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

                let outfile = File::create(&outpath)
                    .map_err(|e| format!("Failed to create file: {}", e))?;
                let mut buf_writer = BufWriter::with_capacity(IO_BUFFER_SIZE, outfile);

                let result = chunked_copy(
                    &mut zip_file,
                    &mut buf_writer,
                    &cancel_flag,
                    &progress_callback,
                    &filename,
                    files_processed,
                    total_files,
                    bytes_processed,
                    total_bytes,
                );

                if result.is_err() {
                    drop(buf_writer);
                    let _ = fs::remove_file(&outpath);
                    return result.map(|_| ());
                }
            }

            files_processed += 1;
            bytes_processed += entry_size;
        }

        Ok(())
    }
}

fn add_directory_to_zip<W: io::Write + io::Seek>(
    zip: &mut ZipWriter<W>,
    dir: &Path,
    base: &Path,
    options: SimpleFileOptions,
) -> Result<(), String> {
    for entry in fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        let relative = path
            .strip_prefix(base)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");

        if path.is_dir() {
            let dir_name = format!("{}/", relative);
            zip.add_directory(&dir_name, options)
                .map_err(|e| format!("Failed to add directory to ZIP: {}", e))?;
            add_directory_to_zip(zip, &path, base, options)?;
        } else {
            zip.start_file(&relative, options)
                .map_err(|e| format!("Failed to add file to ZIP: {}", e))?;

            let f = File::open(&path)
                .map_err(|e| format!("Failed to open file: {}", e))?;
            let mut buf_reader = BufReader::with_capacity(IO_BUFFER_SIZE, f);
            io::copy(&mut buf_reader, zip)
                .map_err(|e| format!("Failed to write file contents: {}", e))?;
        }
    }

    Ok(())
}

fn add_directory_to_zip_with_progress<W: io::Write + io::Seek>(
    zip: &mut ZipWriter<W>,
    dir: &Path,
    base: &Path,
    options: SimpleFileOptions,
    progress_callback: &Option<Box<dyn Fn(CreateProgress) + Send>>,
    files_processed: &mut u32,
    bytes_written: &mut u64,
    total_files: u32,
    total_bytes: u64,
    cancel_flag: &Option<Arc<AtomicBool>>,
) -> Result<(), String> {
    for entry in fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        let relative = path
            .strip_prefix(base)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");

        // Check cancellation
        if let Some(ref flag) = cancel_flag {
            if flag.load(Ordering::Relaxed) {
                return Err("Operation cancelled".to_string());
            }
        }

        if path.is_dir() {
            let dir_name = format!("{}/", relative);
            zip.add_directory(&dir_name, options)
                .map_err(|e| format!("Failed to add directory to ZIP: {}", e))?;
            add_directory_to_zip_with_progress(
                zip, &path, base, options, progress_callback,
                files_processed, bytes_written, total_files, total_bytes,
                cancel_flag,
            )?;
        } else {
            zip.start_file(&relative, options)
                .map_err(|e| format!("Failed to add file to ZIP: {}", e))?;

            let f = File::open(&path)
                .map_err(|e| format!("Failed to open file: {}", e))?;
            let mut buf_reader = BufReader::with_capacity(IO_BUFFER_SIZE, f);
            let written = io::copy(&mut buf_reader, zip)
                .map_err(|e| format!("Failed to write file contents: {}", e))?;

            *files_processed += 1;
            *bytes_written += written;

            if let Some(ref callback) = progress_callback {
                callback(CreateProgress {
                    current_file: relative,
                    files_processed: *files_processed,
                    total_files,
                    bytes_written: *bytes_written,
                    total_bytes,
                });
            }
        }
    }

    Ok(())
}
