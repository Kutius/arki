use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use super::settings::SettingsService;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HistoryEntry {
    pub path: String,
    pub name: String,
    pub format: String,
    pub last_opened: String,
    pub is_favorite: bool,
}

pub struct HistoryService;

impl HistoryService {
    fn get_history_path() -> PathBuf {
        SettingsService::get_data_dir().join("history.json")
    }

    pub fn get_history() -> Vec<HistoryEntry> {
        let path = Self::get_history_path();
        if !path.exists() {
            return Vec::new();
        }

        let content = std::fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or_default()
    }

    fn save_history(entries: &[HistoryEntry]) -> Result<(), String> {
        let path = Self::get_history_path();
        let content =
            serde_json::to_string_pretty(entries).map_err(|e| format!("Failed to serialize: {}", e))?;
        std::fs::write(&path, content).map_err(|e| format!("Failed to write history: {}", e))?;
        Ok(())
    }

    pub fn add_to_history(path: &str, name: &str, format: &str) -> Result<(), String> {
        let mut entries = Self::get_history();

        // Remove existing entry with same path
        entries.retain(|e| e.path != path);

        // Add to front
        entries.insert(
            0,
            HistoryEntry {
                path: path.to_string(),
                name: name.to_string(),
                format: format.to_string(),
                last_opened: chrono::Local::now().to_rfc3339(),
                is_favorite: false,
            },
        );

        // Keep max 50 entries
        entries.truncate(50);

        Self::save_history(&entries)
    }

    pub fn remove_from_history(path: &str) -> Result<(), String> {
        let mut entries = Self::get_history();
        entries.retain(|e| e.path != path);
        Self::save_history(&entries)
    }

    pub fn toggle_favorite(path: &str) -> Result<bool, String> {
        let mut entries = Self::get_history();
        let entry = entries.iter_mut().find(|e| e.path == path);

        match entry {
            Some(entry) => {
                entry.is_favorite = !entry.is_favorite;
                let is_fav = entry.is_favorite;
                Self::save_history(&entries)?;
                Ok(is_fav)
            }
            None => Err("Entry not found in history".to_string()),
        }
    }

    pub fn clear_history() -> Result<(), String> {
        Self::save_history(&[])
    }
}
