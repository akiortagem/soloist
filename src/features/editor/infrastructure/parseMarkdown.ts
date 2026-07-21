import type { JSONContent } from "@tiptap/core";
import {
  bulletListNode,
  combatSpaceNode,
  combatTurnBlockNode,
  headingNode,
  paragraphNode,
  resultBlockNode,
  sceneContainerNode,
} from "./markdownNodes";
import {
  parseCombatSpaceFence,
  parseCombatTurnFence,
  parseResultBlockFence,
  parseSceneContainerFence,
} from "./markdownPayloads";

const EMPTY_DOCUMENT: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

function findNextSceneFence(
  lines: string[],
  start: number,
  end: number,
): number {
  for (let index = start; index < end; index += 1) {
    if (/^:::trpg-scene\s*$/.test(lines[index])) return index;
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
      while (
        contentEnd < endIndex &&
        !/^:::trpg-combat-(turn|space-end)\s*$/.test(lines[contentEnd])
      ) {
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
    while (
      contentEnd < endIndex &&
      !/^:::trpg-combat-(turn-end|space-end)\s*$/.test(lines[contentEnd])
    ) {
      contentEnd += 1;
    }
    content.push(
      combatTurnBlockNode(
        payload,
        parseMarkdownLines(lines, contentStart, contentEnd),
      ),
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
  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    content.push(paragraphNode(paragraphLines.join(" ")));
    paragraphLines = [];
  };
  const flushBullets = () => {
    if (bulletItems.length === 0) return;
    content.push(bulletListNode(bulletItems));
    bulletItems = [];
  };

  for (let lineIndex = startIndex; lineIndex < endIndex; lineIndex += 1) {
    const line = lines[lineIndex];
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    const bulletMatch = /^\s*[-*+]\s+(.+)$/.exec(line);
    const combatSpace = /^:::trpg-combat-space\s*$/.test(line);
    const resultFence =
      /^:::trpg-(roll|oracle|scene|combat|stat|chaos|error)\s*$/.exec(line);

    if (combatSpace) {
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
      const payload = closed
        ? parseCombatSpaceFence(bodyLines.join("\n"))
        : null;
      if (!payload) {
        paragraphLines.push(line, ...bodyLines);
        continue;
      }
      const parsed = parseCombatSpaceLines(lines, lineIndex + 1, endIndex);
      content.push(combatSpaceNode(payload, parsed.content));
      lineIndex = parsed.endIndex;
      continue;
    }

    if (resultFence) {
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
      const scene =
        closed && resultFence[1] === "scene"
          ? parseSceneContainerFence(body)
          : null;
      if (scene) {
        const contentStart = lineIndex + 1;
        const contentEnd = findNextSceneFence(lines, contentStart, endIndex);
        content.push(
          sceneContainerNode(
            scene,
            parseMarkdownLines(lines, contentStart, contentEnd),
          ),
        );
        lineIndex = contentEnd - 1;
        continue;
      }
      const block = closed ? parseResultBlockFence(resultFence[1], body) : null;
      if (block) content.push(resultBlockNode(block));
      else paragraphLines.push(line, ...bodyLines);
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      flushBullets();
    } else if (headingMatch) {
      flushParagraph();
      flushBullets();
      content.push(headingNode(headingMatch[1].length, headingMatch[2]));
    } else if (bulletMatch) {
      flushParagraph();
      bulletItems.push(bulletMatch[1]);
    } else {
      flushBullets();
      paragraphLines.push(line.trim());
    }
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
