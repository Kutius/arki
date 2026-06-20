use std::collections::HashMap;
use std::path::Path;
use std::sync::LazyLock;

use super::archive_handler::ArchiveHandler;
use super::handlers::brotli::BrotliHandler;
use super::handlers::gz::GzHandler;
use super::handlers::rar::RarHandler;
use super::handlers::sevenz::SevenzHandler;
use super::handlers::tar::TarHandler;
use super::handlers::tar_gz::TarGzHandler;
use super::handlers::zip::ZipHandler;
use super::handlers::zstd::ZstdHandler;

pub struct FormatDispatcher {
    handlers: Vec<Box<dyn ArchiveHandler>>,
    ext_map: HashMap<String, usize>,
}

impl FormatDispatcher {
    pub fn new() -> Self {
        let handlers: Vec<Box<dyn ArchiveHandler>> = vec![
            Box::new(ZipHandler),
            Box::new(TarGzHandler),
            Box::new(TarHandler),
            Box::new(GzHandler),
            Box::new(BrotliHandler),
            Box::new(ZstdHandler),
            Box::new(SevenzHandler),
            Box::new(RarHandler),
        ];

        let mut ext_map = HashMap::new();
        for (idx, handler) in handlers.iter().enumerate() {
            for ext in handler.extensions() {
                ext_map.insert(ext.to_string(), idx);
            }
        }

        Self { handlers, ext_map }
    }

    pub fn detect_format(&self, path: &Path) -> Result<String, String> {
        let filename = path
            .file_name()
            .and_then(|f| f.to_str())
            .unwrap_or("")
            .to_lowercase();

        // Check double extensions first
        if filename.ends_with(".tar.gz") {
            return Ok("tar.gz".to_string());
        }
        if filename.ends_with(".tar.bz2") {
            return Ok("tar.bz2".to_string());
        }
        if filename.ends_with(".tgz") {
            return Ok("tar.gz".to_string());
        }

        // Single extension fallback
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        if self.ext_map.contains_key(&ext) {
            return Ok(ext);
        }

        Err(format!("Unsupported archive format: {}", ext))
    }

    pub fn get_handler(&self, format: &str) -> Result<&dyn ArchiveHandler, String> {
        let idx = self
            .ext_map
            .get(format)
            .ok_or_else(|| format!("No handler for format: {}", format))?;
        Ok(self.handlers[*idx].as_ref())
    }
}

pub static DISPATCHER: LazyLock<FormatDispatcher> = LazyLock::new(FormatDispatcher::new);
