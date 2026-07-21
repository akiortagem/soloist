import { describe, expect, it, vi } from "vitest";
import type { DocumentWriter } from "./ports/DocumentWriter";
import { createSaveDocument } from "./SaveDocument";

describe("SaveDocument", () => {
  it("writes the explicitly addressed document", async () => {
    const writer: DocumentWriter = {
      save: vi.fn().mockResolvedValue(undefined),
      markPending: vi.fn(),
    };
    const saveDocument = createSaveDocument(writer);

    await saveDocument("document-owned-by-editor", {
      contentMarkdown: "latest content",
    });

    expect(writer.save).toHaveBeenCalledWith("document-owned-by-editor", {
      contentMarkdown: "latest content",
    });
  });
});
