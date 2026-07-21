import type { Extensions, JSONContent } from "@tiptap/core";
import type { ExecuteCommand } from "../../commands";
import type { SaveDocumentChanges } from "../application/SaveDocument";

export interface EditorAdapter {
  saveDocument: SaveDocumentChanges;
  markDocumentSavePending(): void;
  extensions(input: {
    executeCommand: ExecuteCommand;
    getChaosFactor: () => number;
    supportsSlashCommands: boolean;
  }): Extensions;
  parseMarkdown(markdown: string): JSONContent;
  serialize(content: JSONContent): string;
}
