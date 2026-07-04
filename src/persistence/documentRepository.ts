import type Database from "@tauri-apps/plugin-sql";
import type { Document } from "../domain/domainTypes";
import { createId, nowIso } from "./id";

export type DocumentRecord = Document;

type DocumentRow = {
  id: string;
  session_id: string;
  parent_id: string | null;
  kind: DocumentRecord["kind"];
  folder_kind: "characters" | "sessions" | null;
  character_sheet_id: string | null;
  title: string;
  content_markdown: string;
  created_at: string;
  updated_at: string;
};

function mapDocument(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    parentId: row.parent_id ?? undefined,
    kind: row.kind,
    folderKind: row.folder_kind ?? undefined,
    characterSheetId: row.character_sheet_id ?? undefined,
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
      `SELECT id, session_id, parent_id, kind, folder_kind, character_sheet_id, title, content_markdown, created_at, updated_at
       FROM documents
       WHERE id = $1
       LIMIT 1`,
      [id],
    );

    return rows[0] ? mapDocument(rows[0]) : null;
  }

  async getBySessionId(sessionId: string) {
    const rows = await this.db.select<DocumentRow[]>(
      `SELECT id, session_id, parent_id, kind, folder_kind, character_sheet_id, title, content_markdown, created_at, updated_at
       FROM documents
       WHERE session_id = $1
         AND kind != 'folder'
       ORDER BY CASE kind WHEN 'session' THEN 0 ELSE 1 END, created_at ASC
       LIMIT 1`,
      [sessionId],
    );

    return rows[0] ? mapDocument(rows[0]) : null;
  }

  async listBySessionId(sessionId: string) {
    const rows = await this.db.select<DocumentRow[]>(
      `SELECT id, session_id, parent_id, kind, folder_kind, character_sheet_id, title, content_markdown, created_at, updated_at
       FROM documents
       WHERE session_id = $1
       ORDER BY
         CASE
           WHEN parent_id IS NULL AND folder_kind = 'characters' THEN 0
           WHEN parent_id IS NULL AND folder_kind = 'sessions' THEN 1
           WHEN parent_id IS NULL THEN 2
           WHEN kind = 'folder' THEN 3
           ELSE 4
         END,
         title COLLATE NOCASE ASC,
         created_at ASC`,
      [sessionId],
    );

    return rows.map(mapDocument);
  }

  async getSystemFolder(
    sessionId: string,
    folderKind: NonNullable<DocumentRecord["folderKind"]>,
  ) {
    const rows = await this.db.select<DocumentRow[]>(
      `SELECT id, session_id, parent_id, kind, folder_kind, character_sheet_id, title, content_markdown, created_at, updated_at
       FROM documents
       WHERE session_id = $1
         AND kind = 'folder'
         AND folder_kind = $2
       LIMIT 1`,
      [sessionId, folderKind],
    );

    return rows[0] ? mapDocument(rows[0]) : null;
  }

  async create(input: {
    id?: string;
    sessionId: string;
    parentId?: string;
    kind?: DocumentRecord["kind"];
    folderKind?: DocumentRecord["folderKind"];
    characterSheetId?: string;
    title: string;
    contentMarkdown?: string;
  }) {
    const timestamp = nowIso();
    const document: DocumentRecord = {
      id: input.id ?? createId("document"),
      sessionId: input.sessionId,
      parentId: input.parentId,
      kind: input.kind ?? "session",
      folderKind: input.folderKind,
      characterSheetId: input.characterSheetId,
      title: input.title,
      contentMarkdown: input.kind === "folder" ? "" : (input.contentMarkdown ?? ""),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await this.db.execute(
      `INSERT INTO documents
       (id, session_id, parent_id, kind, folder_kind, character_sheet_id, title, content_markdown, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        document.id,
        document.sessionId,
        document.parentId ?? null,
        document.kind,
        document.folderKind ?? null,
        document.characterSheetId ?? null,
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
      contentMarkdown:
        current.kind === "folder"
          ? current.contentMarkdown
          : (input.contentMarkdown ?? current.contentMarkdown),
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

  async delete(id: string) {
    const documents = await this.db.select<
      Array<{
        id: string;
        parent_id: string | null;
      }>
    >(`SELECT id, parent_id FROM documents`);
    const childIdsByParentId = new Map<string, string[]>();

    for (const document of documents) {
      if (!document.parent_id) {
        continue;
      }

      childIdsByParentId.set(document.parent_id, [
        ...(childIdsByParentId.get(document.parent_id) ?? []),
        document.id,
      ]);
    }

    const idsToDelete: string[] = [];
    const idsToVisit = [id];

    while (idsToVisit.length > 0) {
      const currentId = idsToVisit.shift();

      if (!currentId || idsToDelete.includes(currentId)) {
        continue;
      }

      idsToDelete.push(currentId);
      idsToVisit.push(...(childIdsByParentId.get(currentId) ?? []));
    }

    for (const documentId of [...idsToDelete].reverse()) {
      await this.db.execute(`DELETE FROM documents WHERE id = $1`, [documentId]);
    }

    return idsToDelete;
  }
}
