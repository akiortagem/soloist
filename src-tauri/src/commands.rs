use serde::Serialize;
use std::{
    collections::HashSet,
    ffi::OsStr,
    fs::{self, File},
    io,
    path::{Component, Path, PathBuf},
    process::Command,
};
use tauri::{AppHandle, Manager};
use zip::ZipArchive;

const PLUGIN_DIR_NAME: &str = "plugins";
const PLUGIN_MANIFEST_FILE: &str = "plugin.json";
const MAX_ARCHIVE_SIZE: u64 = 64 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES: usize = 1_024;
const MAX_ENTRY_SIZE: u64 = 16 * 1024 * 1024;
const MAX_TOTAL_SIZE: u64 = 64 * 1024 * 1024;
const MAX_PATH_LENGTH: usize = 240;
const MAX_PATH_DEPTH: usize = 16;
const MAX_COMPRESSION_RATIO: u64 = 200;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginPackageInstallResult {
    folder_name: String,
    installed_path: String,
    manifest_text: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPluginFolder {
    folder_name: String,
    path: String,
    manifest_text: String,
}

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

#[tauri::command]
pub fn install_plugin_package(
    app: AppHandle,
    file_path: String,
) -> Result<PluginPackageInstallResult, String> {
    let plugin_dir = app_plugin_dir(&app)?;
    install_plugin_package_into(Path::new(&file_path), &plugin_dir)
}

fn install_plugin_package_into(
    package_path: &Path,
    plugin_dir: &Path,
) -> Result<PluginPackageInstallResult, String> {
    if package_path.as_os_str().is_empty() {
        return Err("Choose a .soloist-plugin package to install.".to_string());
    }

    if package_path.extension() != Some(OsStr::new("soloist-plugin")) {
        return Err("Choose a .soloist-plugin package.".to_string());
    }

    let package_size = fs::metadata(package_path)
        .map_err(|error| format!("Plugin package metadata could not be read: {error}"))?
        .len();
    if package_size > MAX_ARCHIVE_SIZE {
        return Err(format!(
            "Plugin package is too large (maximum {} MiB).",
            MAX_ARCHIVE_SIZE / 1024 / 1024
        ));
    }
    let package_file = File::open(package_path)
        .map_err(|error| format!("Plugin package could not be opened: {error}"))?;
    let mut archive = ZipArchive::new(package_file)
        .map_err(|_| "Plugin package is not a readable zip archive.".to_string())?;

    let archive_paths = safe_archive_paths(&mut archive)?;
    let folder_name = plugin_folder_name_from_package_path(package_path)?;
    let target_dir = plugin_dir.join(&folder_name);

    fs::create_dir_all(plugin_dir)
        .map_err(|error| format!("Plugin directory could not be created: {error}"))?;

    let staging = tempfile::Builder::new()
        .prefix(".install-")
        .tempdir_in(plugin_dir)
        .map_err(|error| format!("Temporary plugin folder could not be created: {error}"))?;
    let staged_dir = staging.path().join("plugin");
    fs::create_dir(&staged_dir)
        .map_err(|error| format!("Temporary plugin folder could not be created: {error}"))?;

    for (index, relative_path) in archive_paths.into_iter().enumerate() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| format!("Plugin package entry could not be read: {error}"))?;
        let output_path = staged_dir.join(relative_path);

        if entry.is_dir() {
            fs::create_dir_all(&output_path)
                .map_err(|error| format!("Plugin folder entry could not be created: {error}"))?;
            continue;
        }

        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Plugin package folder could not be created: {error}"))?;
        }

        let mut output = File::create(&output_path)
            .map_err(|error| format!("Plugin package file could not be created: {error}"))?;
        let expected_size = entry.size();
        let written = io::copy(&mut entry, &mut output)
            .map_err(|error| format!("Plugin package file could not be written: {error}"))?;
        if written != expected_size {
            return Err(format!(
                "Plugin package entry size changed during extraction: {}",
                output_path.display()
            ));
        }
    }

    let manifest_text = fs::read_to_string(staged_dir.join(PLUGIN_MANIFEST_FILE))
        .map_err(|error| format!("Plugin manifest could not be read after extraction: {error}"))?;
    let plugin_id = validate_staged_plugin(&staged_dir, &manifest_text)?;
    validate_install_conflicts(plugin_dir, &target_dir, &plugin_id)?;

    replace_plugin_dir(&staged_dir, &target_dir, |from, to| fs::rename(from, to))?;

    Ok(PluginPackageInstallResult {
        folder_name,
        installed_path: target_dir.to_string_lossy().into_owned(),
        manifest_text,
    })
}

