use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub default_extract_path: Option<String>,
    pub default_compression_level: u8,
    pub theme: String, // "dark" | "light" | "system"
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            default_extract_path: None,
            default_compression_level: 6,
            theme: "dark".to_string(),
        }
    }
}

pub struct SettingsService;

impl SettingsService {
    pub fn get_data_dir() -> PathBuf {
        let data_dir = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("arki");
        std::fs::create_dir_all(&data_dir).ok();
        data_dir
    }

    fn get_settings_path() -> PathBuf {
        Self::get_data_dir().join("settings.json")
    }

    pub fn get_settings() -> Settings {
        let path = Self::get_settings_path();
        if !path.exists() {
            return Settings::default();
        }

        let content = std::fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or_default()
    }

    pub fn save_settings(settings: &Settings) -> Result<(), String> {
        let path = Self::get_settings_path();
        let content = serde_json::to_string_pretty(settings)
            .map_err(|e| format!("Failed to serialize: {}", e))?;
        std::fs::write(&path, content)
            .map_err(|e| format!("Failed to write settings: {}", e))?;
        Ok(())
    }
}
