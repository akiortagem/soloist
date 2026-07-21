import type { JSONContent } from "@tiptap/core";
import type {
  CombatSpacePayload,
  CombatTurnBlockPayload,
  ResultBlock,
  SceneContainerPayload,
} from "../../../domain/domainTypes";

type TextMark = "bold" | "italic";

function textNode(text: string, marks: TextMark[] = []): JSONContent {
  return { type: "text", text, marks: marks.map((type) => ({ type })) };
}

function decodeInlineResultBlock(
  encoded: string,
  expectedType: "roll" | "stat",
): ResultBlock | null {
  try {
    const parsed = JSON.parse(
      decodeURIComponent(encoded),
    ) as Partial<ResultBlock>;
    if (parsed.type !== expectedType) return null;
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

function parseInlineMarkdown(markdown: string): JSONContent[] {
  const nodes: JSONContent[] = [];
  const pattern =
    /(\{\{trpg-(roll|stat):[^}]+\}\}|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdown)) !== null) {
    if (match.index > cursor)
      nodes.push(textNode(markdown.slice(cursor, match.index)));
    const token = match[0];
    if (token.startsWith("{{trpg-roll:") || token.startsWith("{{trpg-stat:")) {
      const type = match[2] as "roll" | "stat";
      const block = decodeInlineResultBlock(
        token.slice(`{{trpg-${type}:`.length, -2),
        type,
      );
      nodes.push(block ? inlineResultBlockNode(block) : textNode(token));
    } else if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(textNode(token.slice(2, -2), ["bold"]));
    } else {
      nodes.push(textNode(token.slice(1, -1), ["italic"]));
    }
    cursor = match.index + token.length;
  }
  if (cursor < markdown.length) nodes.push(textNode(markdown.slice(cursor)));
  return nodes;
}

export function paragraphNode(markdown: string): JSONContent {
  const content = parseInlineMarkdown(markdown);
  return content.length > 0
    ? { type: "paragraph", content }
    : { type: "paragraph" };
}

export function headingNode(level: number, markdown: string): JSONContent {
  const content = parseInlineMarkdown(markdown);
  return {
    type: "heading",
    attrs: { level },
    content: content.length > 0 ? content : undefined,
  };
}

export function bulletListNode(items: string[]): JSONContent {
  return {
    type: "bulletList",
    content: items.map((item) => ({
      type: "listItem",
      content: [paragraphNode(item)],
    })),
  };
}

export function resultBlockNode(block: ResultBlock): JSONContent {
  return { type: "resultBlock", attrs: { block } };
}

export function sceneContainerNode(
  payload: SceneContainerPayload,
  content: JSONContent[],
): JSONContent {
  return {
    type: "sceneContainer",
    attrs: { payload },
    content: content.length > 0 ? content : [{ type: "paragraph" }],
  };
}

export function combatSpaceNode(
  payload: CombatSpacePayload,
  content: JSONContent[],
): JSONContent {
  return { type: "combatSpace", attrs: { payload }, content };
}

export function combatTurnBlockNode(
  payload: CombatTurnBlockPayload,
  content: JSONContent[],
): JSONContent {
  return {
    type: "combatTurnBlock",
    attrs: { payload },
    content: content.length > 0 ? content : [{ type: "paragraph" }],
  };
}

function inlineResultBlockNode(block: ResultBlock): JSONContent {
  return { type: "inlineResultBlock", attrs: { block } };
}
