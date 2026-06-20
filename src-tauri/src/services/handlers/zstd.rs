use std::fs::{self, File};
use std::io::{BufReader, BufWriter, Read};
use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

const IO_BUFFER_SIZE: usize = 64 * 1024; // 64KB

use crate::services::archive::{ArchiveEntry, ArchiveInfo, ExtractOptions, ExtractProgress};
use crate::services::archive_handler::{chunked_copy, ArchiveHandler};

pub struct ZstdHandler;

impl ArchiveHandler for ZstdHandler {
    fn list(&self, path: &Path) -> Result<ArchiveInfo, String> {
        let metadata =
            fs::metadata(path).map_err(|e| format!("Failed to read file metadata: {}", e))?;

        // Get the original filename by removing .zst extension
        let filename = path
            .file_stem()
            .and_then(|f| f.to_str())
            .unwrap_or("unknown")
            .to_string();

        let entry = ArchiveEntry {
            name: filename,
            path: ".".to_string(),
            is_directory: false,
            size: metadata.len(),
            compressed_size: Some(metadata.len()),
            modified: metadata
                .modified()
                .ok()
                .and_then(|t| {
                    let dt: chrono::DateTime<chrono::Utc> = t.into();
                    Some(dt.format("%Y-%m-%d").to_string())
                }),
        };

        Ok(ArchiveInfo {
            entries: vec![entry],
            total_size: metadata.len(),
            compressed_size: metadata.len(),
            format: "zst".to_string(),
            encrypted: false,
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

        let filename = path
            .file_stem()
            .and_then(|f| f.to_str())
            .unwrap_or("unknown")
            .to_string();

        let outpath = options.destination.join(&filename);

        if let Some(p) = outpath.parent() {
            if !p.exists() {
                fs::create_dir_all(p)
                    .map_err(|e| format!("Failed to create parent directory: {}", e))?;
            }
        }

        if outpath.exists() && !options.overwrite {
            return Ok(());
        }

        let mut decoder = zstd::Decoder::new(buf_reader)
            .map_err(|e| format!("Failed to create zstd decoder: {}", e))?;
        let outfile =
            File::create(&outpath).map_err(|e| format!("Failed to create output file: {}", e))?;
        let mut buf_writer = BufWriter::with_capacity(IO_BUFFER_SIZE, outfile);

        chunked_copy(
            &mut decoder,
            &mut buf_writer,
            &cancel_flag,
            &progress_callback,
            &filename,
            0,
            1,
            0,
            0,
        )?;

        Ok(())
    }

    fn read_entry(&self, path: &Path, _entry_path: &str) -> Result<Vec<u8>, String> {
        let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
        let buf_reader = BufReader::with_capacity(IO_BUFFER_SIZE, file);
        let mut decoder = zstd::Decoder::new(buf_reader)
            .map_err(|e| format!("Failed to create zstd decoder: {}", e))?;
        let mut buf = Vec::new();
        decoder
            .read_to_end(&mut buf)
            .map_err(|e| format!("Failed to decompress: {}", e))?;
        Ok(buf)
    }

    fn supports_create(&self) -> bool {
        false // Zstandard creation not supported in this implementation
    }

    fn extensions(&self) -> Vec<&'static str> {
        vec!["zst"]
    }
}