fn validate_staged_plugin(staged_dir: &Path, manifest_text: &str) -> Result<String, String> {
    let manifest: serde_json::Value = serde_json::from_str(manifest_text)
        .map_err(|error| format!("Plugin manifest is not valid JSON: {error}"))?;
    let object = manifest
        .as_object()
        .ok_or_else(|| "Plugin manifest must be a JSON object.".to_string())?;
    let id = object
        .get("id")
        .and_then(|value| value.as_str())
        .filter(|id| !id.trim().is_empty())
        .ok_or_else(|| "Plugin manifest must contain a non-empty string id.".to_string())?;
    let plugin_type = object
        .get("type")
        .and_then(|value| value.as_str())
        .ok_or_else(|| "Plugin manifest must contain a string type.".to_string())?;
    match plugin_type {
        "data" => {}
        "script" => {
            let entry = object
                .get("entry")
                .and_then(|value| value.as_str())
                .ok_or_else(|| "Script plugin manifest must contain an entry path.".to_string())?;
            let entry_path = safe_archive_path(entry)
                .ok_or_else(|| "Script plugin entry path is unsafe.".to_string())?;
            if !staged_dir.join(entry_path).is_file() {
                return Err(format!(
                    "Script plugin entry was not found in the package: {entry}"
                ));
            }
        }
        other => return Err(format!("Plugin manifest type is unsupported: {other}")),
    }
    Ok(id.to_string())
}

fn validate_install_conflicts(
    plugin_dir: &Path,
    target_dir: &Path,
    plugin_id: &str,
) -> Result<(), String> {
    for entry in fs::read_dir(plugin_dir)
        .map_err(|error| format!("Plugin directory could not be read: {error}"))?
    {
        let entry = entry.map_err(|error| format!("Plugin folder could not be read: {error}"))?;
        if !entry
            .file_type()
            .map_err(|error| format!("Plugin folder metadata could not be read: {error}"))?
            .is_dir()
            || entry
                .path()
                .file_name()
                .and_then(OsStr::to_str)
                .is_some_and(|name| name.starts_with(".install-") || name.starts_with(".backup-"))
        {
            continue;
        }
        let manifest_path = entry.path().join(PLUGIN_MANIFEST_FILE);
        if entry.path() == target_dir {
            if !manifest_path.is_file() {
                return Err(format!(
                    "Plugin folder conflict: {} already exists and is not an installed plugin.",
                    entry.file_name().to_string_lossy()
                ));
            }
            let existing = fs::read_to_string(&manifest_path)
                .map_err(|error| format!("Existing plugin manifest could not be read: {error}"))?;
            let existing_id = serde_json::from_str::<serde_json::Value>(&existing)
                .ok()
                .and_then(|value| {
                    value
                        .get("id")
                        .and_then(|id| id.as_str())
                        .map(str::to_owned)
                });
            if existing_id.as_deref() != Some(plugin_id) {
                return Err(format!(
                    "Plugin folder conflict: {} belongs to a different plugin.",
                    entry.file_name().to_string_lossy()
                ));
            }
        } else if manifest_path.is_file() {
            let existing = fs::read_to_string(&manifest_path)
                .map_err(|error| format!("Existing plugin manifest could not be read: {error}"))?;
            if serde_json::from_str::<serde_json::Value>(&existing)
                .ok()
                .and_then(|value| {
                    value
                        .get("id")
                        .and_then(|id| id.as_str())
                        .map(str::to_owned)
                })
                .as_deref()
                == Some(plugin_id)
            {
                return Err(format!(
                    "Plugin id conflict: {plugin_id} is already installed in {}.",
                    entry.file_name().to_string_lossy()
                ));
            }
        }
    }
    Ok(())
}

