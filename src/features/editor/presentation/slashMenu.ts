import type { Editor as TiptapEditor } from "@tiptap/core";
import type { SlashCommandDefinition } from "../../commands";

export type SlashMenuState = {
  from: number;
  to: number;
  left: number;
  top: number;
  query: string;
};

export function getSlashMenuState(editor: TiptapEditor): SlashMenuState | null {
  const { selection } = editor.state;

  if (!selection.empty) {
    return null;
  }

  const { $from } = selection;
  const parent = $from.parent;

  if (parent.type.name !== "paragraph") {
    return null;
  }

  const textBeforeCursor = parent.textBetween(0, $from.parentOffset);
  const slashIndex = textBeforeCursor.lastIndexOf("/");

  if (slashIndex < 0) {
    return null;
  }

  if (slashIndex > 0 && !/\s/.test(textBeforeCursor[slashIndex - 1])) {
    return null;
  }

  const slashQuery = textBeforeCursor.slice(slashIndex + 1);

  if (/\s/.test(slashQuery)) {
    return null;
  }

  try {
    const coords = editor.view.coordsAtPos($from.pos);

    return {
      from: $from.start() + slashIndex,
      to: $from.pos,
      left: coords.left,
      top: coords.bottom + 8,
      query: slashQuery.toLowerCase(),
    };
  } catch {
    return null;
  }
}

export function commandOptionMatches(
  option: SlashCommandDefinition,
  query: string,
): boolean {
  if (query.length === 0) {
    return true;
  }

  const commandName = option.prefix.slice(1).trim();

  return (
    option.label.toLowerCase().includes(query) || commandName.includes(query)
  );
}

export function getEditorDom(editor: TiptapEditor): HTMLElement | null {
  try {
    return editor.view.dom;
  } catch {
    return null;
  }
}
