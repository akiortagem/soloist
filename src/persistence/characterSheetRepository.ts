import type Database from "@tauri-apps/plugin-sql";
import { createId, nowIso } from "./id";

export type CharacterSheetRecord = {
  id: string;
  sessionId: string;
  name: string;
  fieldsJson: string;
  createdAt: string;
  updatedAt: string;
};

export type CharacterSheetTemplateRecord = {
  id: string;
  name: string;
  fieldsJson: string;
  createdAt: string;
  updatedAt: string;
};

export class CharacterSheetRepository {
  constructor(private readonly db: Database) {}

  async create(input: { sessionId: string; name: string; fieldsJson?: string }) {
    const timestamp = nowIso();
    const sheet: CharacterSheetRecord = {
      id: createId("sheet"),
      sessionId: input.sessionId,
      name: input.name,
      fieldsJson: input.fieldsJson ?? "[]",
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
        sheet.fieldsJson,
        sheet.createdAt,
        sheet.updatedAt,
      ],
    );

    return sheet;
  }

  async createTemplate(input: { name: string; fieldsJson?: string }) {
    const timestamp = nowIso();
    const template: CharacterSheetTemplateRecord = {
      id: createId("template"),
      name: input.name,
      fieldsJson: input.fieldsJson ?? "[]",
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
        template.fieldsJson,
        template.createdAt,
        template.updatedAt,
      ],
    );

    return template;
  }
}
