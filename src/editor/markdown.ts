import type { JSONContent } from "@tiptap/core";
import type {
  CombatSpacePayload,
  CombatTurnBlockPayload,
  ResultBlock,
  SceneContainerPayload,
} from "../domain/domainTypes";

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

function isInlineResultBlockType(type: string): type is "roll" | "stat" {
  return type === "roll" || type === "stat";
}

function inlineResultTokenName(type: "roll" | "stat"): string {
  return type === "roll" ? "trpg-roll" : "trpg-stat";
}

function encodeInlineResultBlock(block: ResultBlock): string {
  return encodeURIComponent(JSON.stringify(block));
}

function decodeInlineResultBlock(
  encoded: string,
  expectedType: "roll" | "stat",
): ResultBlock | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(encoded)) as Partial<ResultBlock>;

    if (parsed.type !== expectedType) {
      return null;
    }

    return {
      id: String(parsed.id ?? `${expectedType}_unknown`),
      type: expectedType,
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
  const tokenPattern = /(\{\{trpg-(roll|stat):[^}]+\}\}|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(markdown)) !== null) {
    if (match.index > cursor) {
      nodes.push(textNode(markdown.slice(cursor, match.index)));
    }

    const token = match[0];
    if (token.startsWith("{{trpg-roll:") || token.startsWith("{{trpg-stat:")) {
      const type = match[2];
      const tokenPrefix = `{{trpg-${type}:`;
      const encoded = token.slice(tokenPrefix.length, -2);
      const block = isInlineResultBlockType(type)
        ? decodeInlineResultBlock(encoded, type)
        : null;

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

function sceneContainerNode(
  payload: SceneContainerPayload,
  content: JSONContent[],
): JSONContent {
  return {
    type: "sceneContainer",
    attrs: { payload },
    content: content.length > 0 ? content : [{ type: "paragraph" }],
  };
}

function combatSpaceNode(
  payload: CombatSpacePayload,
  content: JSONContent[],
): JSONContent {
  return {
    type: "combatSpace",
    attrs: { payload },
    content,
  };
}

function combatTurnBlockNode(
  payload: CombatTurnBlockPayload,
  content: JSONContent[],
): JSONContent {
  return {
    type: "combatTurnBlock",
    attrs: { payload },
    content: content.length > 0 ? content : [{ type: "paragraph" }],
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

function parseSceneContainerFence(body: string): SceneContainerPayload | null {
  try {
    const parsed = JSON.parse(body) as Partial<SceneContainerPayload> & {
      type?: unknown;
    };

    if (parsed.type || typeof parsed.id !== "string") {
      return null;
    }

    const payload: SceneContainerPayload = {
      id: parsed.id,
      description: String(parsed.description ?? ""),
      descriptionLocked: parsed.descriptionLocked === true,
      oracleResult: parsed.oracleResult,
      oracleError:
        typeof parsed.oracleError === "string" ? parsed.oracleError : undefined,
    };

    if (typeof parsed.collapsed === "boolean") {
      payload.collapsed = parsed.collapsed;
    }

    return payload;
  } catch {
    return null;
  }
}

function parseCombatSpaceFence(body: string): CombatSpacePayload | null {
  try {
    const parsed = JSON.parse(body) as Partial<CombatSpacePayload>;

    if (typeof parsed.id !== "string") {
      return null;
    }

    return {
      id: parsed.id,
      active: parsed.active === true,
      ended: parsed.ended === true,
      roundNumber:
        typeof parsed.roundNumber === "number" && Number.isFinite(parsed.roundNumber)
          ? Math.max(1, parsed.roundNumber)
          : 1,
      currentTurnIndex:
        typeof parsed.currentTurnIndex === "number" &&
        Number.isFinite(parsed.currentTurnIndex)
          ? Math.max(0, parsed.currentTurnIndex)
          : 0,
    };
  } catch {
    return null;
  }
}

function parseCombatTurnFence(body: string): CombatTurnBlockPayload | null {
  try {
    const parsed = JSON.parse(body) as Partial<CombatTurnBlockPayload>;

    if (
      typeof parsed.id !== "string" ||
      typeof parsed.combatantId !== "string" ||
      typeof parsed.combatantName !== "string"
    ) {
      return null;
    }

    return {
      id: parsed.id,
      combatantId: parsed.combatantId,
      combatantName: parsed.combatantName,
      roundNumber:
        typeof parsed.roundNumber === "number" && Number.isFinite(parsed.roundNumber)
          ? Math.max(1, parsed.roundNumber)
          : 1,
      turnIndex:
        typeof parsed.turnIndex === "number" && Number.isFinite(parsed.turnIndex)
          ? Math.max(0, parsed.turnIndex)
          : 0,
      current: parsed.current === true,
      collapsed:
        typeof parsed.collapsed === "boolean" ? parsed.collapsed : undefined,
    };
  } catch {
    return null;
  }
}

function findNextSceneFence(lines: string[], start: number, end: number): number {
  for (let index = start; index < end; index += 1) {
    if (/^:::trpg-scene\s*$/.test(lines[index])) {
      return index;
    }
  }

  return end;
}

function parseCombatSpaceLines(
  lines: string[],
  startIndex: number,
  endIndex: number,
): { content: JSONContent[]; endIndex: number } {
  const content: JSONContent[] = [];
  let lineIndex = startIndex;

  while (lineIndex < endIndex) {
    if (/^:::trpg-combat-space-end\s*$/.test(lines[lineIndex])) {
      return { content, endIndex: lineIndex };
    }

    if (!/^:::trpg-combat-turn\s*$/.test(lines[lineIndex])) {
      const contentStart = lineIndex;
      let contentEnd = contentStart;

      while (contentEnd < endIndex) {
        if (
          /^:::trpg-combat-turn\s*$/.test(lines[contentEnd]) ||
          /^:::trpg-combat-space-end\s*$/.test(lines[contentEnd])
        ) {
          break;
        }

        contentEnd += 1;
      }

      content.push(...parseMarkdownLines(lines, contentStart, contentEnd));
      lineIndex = contentEnd;
      continue;
    }

    const payloadLines: string[] = [];
    let payloadClosed = false;

    while (lineIndex + 1 < endIndex) {
      lineIndex += 1;
      const nextLine = lines[lineIndex];

      if (nextLine.trim() === ":::") {
        payloadClosed = true;
        break;
      }

      payloadLines.push(nextLine);
    }

    const payload = payloadClosed
      ? parseCombatTurnFence(payloadLines.join("\n"))
      : null;

    if (!payload) {
      lineIndex += 1;
      continue;
    }

    const contentStart = lineIndex + 1;
    let contentEnd = contentStart;

    while (contentEnd < endIndex) {
      if (
        /^:::trpg-combat-turn-end\s*$/.test(lines[contentEnd]) ||
        /^:::trpg-combat-space-end\s*$/.test(lines[contentEnd])
      ) {
        break;
      }

      contentEnd += 1;
    }

    content.push(
      combatTurnBlockNode(payload, parseMarkdownLines(lines, contentStart, contentEnd)),
    );
    lineIndex =
      contentEnd < endIndex &&
      /^:::trpg-combat-turn-end\s*$/.test(lines[contentEnd])
        ? contentEnd + 1
        : contentEnd;
  }

  return { content, endIndex: lineIndex };
}

function parseMarkdownLines(
  lines: string[],
  startIndex: number,
  endIndex: number,
): JSONContent[] {
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

  for (let lineIndex = startIndex; lineIndex < endIndex; lineIndex += 1) {
    const line = lines[lineIndex];
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    const bulletMatch = /^\s*[-*+]\s+(.+)$/.exec(line);
    const combatSpaceFenceMatch = /^:::trpg-combat-space\s*$/.exec(line);
    const resultFenceMatch = /^:::trpg-(roll|oracle|scene|combat|stat|chaos|error)\s*$/.exec(
      line,
    );

    if (combatSpaceFenceMatch) {
      flushParagraph();
      flushBullets();

      const bodyLines: string[] = [];
      let closed = false;

      while (lineIndex + 1 < endIndex) {
        lineIndex += 1;
        const nextLine = lines[lineIndex];

        if (nextLine.trim() === ":::") {
          closed = true;
          break;
        }

        bodyLines.push(nextLine);
      }

      const payload = closed ? parseCombatSpaceFence(bodyLines.join("\n")) : null;

      if (!payload) {
        paragraphLines.push(line, ...bodyLines);
        continue;
      }

      const parsedCombat = parseCombatSpaceLines(lines, lineIndex + 1, endIndex);
      content.push(combatSpaceNode(payload, parsedCombat.content));
      lineIndex = parsedCombat.endIndex;
      continue;
    }

    if (resultFenceMatch) {
      flushParagraph();
      flushBullets();

      const bodyLines: string[] = [];
      let closed = false;

      while (lineIndex + 1 < endIndex) {
        lineIndex += 1;
        const nextLine = lines[lineIndex];

        if (nextLine.trim() === ":::") {
          closed = true;
          break;
        }

        bodyLines.push(nextLine);
      }

      const body = bodyLines.join("\n");
      const scenePayload =
        closed && resultFenceMatch[1] === "scene"
          ? parseSceneContainerFence(body)
          : null;

      if (scenePayload) {
        const contentStart = lineIndex + 1;
        const contentEnd = findNextSceneFence(lines, contentStart, endIndex);
        const sceneContent = parseMarkdownLines(lines, contentStart, contentEnd);

        content.push(sceneContainerNode(scenePayload, sceneContent));
        lineIndex = contentEnd - 1;
        continue;
      }

      const block = closed ? parseResultBlockFence(resultFenceMatch[1], body) : null;

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

  return content;
}

export function markdownToTiptapJson(markdown: string): JSONContent {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const content = parseMarkdownLines(lines, 0, lines.length);

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

        if (!block || !isInlineResultBlockType(block.type)) {
          return "";
        }

        return `{{${inlineResultTokenName(block.type)}:${encodeInlineResultBlock(block)}}}`;
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

    case "sceneContainer": {
      const payload = node.attrs?.payload as SceneContainerPayload | undefined;

      if (!payload) {
        return serializeInline(node.content);
      }

      const sceneContent = (node.content ?? [])
        .map(serializeBlock)
        .filter((block) => block.trim().length > 0)
        .join("\n\n");

      return [`:::trpg-scene`, JSON.stringify(payload), ":::", sceneContent]
        .filter((part) => part.trim().length > 0)
        .join("\n");
    }

    case "combatSpace": {
      const payload = node.attrs?.payload as CombatSpacePayload | undefined;

      if (!payload) {
        return serializeInline(node.content);
      }

      const combatContent = (node.content ?? [])
        .map(serializeBlock)
        .filter((block) => block.trim().length > 0)
        .join("\n\n");

      return [
        ":::trpg-combat-space",
        JSON.stringify(payload),
        ":::",
        combatContent,
        ":::trpg-combat-space-end",
      ]
        .filter((part) => part.trim().length > 0)
        .join("\n");
    }

    case "combatTurnBlock": {
      const payload = node.attrs?.payload as CombatTurnBlockPayload | undefined;

      if (!payload) {
        return serializeInline(node.content);
      }

      const turnContent = (node.content ?? [])
        .map(serializeBlock)
        .filter((block) => block.trim().length > 0)
        .join("\n\n");

      return [
        ":::trpg-combat-turn",
        JSON.stringify(payload),
        ":::",
        turnContent,
        ":::trpg-combat-turn-end",
      ]
        .filter((part) => part.trim().length > 0)
        .join("\n");
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
