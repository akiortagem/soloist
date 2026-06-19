import { Extension } from "@tiptap/core";
import { parseCommand } from "../../commands/parseCommand";
import { createUnknownCommandResultBlock } from "../resultBlocks/createResultBlock";

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

        const commandText = parent.textContent.trim();

        if (!commandText.startsWith("/")) {
          return false;
        }

        const parsed = parseCommand(commandText);

        if (parsed.type !== "unknown") {
          return false;
        }

        const resultBlock = createUnknownCommandResultBlock(parsed);
        const resultNode = editor.schema.nodes.resultBlock?.create({
          block: resultBlock,
        });

        if (!resultNode) {
          return false;
        }

        const paragraphNode = editor.schema.nodes.paragraph.create();
        const from = $from.before();
        const to = $from.after();

        editor
          .chain()
          .focus()
          .command(({ tr, dispatch }) => {
            if (!dispatch) {
              return true;
            }

            tr.replaceWith(from, to, [resultNode, paragraphNode]);
            dispatch(tr.scrollIntoView());
            return true;
          })
          .run();

        return true;
      },
    };
  },
});
