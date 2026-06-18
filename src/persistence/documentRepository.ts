import type Database from "@tauri-apps/plugin-sql";
import { createId, nowIso } from "./id";

export type DocumentRecord = {
  id: string;
  sessionId: string;
  title: string;
  contentMarkdown: string;
  createdAt: string;
  updatedAt: string;
};

export class DocumentRepository {
  constructor(private readonly db: Database) {}

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
}
