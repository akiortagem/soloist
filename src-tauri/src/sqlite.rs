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
        Migration {
            version: 12,
            description: "add_combat_round_number",
            sql: "ALTER TABLE combat_states ADD COLUMN round_number INTEGER NOT NULL DEFAULT 1;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "add_character_sheet_nick",
            sql: "ALTER TABLE character_sheets ADD COLUMN nick TEXT;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 14,
            description: "unique_character_sheet_nick_per_session",
            sql: "CREATE UNIQUE INDEX IF NOT EXISTS idx_character_sheets_session_nick ON character_sheets(session_id, nick) WHERE nick IS NOT NULL;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 15,
            description: "add_document_tree_metadata",
            sql: r#"
            ALTER TABLE documents ADD COLUMN parent_id TEXT;
            ALTER TABLE documents ADD COLUMN kind TEXT NOT NULL DEFAULT 'session';
            ALTER TABLE documents ADD COLUMN folder_kind TEXT;

            INSERT OR IGNORE INTO documents
                (id, session_id, parent_id, kind, folder_kind, title, content_markdown, created_at, updated_at)
            SELECT
                'characters_folder_' || sessions.id,
                sessions.id,
                NULL,
                'folder',
                'characters',
                'Characters',
                '',
                sessions.created_at,
                sessions.created_at
            FROM sessions;

            INSERT OR IGNORE INTO documents
                (id, session_id, parent_id, kind, folder_kind, title, content_markdown, created_at, updated_at)
            SELECT
                'sessions_folder_' || sessions.id,
                sessions.id,
                NULL,
                'folder',
                'sessions',
                'Sessions',
                '',
                sessions.created_at,
                sessions.created_at
            FROM sessions;

            UPDATE documents
            SET parent_id = 'sessions_folder_' || session_id,
                kind = 'session',
                folder_kind = NULL
            WHERE kind = 'session'
              AND parent_id IS NULL
              AND id NOT LIKE 'characters_folder_%'
              AND id NOT LIKE 'sessions_folder_%';

            CREATE INDEX IF NOT EXISTS idx_documents_session_parent ON documents(session_id, parent_id);
"#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 16,
            description: "add_document_character_sheet_link",
            sql: "ALTER TABLE documents ADD COLUMN character_sheet_id TEXT;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 17,
            description: "create_installed_plugins",
            sql: r#"
            CREATE TABLE IF NOT EXISTS installed_plugins (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                version TEXT NOT NULL,
                type TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                manifest_json TEXT NOT NULL,
                installed_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
"#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 18,
            description: "create_plugin_storage",
            sql: r#"
            CREATE TABLE IF NOT EXISTS plugin_storage (
                plugin_id TEXT NOT NULL,
                key TEXT NOT NULL,
                value_json TEXT NOT NULL,
                PRIMARY KEY (plugin_id, key),
                FOREIGN KEY (plugin_id) REFERENCES installed_plugins(id) ON DELETE CASCADE
            );
"#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 19,
            description: "add_character_sheet_template_plugin_provenance",
            sql: r#"
            ALTER TABLE character_sheet_templates ADD COLUMN source_plugin_id TEXT;
            ALTER TABLE character_sheet_templates ADD COLUMN source_contribution_id TEXT;
            CREATE INDEX IF NOT EXISTS idx_character_sheet_templates_plugin_source
                ON character_sheet_templates(source_plugin_id, source_contribution_id);
"#,
            kind: MigrationKind::Up,
        },
    ]
}
