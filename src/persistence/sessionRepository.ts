import type Database from "@tauri-apps/plugin-sql";
import { CharacterSheetRepository } from "./characterSheetRepository";
import { CombatRepository } from "./combatRepository";
import { getDatabase } from "./database";
import { DocumentRepository } from "./documentRepository";
import { createId, nowIso } from "./id";
import { SettingsRepository } from "./settingsRepository";

export type SessionRecord = {
  id: string;
  name: string;
  documentId: string;
  chaosFactor: number;
  activeCharacterSheetId?: string;
  createdAt: string;
  updatedAt: string;
};

type SessionRow = {
  id: string;
  name: string;
  document_id: string;
  chaos_factor: number;
  active_character_sheet_id: string | null;
  created_at: string;
  updated_at: string;
};

function mapSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    name: row.name,
    documentId: row.document_id,
    chaosFactor: row.chaos_factor,
    activeCharacterSheetId: row.active_character_sheet_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SessionRepository {
  constructor(private readonly db: Database) {}

  async list() {
    const rows = await this.db.select<SessionRow[]>(
      `SELECT id, name, document_id, chaos_factor, active_character_sheet_id, created_at, updated_at
       FROM sessions
       ORDER BY updated_at DESC`,
    );

    return rows.map(mapSession);
  }

  async get(id: string) {
    const rows = await this.db.select<SessionRow[]>(
      `SELECT id, name, document_id, chaos_factor, active_character_sheet_id, created_at, updated_at
       FROM sessions
       WHERE id = $1
       LIMIT 1`,
      [id],
    );

    return rows[0] ? mapSession(rows[0]) : null;
  }

  async create(input: { name: string; chaosFactor?: number }) {
    const timestamp = nowIso();
    const sessionId = createId("session");
    const documentId = createId("document");
    const session: SessionRecord = {
      id: sessionId,
      name: input.name,
      documentId,
      chaosFactor: input.chaosFactor ?? 5,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await this.db.execute(
      `INSERT INTO sessions
       (id, name, document_id, chaos_factor, active_character_sheet_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        session.id,
        session.name,
        session.documentId,
        session.chaosFactor,
        session.activeCharacterSheetId ?? null,
        session.createdAt,
        session.updatedAt,
      ],
    );

    await this.db.execute(
      `INSERT INTO documents
       (id, session_id, title, content_markdown, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        documentId,
        sessionId,
        input.name,
        "",
        timestamp,
        timestamp,
      ],
    );

    return session;
  }
}

export async function createRepositories() {
  const db = await getDatabase();

  return {
    characterSheets: new CharacterSheetRepository(db),
    combat: new CombatRepository(db),
    documents: new DocumentRepository(db),
    sessions: new SessionRepository(db),
    settings: new SettingsRepository(db),
  };
}
