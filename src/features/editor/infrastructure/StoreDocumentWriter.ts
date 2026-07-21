import { appStore } from "../../../state/appStore";
import type {
  DocumentChanges,
  DocumentWriter,
} from "../application/ports/DocumentWriter";

export class StoreDocumentWriter implements DocumentWriter {
  async save(documentId: string, changes: DocumentChanges): Promise<void> {
    await appStore.saveDocument(documentId, changes);
  }

  markPending(): void {
    appStore.setDocumentSavePending();
  }
}