fn replace_plugin_dir<F>(staged_dir: &Path, target_dir: &Path, mut rename: F) -> Result<(), String>
where
    F: FnMut(&Path, &Path) -> io::Result<()>,
{
    if !target_dir.exists() {
        return rename(staged_dir, target_dir)
            .map_err(|error| format!("Plugin could not be installed: {error}"));
    }
    let parent = target_dir
        .parent()
        .ok_or_else(|| "Plugin target directory is invalid.".to_string())?;
    let backup = tempfile::Builder::new()
        .prefix(".backup-")
        .tempdir_in(parent)
        .map_err(|error| format!("Plugin backup folder could not be created: {error}"))?;
    let backup_path = backup.path().join("plugin");
    rename(target_dir, &backup_path)
        .map_err(|error| format!("Existing plugin could not be backed up: {error}"))?;
    if let Err(error) = rename(staged_dir, target_dir) {
        if let Err(rollback_error) = rename(&backup_path, target_dir) {
            let backup_location = backup.keep();
            return Err(format!("Plugin replacement failed ({error}) and rollback failed ({rollback_error}). Backup remains at {}.", backup_location.display()));
        }
        return Err(format!(
            "Plugin replacement failed and the previous installation was restored: {error}"
        ));
    }
    Ok(())
}

