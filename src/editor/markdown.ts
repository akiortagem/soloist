import type { JSONContent } from "@tiptap/core";
import type { ResultBlock } from "../domain/domainTypes";

type TextMark = "bold" | "italic";

const EMPTY_DOCUMENT: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

function textNode(text: string, marks: TextMark[] = []): JSONContent {
  return {
    type: "text",
    text,
    marks: marks.map((type) => ({ type })),
  };
}

function encodeInlineResultBlock(block: ResultBlock): string {
  return encodeURIComponent(JSON.stringify(block));
}

function decodeInlineResultBlock(encoded: string): ResultBlock | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(encoded)) as Partial<ResultBlock>;

    if (parsed.type !== "roll") {
      return null;
    }

    return {
      id: String(parsed.id ?? "roll_unknown"),
      type: "roll",
      createdAt: String(parsed.createdAt ?? new Date(0).toISOString()),
      commandText: String(parsed.commandText ?? ""),
      collapsed:
        typeof parsed.collapsed === "boolean" ? parsed.collapsed : undefined,
      payload: parsed.payload ?? {},
    };
  } catch {
    return null;
  }
}

function inlineResultBlockNode(block: ResultBlock): JSONContent {
  return {
    type: "inlineResultBlock",
    attrs: { block },
  };
}

function parseInlineMarkdown(markdown: string): JSONContent[] {
  const nodes: JSONContent[] = [];
  const tokenPattern = /(\{\{trpg-roll:[^}]+\}\}|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(markdown)) !== null) {
    if (match.index > cursor) {
      nodes.push(textNode(markdown.slice(cursor, match.index)));
    }

    const token = match[0];
    if (token.startsWith("{{trpg-roll:")) {
      const encoded = token.slice("{{trpg-roll:".length, -2);
      const block = decodeInlineResultBlock(encoded);

      if (block) {
        nodes.push(inlineResultBlockNode(block));
      } else {
        nodes.push(textNode(token));
      }
    } else if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(textNode(token.slice(2, -2), ["bold"]));
    } else {
      nodes.push(textNode(token.slice(1, -1), ["italic"]));
    }

    cursor = match.index + token.length;
  }

  if (cursor < markdown.length) {
    nodes.push(textNode(markdown.slice(cursor)));
  }

  return nodes;
}

function paragraphNode(markdown: string): JSONContent {
  const content = parseInlineMarkdown(markdown);

  return content.length > 0
    ? { type: "paragraph", content }
    : { type: "paragraph" };
}

function headingNode(level: number, markdown: string): JSONContent {
  const content = parseInlineMarkdown(markdown);

  return {
    type: "heading",
    attrs: { level },
    ...(content.length > 0 ? { content } : {}),
  };
}

function bulletListNode(items: string[]): JSONContent {
  return {
    type: "bulletList",
    content: items.map((item) => ({
      type: "listItem",
      content: [paragraphNode(item)],
    })),
  };
}

function resultBlockNode(block: ResultBlock): JSONContent {
  return {
    type: "resultBlock",
    attrs: { block },
  };
}

function isResultBlockType(type: string): type is ResultBlock["type"] {
  return (
    type === "roll" ||
    type === "oracle" ||
    type === "scene" ||
    type === "combat" ||
    type === "stat" ||
    type === "chaos" ||
    type === "error"
  );
}

function parseResultBlockFence(type: string, body: string): ResultBlock | null {
  if (!isResultBlockType(type)) {
    return null;
  }

  try {
    const parsed = JSON.parse(body) as Partial<ResultBlock>;

    if (parsed.type && parsed.type !== type) {
      return null;
    }

    return {
      id: String(parsed.id ?? `${type}_unknown`),
      type,
      createdAt: String(parsed.createdAt ?? new Date(0).toISOString()),
      commandText: String(parsed.commandText ?? ""),
      collapsed:
        typeof parsed.collapsed === "boolean" ? parsed.collapsed : undefined,
      payload: parsed.payload ?? {},
    };
  } catch {
    return null;
  }
}

