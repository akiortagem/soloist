import type { DocumentChanges, DocumentWriter } from "./ports/DocumentWriter";

export type SaveDocumentChanges = (
  documentId: string,
  changes: DocumentChanges,
) => Promise<void>;

export function createSaveDocument(
  writer: DocumentWriter,
): SaveDocumentChanges {
  return (documentId, changes) => writer.save(documentId, changes);
}