#[tauri::command]
pub fn open_plugin_directory(app: AppHandle) -> Result<String, String> {
    let plugin_dir = app_plugin_dir(&app)?;
    fs::create_dir_all(&plugin_dir)
        .map_err(|error| format!("Plugin directory could not be created: {error}"))?;
    open_path(&plugin_dir)?;
    Ok(plugin_dir.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn list_installed_plugin_folders(app: AppHandle) -> Result<Vec<InstalledPluginFolder>, String> {
    let plugin_dir = app_plugin_dir(&app)?;

    if !plugin_dir.exists() {
        return Ok(Vec::new());
    }

    let mut folders = Vec::new();
    for entry in fs::read_dir(&plugin_dir)
        .map_err(|error| format!("Plugin directory could not be read: {error}"))?
    {
        let entry = entry.map_err(|error| format!("Plugin folder could not be read: {error}"))?;
        let metadata = entry
            .metadata()
            .map_err(|error| format!("Plugin folder metadata could not be read: {error}"))?;

        if !metadata.is_dir() {
            continue;
        }

        let manifest_path = entry.path().join(PLUGIN_MANIFEST_FILE);
        if !manifest_path.is_file() {
            continue;
        }

        let manifest_text = fs::read_to_string(&manifest_path).map_err(|error| {
            format!(
                "Plugin manifest could not be read from {}: {error}",
                entry.file_name().to_string_lossy()
            )
        })?;

        folders.push(InstalledPluginFolder {
            folder_name: entry.file_name().to_string_lossy().into_owned(),
            path: entry.path().to_string_lossy().into_owned(),
            manifest_text,
        });
    }

    folders.sort_by(|a, b| {
        a.folder_name
            .to_ascii_lowercase()
            .cmp(&b.folder_name.to_ascii_lowercase())
            .then_with(|| a.folder_name.cmp(&b.folder_name))
    });

    Ok(folders)
}

#[tauri::command]
pub fn read_plugin_entry(
    app: AppHandle,
    plugin_id: String,
    entry: String,
) -> Result<String, String> {
    let plugin_dir = app_plugin_dir(&app)?;
    read_plugin_entry_from(&plugin_dir, &plugin_id, &entry)
}

fn read_plugin_entry_from(
    plugin_dir: &Path,
    plugin_id: &str,
    entry: &str,
) -> Result<String, String> {
    if plugin_id.trim().is_empty() {
        return Err("Plugin id is required.".to_string());
    }
    let Some(entry_path) = safe_archive_path(entry) else {
        return Err("Script plugin entry path is unsafe.".to_string());
    };

    if !plugin_dir.exists() {
        return Err("Plugin directory does not exist.".to_string());
    }

    for folder_entry in fs::read_dir(&plugin_dir)
        .map_err(|error| format!("Plugin directory could not be read: {error}"))?
    {
        let folder_entry =
            folder_entry.map_err(|error| format!("Plugin folder could not be read: {error}"))?;
        let metadata = folder_entry
            .metadata()
            .map_err(|error| format!("Plugin folder metadata could not be read: {error}"))?;

        if !metadata.is_dir() {
            continue;
        }

        let manifest_path = folder_entry.path().join(PLUGIN_MANIFEST_FILE);
        if !manifest_path.is_file() {
            continue;
        }

        let manifest_text = fs::read_to_string(&manifest_path).map_err(|error| {
            format!(
                "Plugin manifest could not be read from {}: {error}",
                folder_entry.file_name().to_string_lossy()
            )
        })?;
        let manifest: serde_json::Value =
            serde_json::from_str(&manifest_text).map_err(|error| {
                format!(
                    "Plugin manifest could not be parsed from {}: {error}",
                    folder_entry.file_name().to_string_lossy()
                )
            })?;

        if manifest.get("id").and_then(|id| id.as_str()) != Some(plugin_id) {
            continue;
        }

        let absolute_entry_path = folder_entry.path().join(entry_path);
        if !absolute_entry_path.is_file() {
            return Err(format!("Script plugin entry was not found: {entry}"));
        }

        return fs::read_to_string(&absolute_entry_path)
            .map_err(|error| format!("Script plugin entry could not be read: {error}"));
    }

    Err(format!(
        "Installed plugin folder was not found: {plugin_id}"
    ))
}

#[tauri::command]
pub fn uninstall_plugin_folder(app: AppHandle, plugin_id: String) -> Result<bool, String> {
    let plugin_dir = app_plugin_dir(&app)?;
    uninstall_plugin_folder_from(&plugin_dir, &plugin_id)
}

fn uninstall_plugin_folder_from(plugin_dir: &Path, plugin_id: &str) -> Result<bool, String> {
    if plugin_id.trim().is_empty() {
        return Err("Plugin id is required.".to_string());
    }

    if !plugin_dir.exists() {
        return Ok(false);
    }

    for entry in fs::read_dir(&plugin_dir)
        .map_err(|error| format!("Plugin directory could not be read: {error}"))?
    {
        let entry = entry.map_err(|error| format!("Plugin folder could not be read: {error}"))?;
        let metadata = entry
            .metadata()
            .map_err(|error| format!("Plugin folder metadata could not be read: {error}"))?;

        if !metadata.is_dir() {
            continue;
        }

        let manifest_path = entry.path().join(PLUGIN_MANIFEST_FILE);
        if !manifest_path.is_file() {
            continue;
        }

        let manifest_text = fs::read_to_string(&manifest_path).map_err(|error| {
            format!(
                "Plugin manifest could not be read from {}: {error}",
                entry.file_name().to_string_lossy()
            )
        })?;
        let manifest: serde_json::Value =
            serde_json::from_str(&manifest_text).map_err(|error| {
                format!(
                    "Plugin manifest could not be parsed from {}: {error}",
                    entry.file_name().to_string_lossy()
                )
            })?;

        if manifest.get("id").and_then(|id| id.as_str()) == Some(plugin_id) {
            fs::remove_dir_all(entry.path())
                .map_err(|error| format!("Plugin folder could not be removed: {error}"))?;
            return Ok(true);
        }
    }

    Ok(false)
}

fn app_plugin_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("App data directory is unavailable: {error}"))?;
    Ok(app_data_dir.join(PLUGIN_DIR_NAME))
}

