use tauri_plugin_sql::{Migration, MigrationKind};

pub const DATABASE_URL: &str = "sqlite:soloist.db";

pub fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_sessions",
            sql: r#"
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                document_id TEXT NOT NULL,
                chaos_factor INTEGER NOT NULL DEFAULT 5,
                active_character_sheet_id TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
"#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_documents",
            sql: r#"
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY NOT NULL,
                session_id TEXT NOT NULL,
                title TEXT NOT NULL,
                content_markdown TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
            );
"#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create_character_sheets",
            sql: r#"
            CREATE TABLE IF NOT EXISTS character_sheets (
                id TEXT PRIMARY KEY NOT NULL,
                session_id TEXT NOT NULL,
                name TEXT NOT NULL,
                fields_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
            );
"#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "create_character_sheet_templates",
            sql: r#"
            CREATE TABLE IF NOT EXISTS character_sheet_templates (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                fields_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
"#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "create_combat_states",
            sql: r#"
            CREATE TABLE IF NOT EXISTS combat_states (
                id TEXT PRIMARY KEY NOT NULL,
                session_id TEXT NOT NULL UNIQUE,
                active INTEGER NOT NULL,
                combatants_json TEXT NOT NULL,
                current_turn_index INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
            );
"#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "create_app_settings",
            sql: r#"
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY NOT NULL,
                value_json TEXT NOT NULL
            );
"#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "index_documents_session_id",
            sql: "CREATE INDEX IF NOT EXISTS idx_documents_session_id ON documents(session_id);",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "index_character_sheets_session_id",
            sql: "CREATE INDEX IF NOT EXISTS idx_character_sheets_session_id ON character_sheets(session_id);",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "index_combat_states_session_id",
            sql: "CREATE INDEX IF NOT EXISTS idx_combat_states_session_id ON combat_states(session_id);",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "add_character_sheet_template_id",
            sql: "ALTER TABLE character_sheets ADD COLUMN template_id TEXT;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "add_character_sheet_template_name",
            sql: "ALTER TABLE character_sheets ADD COLUMN template_name TEXT;",
            kind: MigrationKind::Up,
        },
    ]
}