export function markdownToTiptapJson(markdown: string): JSONContent {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const content: JSONContent[] = [];
  let paragraphLines: string[] = [];
  let bulletItems: string[] = [];

  function flushParagraph() {
    if (paragraphLines.length === 0) {
      return;
    }

    content.push(paragraphNode(paragraphLines.join(" ")));
    paragraphLines = [];
  }

  function flushBullets() {
    if (bulletItems.length === 0) {
      return;
    }

    content.push(bulletListNode(bulletItems));
    bulletItems = [];
  }

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    const bulletMatch = /^\s*[-*+]\s+(.+)$/.exec(line);
    const resultFenceMatch = /^:::trpg-(roll|oracle|scene|combat|stat|chaos|error)\s*$/.exec(
      line,
    );

    if (resultFenceMatch) {
      flushParagraph();
      flushBullets();

      const bodyLines: string[] = [];
      let closed = false;

      while (lineIndex + 1 < lines.length) {
        lineIndex += 1;
        const nextLine = lines[lineIndex];

        if (nextLine.trim() === ":::") {
          closed = true;
          break;
        }

        bodyLines.push(nextLine);
      }

      const block = closed
        ? parseResultBlockFence(resultFenceMatch[1], bodyLines.join("\n"))
        : null;

      if (block) {
        content.push(resultBlockNode(block));
      } else {
        paragraphLines.push(line, ...bodyLines);
      }

      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      flushBullets();
      continue;
    }

    if (headingMatch) {
      flushParagraph();
      flushBullets();
      content.push(headingNode(headingMatch[1].length, headingMatch[2]));
      continue;
    }

    if (bulletMatch) {
      flushParagraph();
      bulletItems.push(bulletMatch[1]);
      continue;
    }

    flushBullets();
    paragraphLines.push(line.trim());
  }

  flushParagraph();
  flushBullets();

  return content.length > 0 ? { type: "doc", content } : EMPTY_DOCUMENT;
}

function serializeTextNode(node: JSONContent): string {
  const text = node.text ?? "";
  const markTypes = new Set(node.marks?.map((mark) => mark.type));
  const withItalic = markTypes.has("italic") ? `*${text}*` : text;

  return markTypes.has("bold") ? `**${withItalic}**` : withItalic;
}

function serializeInline(content: JSONContent[] = []): string {
  return content
    .map((node) => {
      if (node.type === "text") {
        return serializeTextNode(node);
      }

      if (node.type === "inlineResultBlock") {
        const block = node.attrs?.block as ResultBlock | undefined;

        if (!block || block.type !== "roll") {
          return "";
        }

        return `{{trpg-roll:${encodeInlineResultBlock(block)}}}`;
      }

      if (node.type === "hardBreak") {
        return "\n";
      }

      return serializeInline(node.content);
    })
    .join("");
}

function serializeListItem(node: JSONContent): string {
  const paragraphs =
    node.content?.filter((child) => child.type === "paragraph") ?? [];
  const text = paragraphs.map((paragraph) => serializeInline(paragraph.content)).join(" ");

  return `- ${text}`;
}

function serializeBlock(node: JSONContent): string {
  switch (node.type) {
    case "heading": {
      const level = Math.min(Math.max(Number(node.attrs?.level ?? 1), 1), 6);
      return `${"#".repeat(level)} ${serializeInline(node.content)}`;
    }

    case "bulletList":
      return (node.content ?? []).map(serializeListItem).join("\n");

    case "paragraph":
      return serializeInline(node.content);

    case "resultBlock": {
      const block = node.attrs?.block as ResultBlock | undefined;

      if (!block || !isResultBlockType(block.type)) {
        return "";
      }

      return [`:::trpg-${block.type}`, JSON.stringify(block), ":::"].join("\n");
    }

    default:
      return serializeInline(node.content);
  }
}

export function tiptapJsonToMarkdown(json: JSONContent): string {
  return (json.content ?? [])
    .map(serializeBlock)
    .filter((block) => block.trim().length > 0)
    .join("\n\n");
}
