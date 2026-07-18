#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
mod sqlite;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::export_plugin_manifest,
            commands::install_plugin_package,
            commands::open_plugin_directory,
            commands::list_installed_plugin_folders,
            commands::read_plugin_entry,
            commands::uninstall_plugin_folder,
        ])
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(sqlite::DATABASE_URL, sqlite::migrations())
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running Soloist");
}
