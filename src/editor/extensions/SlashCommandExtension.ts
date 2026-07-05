import { Extension } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";
import { executeCommand } from "../../commands/executeCommand";
import { parseCommand } from "../../commands/parseCommand";
import { applyCommandResult } from "../applyCommandResult";

function findCommandStart(textBeforeCursor: string): number | null {
  const slashIndex = textBeforeCursor.lastIndexOf("/");

  if (slashIndex < 0) {
    return null;
  }

  if (slashIndex > 0 && !/\s/.test(textBeforeCursor[slashIndex - 1])) {
    return null;
  }

  return slashIndex;
}

function findAncestorDepth(state: EditorState, typeName: string): number | null {
  const { $from } = state.selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === typeName) {
      return depth;
    }
  }

  return null;
}

export const SlashCommandExtension = Extension.create({
  name: "slashCommand",

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { selection } = editor.state;
        const { $from } = selection;
        const parent = $from.parent;

        if (parent.type.name !== "paragraph" || parent.textContent.trim().length === 0) {
          return false;
        }

        const textBeforeCursor = parent.textBetween(0, $from.parentOffset);
        const commandStart = findCommandStart(textBeforeCursor);

        if (commandStart === null) {
          return false;
        }

        const commandText = textBeforeCursor.slice(commandStart);
        const parsedCommand = parseCommand(commandText);
        const commandResult = executeCommand(parsedCommand, {
          isInsideCombatSpace:
            findAncestorDepth(editor.state, "combatSpace") !== null,
        });

        return applyCommandResult({
          editor,
          result: commandResult,
          commandStart,
          cursor: $from,
          paragraph: parent,
        });
      },
    };
  },
});
