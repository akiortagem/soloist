import type { JSONContent } from "@tiptap/core";
import type {
  CombatSpacePayload,
  CombatTurnBlockPayload,
  ResultBlock,
  SceneContainerPayload,
} from "../../../domain/domainTypes";

function isInlineResultBlockType(type: string): type is "roll" | "stat" {
  return type === "roll" || type === "stat";
}

function isResultBlockType(type: string): type is ResultBlock["type"] {
  return [
    "roll",
    "oracle",
    "scene",
    "combat",
    "stat",
    "chaos",
    "error",
  ].includes(type);
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
      if (node.type === "text") return serializeTextNode(node);
      if (node.type === "inlineResultBlock") {
        const block = node.attrs?.block as ResultBlock | undefined;
        if (!block || !isInlineResultBlockType(block.type)) return "";
        const name = block.type === "roll" ? "trpg-roll" : "trpg-stat";
        return `{{${name}:${encodeURIComponent(JSON.stringify(block))}}}`;
      }
      if (node.type === "hardBreak") return "\n";
      return serializeInline(node.content);
    })
    .join("");
}

function serializeChildren(node: JSONContent): string {
  return (node.content ?? [])
    .map(serializeBlock)
    .filter((block) => block.trim().length > 0)
    .join("\n\n");
}

function serializeBlock(node: JSONContent): string {
  switch (node.type) {
    case "heading": {
      const level = Math.min(Math.max(Number(node.attrs?.level ?? 1), 1), 6);
      return `${"#".repeat(level)} ${serializeInline(node.content)}`;
    }
    case "bulletList":
      return (node.content ?? [])
        .map((item) => {
          const paragraphs =
            item.content?.filter((child) => child.type === "paragraph") ?? [];
          return `- ${paragraphs
            .map((paragraph) => serializeInline(paragraph.content))
            .join(" ")}`;
        })
        .join("\n");
    case "paragraph":
      return serializeInline(node.content);
    case "resultBlock": {
      const block = node.attrs?.block as ResultBlock | undefined;
      if (!block || !isResultBlockType(block.type)) return "";
      return [`:::trpg-${block.type}`, JSON.stringify(block), ":::"].join("\n");
    }
    case "sceneContainer": {
      const payload = node.attrs?.payload as SceneContainerPayload | undefined;
      if (!payload) return serializeInline(node.content);
      return [
        ":::trpg-scene",
        JSON.stringify(payload),
        ":::",
        serializeChildren(node),
      ]
        .filter((part) => part.trim().length > 0)
        .join("\n");
    }
    case "combatSpace": {
      const payload = node.attrs?.payload as CombatSpacePayload | undefined;
      if (!payload) return serializeInline(node.content);
      return [
        ":::trpg-combat-space",
        JSON.stringify(payload),
        ":::",
        serializeChildren(node),
        ":::trpg-combat-space-end",
      ]
        .filter((part) => part.trim().length > 0)
        .join("\n");
    }
    case "combatTurnBlock": {
      const payload = node.attrs?.payload as CombatTurnBlockPayload | undefined;
      if (!payload) return serializeInline(node.content);
      return [
        ":::trpg-combat-turn",
        JSON.stringify(payload),
        ":::",
        serializeChildren(node),
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
