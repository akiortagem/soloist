use std::{fs, path::PathBuf};

#[tauri::command]
pub fn export_plugin_manifest(file_path: String, contents: String) -> Result<String, String> {
    if file_path.trim().is_empty() {
        return Err("Choose a path for plugin export".to_string());
    }

    let export_path = PathBuf::from(file_path);

    if let Some(parent) = export_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    fs::write(&export_path, contents).map_err(|error| error.to_string())?;

    Ok(export_path.to_string_lossy().into_owned())
}
