export type DocumentChanges = {
  title?: string;
  contentMarkdown?: string;
};

export interface DocumentWriter {
  save(documentId: string, changes: DocumentChanges): Promise<void>;
  markPending(): void;
}
