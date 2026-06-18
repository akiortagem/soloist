import type Database from "@tauri-apps/plugin-sql";
import type { Document } from "../domain/domainTypes";
import { createId, nowIso } from "./id";

export type DocumentRecord = Document;

type DocumentRow = {
  id: string;
  session_id: string;
  title: string;
  content_markdown: string;
  created_at: string;
  updated_at: string;
};

function mapDocument(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    title: row.title,
    contentMarkdown: row.content_markdown,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class DocumentRepository {
  constructor(private readonly db: Database) {}

  async get(id: string) {
    const rows = await this.db.select<DocumentRow[]>(
      `SELECT id, session_id, title, content_markdown, created_at, updated_at
       FROM documents
       WHERE id = $1
       LIMIT 1`,
      [id],
    );

    return rows[0] ? mapDocument(rows[0]) : null;
  }

  async getBySessionId(sessionId: string) {
    const rows = await this.db.select<DocumentRow[]>(
      `SELECT id, session_id, title, content_markdown, created_at, updated_at
       FROM documents
       WHERE session_id = $1
       ORDER BY created_at ASC
       LIMIT 1`,
      [sessionId],
    );

    return rows[0] ? mapDocument(rows[0]) : null;
  }

  async create(input: {
    sessionId: string;
    title: string;
    contentMarkdown?: string;
  }) {
    const timestamp = nowIso();
    const document: DocumentRecord = {
      id: createId("document"),
      sessionId: input.sessionId,
      title: input.title,
      contentMarkdown: input.contentMarkdown ?? "",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await this.db.execute(
      `INSERT INTO documents
       (id, session_id, title, content_markdown, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        document.id,
        document.sessionId,
        document.title,
        document.contentMarkdown,
        document.createdAt,
        document.updatedAt,
      ],
    );

    return document;
  }

  async update(input: {
    id: string;
    title?: string;
    contentMarkdown?: string;
  }) {
    const current = await this.get(input.id);

    if (!current) {
      return null;
    }

    const updated: DocumentRecord = {
      ...current,
      title: input.title ?? current.title,
      contentMarkdown: input.contentMarkdown ?? current.contentMarkdown,
      updatedAt: nowIso(),
    };

    await this.db.execute(
      `UPDATE documents
       SET title = $1,
           content_markdown = $2,
           updated_at = $3
       WHERE id = $4`,
      [updated.title, updated.contentMarkdown, updated.updatedAt, updated.id],
    );

    return updated;
  }
}