fn safe_archive_paths(archive: &mut ZipArchive<File>) -> Result<Vec<PathBuf>, String> {
    if archive.len() > MAX_ARCHIVE_ENTRIES {
        return Err(format!(
            "Plugin package has too many entries (maximum {MAX_ARCHIVE_ENTRIES})."
        ));
    }
    let mut paths = Vec::with_capacity(archive.len());
    let mut seen = HashSet::new();
    let mut total_size = 0u64;
    let mut has_root_manifest = false;

    for index in 0..archive.len() {
        let entry = archive
            .by_index(index)
            .map_err(|error| format!("Plugin package entry could not be read: {error}"))?;
        let entry_name = entry.name().to_string();
        if entry_name.as_bytes().len() > MAX_PATH_LENGTH {
            return Err(format!("Plugin package path is too long: {entry_name}"));
        }
        let Some(relative_path) = safe_archive_path(&entry_name) else {
            return Err(format!(
                "Plugin package contains an unsafe path: {entry_name}"
            ));
        };
        if relative_path.components().count() > MAX_PATH_DEPTH {
            return Err(format!("Plugin package path is too deep: {entry_name}"));
        }
        if !seen.insert(relative_path.clone()) {
            return Err(format!(
                "Plugin package contains a duplicate path: {entry_name}"
            ));
        }
        if relative_path == Path::new(PLUGIN_MANIFEST_FILE) {
            has_root_manifest = true;
        }
        let mode_type =
            entry
                .unix_mode()
                .unwrap_or(if entry.is_dir() { 0o040000 } else { 0o100000 })
                & 0o170000;
        if mode_type != 0o040000 && mode_type != 0o100000 {
            return Err(format!(
                "Plugin package contains an unsupported link or special entry: {entry_name}"
            ));
        }
        if entry.size() > MAX_ENTRY_SIZE {
            return Err(format!("Plugin package entry is too large: {entry_name}"));
        }
        total_size = total_size
            .checked_add(entry.size())
            .ok_or_else(|| "Plugin package expanded size is invalid.".to_string())?;
        if total_size > MAX_TOTAL_SIZE {
            return Err(format!(
                "Plugin package expands beyond the {} MiB limit.",
                MAX_TOTAL_SIZE / 1024 / 1024
            ));
        }
        if entry.size() > 0
            && (entry.compressed_size() == 0
                || entry.size()
                    > entry
                        .compressed_size()
                        .saturating_mul(MAX_COMPRESSION_RATIO))
        {
            return Err(format!(
                "Plugin package entry has a suspicious compression ratio: {entry_name}"
            ));
        }
        paths.push(relative_path);
    }

    if !has_root_manifest {
        return Err("Plugin package must contain plugin.json at the package root.".to_string());
    }

    Ok(paths)
}

fn safe_archive_path(entry_name: &str) -> Option<PathBuf> {
    let path = Path::new(entry_name);
    let mut safe_path = PathBuf::new();

    for component in path.components() {
        match component {
            Component::Normal(part) => safe_path.push(part),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => return None,
        }
    }

    if safe_path.as_os_str().is_empty() {
        None
    } else {
        Some(safe_path)
    }
}

fn plugin_folder_name_from_package_path(package_path: &Path) -> Result<String, String> {
    let stem = package_path
        .file_stem()
        .and_then(OsStr::to_str)
        .ok_or_else(|| "Plugin package file name is invalid.".to_string())?;
    let folder_name = stem
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string();

    if folder_name.is_empty() {
        Err("Plugin package file name is invalid.".to_string())
    } else {
        Ok(folder_name)
    }
}

