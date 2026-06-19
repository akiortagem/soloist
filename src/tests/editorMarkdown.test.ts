import { describe, expect, it } from "vitest";
import { markdownToTiptapJson, tiptapJsonToMarkdown } from "../editor/markdown";

describe("editor markdown persistence", () => {
  it("loads and saves headings, paragraphs, bold, italic, and bullet lists", () => {
    const markdown = [
      "# Session Notes",
      "",
      "This is **bold** and *italic* text.",
      "",
      "- First lead",
      "- Second lead",
    ].join("\n");

    const json = markdownToTiptapJson(markdown);

    expect(json.content?.[0]).toMatchObject({
      type: "heading",
      attrs: { level: 1 },
    });
    expect(json.content?.[1]).toMatchObject({ type: "paragraph" });
    expect(json.content?.[2]).toMatchObject({ type: "bulletList" });
    expect(tiptapJsonToMarkdown(json)).toBe(markdown);
  });

  it("creates an editable empty document for blank markdown", () => {
    expect(markdownToTiptapJson("")).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  });
});
