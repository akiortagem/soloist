import type Database from "@tauri-apps/plugin-sql";
import type {
  CharacterField,
  CharacterSheet,
  CharacterSheetTemplate,
  CharacterTemplateField,
} from "../domain/domainTypes";
import { createId, nowIso } from "./id";

export type CharacterSheetRecord = CharacterSheet;
export type CharacterSheetTemplateRecord = CharacterSheetTemplate;

type CharacterSheetRow = {
  id: string;
  session_id: string;
  name: string;
  fields_json: string;
  created_at: string;
  updated_at: string;
};

type CharacterSheetTemplateRow = {
  id: string;
  name: string;
  fields_json: string;
  created_at: string;
  updated_at: string;
};

function parseJsonArray<T>(value: string): T[] {
  const parsed: unknown = JSON.parse(value);
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}

function mapCharacterSheet(row: CharacterSheetRow): CharacterSheetRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    name: row.name,
    fields: parseJsonArray<CharacterField>(row.fields_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCharacterSheetTemplate(
  row: CharacterSheetTemplateRow,
): CharacterSheetTemplateRecord {
  return {
    id: row.id,
    name: row.name,
    fields: parseJsonArray<CharacterTemplateField>(row.fields_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class CharacterSheetRepository {
  constructor(private readonly db: Database) {}

  async listBySessionId(sessionId: string) {
    const rows = await this.db.select<CharacterSheetRow[]>(
      `SELECT id, session_id, name, fields_json, created_at, updated_at
       FROM character_sheets
       WHERE session_id = $1
       ORDER BY updated_at DESC`,
      [sessionId],
    );

    return rows.map(mapCharacterSheet);
  }

  async get(id: string) {
    const rows = await this.db.select<CharacterSheetRow[]>(
      `SELECT id, session_id, name, fields_json, created_at, updated_at
       FROM character_sheets
       WHERE id = $1
       LIMIT 1`,
      [id],
    );

    return rows[0] ? mapCharacterSheet(rows[0]) : null;
  }

  async create(input: {
    sessionId: string;
    name: string;
    fields?: CharacterField[];
  }) {
    const timestamp = nowIso();
    const sheet: CharacterSheetRecord = {
      id: createId("sheet"),
      sessionId: input.sessionId,
      name: input.name,
      fields: input.fields ?? [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await this.db.execute(
      `INSERT INTO character_sheets
       (id, session_id, name, fields_json, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        sheet.id,
        sheet.sessionId,
        sheet.name,
        JSON.stringify(sheet.fields),
        sheet.createdAt,
        sheet.updatedAt,
      ],
    );

    return sheet;
  }

  async update(input: {
    id: string;
    name?: string;
    fields?: CharacterField[];
  }) {
    const current = await this.get(input.id);

    if (!current) {
      return null;
    }

    const updated: CharacterSheetRecord = {
      ...current,
      name: input.name ?? current.name,
      fields: input.fields ?? current.fields,
      updatedAt: nowIso(),
    };

    await this.db.execute(
      `UPDATE character_sheets
       SET name = $1,
           fields_json = $2,
           updated_at = $3
       WHERE id = $4`,
      [
        updated.name,
        JSON.stringify(updated.fields),
        updated.updatedAt,
        updated.id,
      ],
    );

    return updated;
  }

  async listTemplates() {
    const rows = await this.db.select<CharacterSheetTemplateRow[]>(
      `SELECT id, name, fields_json, created_at, updated_at
       FROM character_sheet_templates
       ORDER BY updated_at DESC`,
    );

    return rows.map(mapCharacterSheetTemplate);
  }

  async createTemplate(input: {
    name: string;
    fields?: CharacterTemplateField[];
  }) {
    const timestamp = nowIso();
    const template: CharacterSheetTemplateRecord = {
      id: createId("template"),
      name: input.name,
      fields: input.fields ?? [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await this.db.execute(
      `INSERT INTO character_sheet_templates
       (id, name, fields_json, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        template.id,
        template.name,
        JSON.stringify(template.fields),
        template.createdAt,
        template.updatedAt,
      ],
    );

    return template;
  }
}