fn open_path(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("explorer");
        command.arg(path);
        command
    };

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg(path);
        command
    };

    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(path);
        command
    };

    command
        .spawn()
        .map_err(|error| format!("Plugin directory could not be opened: {error}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        install_plugin_package_into, read_plugin_entry_from, replace_plugin_dir, safe_archive_path,
        uninstall_plugin_folder_from, MAX_ARCHIVE_ENTRIES, MAX_ENTRY_SIZE,
    };
    use std::{
        fs,
        io::Write,
        path::{Path, PathBuf},
    };
    use tempfile::TempDir;
    use zip::{write::SimpleFileOptions, ZipWriter};

    const MANIFEST: &str = r#"{
  "id": "soloist-plugin.e2e",
  "name": "Packaged E2E Plugin",
  "version": "1.0.0",
  "soloistApiVersion": "1",
  "type": "script",
  "entry": "dist/plugin.js",
  "permissions": ["storage", "slashCommands:register", "document:insertBlock"]
}"#;
    const ENTRY: &str = "module.exports = { activate(api) { api.registerSlashCommand({ id: 'hello', name: 'hello', label: 'Hello', prefix: '/hello', handler() { return { type: 'deleteCommand' }; } }); } };";

    fn package(root: &Path, name: &str, entries: &[(&str, &str)]) -> PathBuf {
        let path = root.join(format!("{name}.soloist-plugin"));
        let file = fs::File::create(&path).unwrap();
        let mut zip = ZipWriter::new(file);
        let options = SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated)
            .last_modified_time(zip::DateTime::default());
        for (entry_name, contents) in entries {
            zip.start_file(*entry_name, options).unwrap();
            zip.write_all(contents.as_bytes()).unwrap();
        }
        zip.finish().unwrap();
        path
    }

    #[test]
    fn safe_archive_path_accepts_relative_plugin_paths() {
        assert_eq!(
            safe_archive_path("assets/tables/omens.json"),
            Some(PathBuf::from("assets/tables/omens.json"))
        );
        assert_eq!(
            safe_archive_path("./plugin.json"),
            Some(PathBuf::from("plugin.json"))
        );
    }

    #[test]
    fn safe_archive_path_rejects_paths_that_escape_target() {
        assert_eq!(safe_archive_path("../plugin.json"), None);
        assert_eq!(safe_archive_path("assets/../../plugin.json"), None);
        assert_eq!(safe_archive_path("/tmp/plugin.json"), None);
        assert_eq!(safe_archive_path(""), None);
    }

    #[test]
    fn packaged_plugin_installs_reads_entry_and_uninstalls() {
        let temp = TempDir::new().unwrap();
        let package_path = package(
            temp.path(),
            "packaged-e2e",
            &[("plugin.json", MANIFEST), ("dist/plugin.js", ENTRY)],
        );
        let plugin_dir = temp.path().join("app-data/plugins");

        let installed = install_plugin_package_into(&package_path, &plugin_dir).unwrap();

        assert_eq!(installed.folder_name, "packaged-e2e");
        assert_eq!(installed.manifest_text, MANIFEST);
        assert_eq!(
            read_plugin_entry_from(&plugin_dir, "soloist-plugin.e2e", "dist/plugin.js").unwrap(),
            ENTRY,
        );
        assert!(Path::new(&installed.installed_path)
            .join("plugin.json")
            .is_file());
        assert!(uninstall_plugin_folder_from(&plugin_dir, "soloist-plugin.e2e").unwrap());
        assert!(!Path::new(&installed.installed_path).exists());
    }

    #[test]
    fn package_requires_a_root_manifest_and_existing_entry() {
        let temp = TempDir::new().unwrap();
        let plugin_dir = temp.path().join("plugins");
        let nested = package(temp.path(), "nested", &[("nested/plugin.json", MANIFEST)]);
        assert!(install_plugin_package_into(&nested, &plugin_dir)
            .unwrap_err()
            .contains("plugin.json at the package root"));

        let missing = package(temp.path(), "missing-entry", &[("plugin.json", MANIFEST)]);
        assert!(install_plugin_package_into(&missing, &plugin_dir)
            .unwrap_err()
            .contains("entry was not found in the package"));
    }

    #[test]
    fn unsafe_package_and_entry_paths_do_not_escape_or_mutate_unrelated_state() {
        let temp = TempDir::new().unwrap();
        let plugin_dir = temp.path().join("plugins");
        fs::create_dir_all(&plugin_dir).unwrap();
        let sentinel = plugin_dir.join("keep.txt");
        fs::write(&sentinel, "keep").unwrap();
        let malicious = package(
            temp.path(),
            "malicious",
            &[("plugin.json", MANIFEST), ("../escaped.js", ENTRY)],
        );

        assert!(install_plugin_package_into(&malicious, &plugin_dir)
            .unwrap_err()
            .contains("unsafe path"));
        assert_eq!(fs::read_to_string(sentinel).unwrap(), "keep");
        assert!(!temp.path().join("escaped.js").exists());
        assert!(
            read_plugin_entry_from(&plugin_dir, "soloist-plugin.e2e", "../keep.txt")
                .unwrap_err()
                .contains("entry path is unsafe")
        );
    }

    #[test]
    fn package_limits_reject_oversized_files_and_excessive_entries() {
        let temp = TempDir::new().unwrap();
        let plugin_dir = temp.path().join("plugins");
        let archive = temp.path().join("archive-size.soloist-plugin");
        let file = fs::File::create(&archive).unwrap();
        file.set_len(super::MAX_ARCHIVE_SIZE + 1).unwrap();
        assert!(install_plugin_package_into(&archive, &plugin_dir)
            .unwrap_err()
            .contains("package is too large"));

        let oversized = "x".repeat((MAX_ENTRY_SIZE + 1) as usize);
        let oversized_package = package(
            temp.path(),
            "oversized",
            &[("plugin.json", MANIFEST), ("huge.bin", &oversized)],
        );
        assert!(install_plugin_package_into(&oversized_package, &plugin_dir)
            .unwrap_err()
            .contains("entry is too large"));

        let path = temp.path().join("many.soloist-plugin");
        let mut zip = ZipWriter::new(fs::File::create(&path).unwrap());
        for index in 0..=MAX_ARCHIVE_ENTRIES {
            zip.start_file(format!("file-{index}"), SimpleFileOptions::default())
                .unwrap();
        }
        zip.finish().unwrap();
        assert!(install_plugin_package_into(&path, &plugin_dir)
            .unwrap_err()
            .contains("too many entries"));
    }

    #[test]
    fn package_rejects_links() {
        let temp = TempDir::new().unwrap();
        let path = temp.path().join("linked.soloist-plugin");
        let mut zip = ZipWriter::new(fs::File::create(&path).unwrap());
        zip.start_file("plugin.json", SimpleFileOptions::default())
            .unwrap();
        zip.write_all(MANIFEST.as_bytes()).unwrap();
        zip.add_symlink("dist/plugin.js", "target.js", SimpleFileOptions::default())
            .unwrap();
        zip.finish().unwrap();
        assert!(
            install_plugin_package_into(&path, &temp.path().join("plugins"))
                .unwrap_err()
                .contains("unsupported link")
        );
    }

    #[test]
    fn failed_update_preserves_install_and_cleans_staging() {
        let temp = TempDir::new().unwrap();
        let plugin_dir = temp.path().join("plugins");
        let good = package(
            temp.path(),
            "same-name",
            &[("plugin.json", MANIFEST), ("dist/plugin.js", ENTRY)],
        );
        install_plugin_package_into(&good, &plugin_dir).unwrap();
        let broken = package(temp.path(), "same-name", &[("plugin.json", MANIFEST)]);
        assert!(install_plugin_package_into(&broken, &plugin_dir).is_err());
        assert_eq!(
            fs::read_to_string(plugin_dir.join("same-name/dist/plugin.js")).unwrap(),
            ENTRY
        );
        assert!(fs::read_dir(&plugin_dir).unwrap().all(|entry| !entry
            .unwrap()
            .file_name()
            .to_string_lossy()
            .starts_with(".install-")));
    }

    #[test]
    fn replacement_failure_rolls_back_previous_directory() {
        let temp = TempDir::new().unwrap();
        let target = temp.path().join("plugin");
        let staged = temp.path().join("staged");
        fs::create_dir(&target).unwrap();
        fs::create_dir(&staged).unwrap();
        fs::write(target.join("version"), "old").unwrap();
        fs::write(staged.join("version"), "new").unwrap();
        let mut calls = 0;
        let error = replace_plugin_dir(&staged, &target, |from, to| {
            calls += 1;
            if calls == 2 {
                Err(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    "injected failure",
                ))
            } else {
                fs::rename(from, to)
            }
        })
        .unwrap_err();
        assert!(error.contains("previous installation was restored"));
        assert_eq!(fs::read_to_string(target.join("version")).unwrap(), "old");
    }
}
