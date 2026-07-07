import type Database from "@tauri-apps/plugin-sql";
import type {
  CharacterField,
  CharacterSheet,
  CharacterSheetTemplate,
  CharacterTemplateItem,
} from "../domain/domainTypes";
import { createId, nowIso } from "./id";

export type CharacterSheetRecord = CharacterSheet;
export type CharacterSheetTemplateRecord = CharacterSheetTemplate;

type CharacterSheetRow = {
  id: string;
  session_id: string;
  name: string;
  nick: string | null;
  template_id: string | null;
  template_name: string | null;
  fields_json: string;
  created_at: string;
  updated_at: string;
};

type CharacterSheetTemplateRow = {
  id: string;
  name: string;
  fields_json: string;
  source_plugin_id: string | null;
  source_contribution_id: string | null;
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
    nick: row.nick ?? undefined,
    templateId: row.template_id ?? undefined,
    templateName: row.template_name ?? undefined,
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
    fields: parseJsonArray<CharacterTemplateItem>(row.fields_json),
    sourcePluginId: row.source_plugin_id ?? undefined,
    sourceContributionId: row.source_contribution_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class CharacterSheetRepository {
  constructor(private readonly db: Database) {}

  async listBySessionId(sessionId: string) {
    const rows = await this.db.select<CharacterSheetRow[]>(
      `SELECT id, session_id, name, nick, template_id, template_name, fields_json, created_at, updated_at
       FROM character_sheets
       WHERE session_id = $1
       ORDER BY updated_at DESC`,
      [sessionId],
    );

    return rows.map(mapCharacterSheet);
  }

  async listByTemplateId(templateId: string) {
    const rows = await this.db.select<CharacterSheetRow[]>(
      `SELECT id, session_id, name, nick, template_id, template_name, fields_json, created_at, updated_at
       FROM character_sheets
       WHERE template_id = $1
       ORDER BY updated_at DESC`,
      [templateId],
    );

    return rows.map(mapCharacterSheet);
  }

  async get(id: string) {
    const rows = await this.db.select<CharacterSheetRow[]>(
      `SELECT id, session_id, name, nick, template_id, template_name, fields_json, created_at, updated_at
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
    nick?: string | null;
    templateId?: string;
    templateName?: string;
    fields?: CharacterField[];
  }) {
    const timestamp = nowIso();
    const sheet: CharacterSheetRecord = {
      id: createId("sheet"),
      sessionId: input.sessionId,
      name: input.name,
      nick: input.nick ?? undefined,
      templateId: input.templateId,
      templateName: input.templateName,
      fields: input.fields ?? [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await this.db.execute(
      `INSERT INTO character_sheets
       (id, session_id, name, nick, template_id, template_name, fields_json, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        sheet.id,
        sheet.sessionId,
        sheet.name,
        sheet.nick ?? null,
        sheet.templateId ?? null,
        sheet.templateName ?? null,
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
    nick?: string | null;
    templateId?: string | null;
    templateName?: string | null;
    fields?: CharacterField[];
  }) {
    const current = await this.get(input.id);

    if (!current) {
      return null;
    }

    const updated: CharacterSheetRecord = {
      ...current,
      name: input.name ?? current.name,
      nick: input.nick === undefined ? current.nick : (input.nick ?? undefined),
      templateId:
        input.templateId === undefined ? current.templateId : (input.templateId ?? undefined),
      templateName:
        input.templateName === undefined
          ? current.templateName
          : (input.templateName ?? undefined),
      fields: input.fields ?? current.fields,
      updatedAt: nowIso(),
    };

    await this.db.execute(
      `UPDATE character_sheets
       SET name = $1,
           nick = $2,
           template_id = $3,
           template_name = $4,
           fields_json = $5,
           updated_at = $6
       WHERE id = $7`,
      [
        updated.name,
        updated.nick ?? null,
        updated.templateId ?? null,
        updated.templateName ?? null,
        JSON.stringify(updated.fields),
        updated.updatedAt,
        updated.id,
      ],
    );

    return updated;
  }

  async delete(id: string) {
    await this.db.execute(
      `DELETE FROM character_sheets
       WHERE id = $1`,
      [id],
    );
  }

  async listTemplates() {
    const rows = await this.db.select<CharacterSheetTemplateRow[]>(
      `SELECT id, name, fields_json, source_plugin_id, source_contribution_id, created_at, updated_at
       FROM character_sheet_templates
       ORDER BY updated_at DESC`,
    );

    return rows.map(mapCharacterSheetTemplate);
  }

  async createTemplate(input: {
    name: string;
    fields?: CharacterTemplateItem[];
    sourcePluginId?: string;
    sourceContributionId?: string;
  }) {
    const timestamp = nowIso();
    const template: CharacterSheetTemplateRecord = {
      id: createId("template"),
      name: input.name,
      fields: input.fields ?? [],
      sourcePluginId: input.sourcePluginId,
      sourceContributionId: input.sourceContributionId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await this.db.execute(
      `INSERT INTO character_sheet_templates
       (id, name, fields_json, source_plugin_id, source_contribution_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        template.id,
        template.name,
        JSON.stringify(template.fields),
        template.sourcePluginId ?? null,
        template.sourceContributionId ?? null,
        template.createdAt,
        template.updatedAt,
      ],
    );

    return template;
  }

  async getTemplate(id: string) {
    const rows = await this.db.select<CharacterSheetTemplateRow[]>(
      `SELECT id, name, fields_json, source_plugin_id, source_contribution_id, created_at, updated_at
       FROM character_sheet_templates
       WHERE id = $1
       LIMIT 1`,
      [id],
    );

    return rows[0] ? mapCharacterSheetTemplate(rows[0]) : null;
  }

  async updateTemplate(input: {
    id: string;
    name?: string;
    fields?: CharacterTemplateItem[];
  }) {
    const current = await this.getTemplate(input.id);

    if (!current) {
      return null;
    }

    const updated: CharacterSheetTemplateRecord = {
      ...current,
      name: input.name ?? current.name,
      fields: input.fields ?? current.fields,
      updatedAt: nowIso(),
    };

    await this.db.execute(
      `UPDATE character_sheet_templates
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

  async deleteTemplate(id: string) {
    await this.db.execute(
      `DELETE FROM character_sheet_templates
       WHERE id = $1`,
      [id],
    );
  }
}
