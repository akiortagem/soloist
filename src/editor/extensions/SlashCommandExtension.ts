import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { parseCommand } from "../../commands/parseCommand";
import type { ParsedCommand } from "../../commands/commandTypes";
import type { ResultBlock, SceneContainerPayload } from "../../domain/domainTypes";
import { appStore } from "../../state/appStore";
import {
  createAskCommandResultBlock,
  createChaosCommandResultBlock,
  createInvalidCommandResultBlock,
  createResultBlock,
  createRollCommandResultBlock,
  createStatCommandResultBlock,
  createUnknownCommandResultBlock,
} from "../resultBlocks/createResultBlock";

function createCommandResultBlock(parsed: ParsedCommand): ResultBlock {
  switch (parsed.type) {
    case "ask":
      return createAskCommandResultBlock(parsed);
    case "roll":
      return createRollCommandResultBlock(parsed);
    case "stat":
      return createStatCommandResultBlock(
        parsed,
        appStore.applyStatDelta({
          sheetName: parsed.sheetName,
          statName: parsed.statName,
          delta: parsed.delta,
        }),
      );
    case "chaos":
      return createChaosCommandResultBlock(
        parsed,
        appStore.applyChaosDelta({ delta: parsed.delta }),
      );
    case "invalid":
      return createInvalidCommandResultBlock(parsed);
    case "unknown":
      return createUnknownCommandResultBlock(parsed);
    default:
      return createUnknownCommandResultBlock({
        type: "unknown",
        raw: "raw" in parsed ? parsed.raw : "",
        commandName: parsed.type,
        reason: "Command execution not implemented yet",
      });
  }
}

function createSceneContainerPayload(): SceneContainerPayload {
  return {
    id: `scene_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    description: "",
    descriptionLocked: false,
  };
}

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

function paragraphWithContent(
  paragraph: ProseMirrorNode,
  from: number,
  to: number,
): ProseMirrorNode | null {
  if (to <= from) {
    return null;
  }

  const content = paragraph.cut(from, to).content;
  return paragraph.type.create(paragraph.attrs, content);
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

        if (parsedCommand.type === "scene" && appStore.getSnapshot().activeSession) {
          const sceneNode = editor.schema.nodes.sceneContainer?.create(
            {
              payload: createSceneContainerPayload(),
            },
            editor.schema.nodes.paragraph.create(),
          );

          if (!sceneNode) {
            return false;
          }

          const beforeParagraph = paragraphWithContent(parent, 0, commandStart);
          const afterParagraph =
            paragraphWithContent(parent, $from.parentOffset, parent.content.size) ??
            editor.schema.nodes.paragraph.create();
          const replacementNodes = [
            beforeParagraph,
            sceneNode,
            afterParagraph,
          ].filter((node): node is ProseMirrorNode => Boolean(node));
          const from = $from.before();
          const to = $from.after();

          editor
            .chain()
            .focus()
            .command(({ tr, dispatch }) => {
              if (!dispatch) {
                return true;
              }

              tr.replaceWith(from, to, replacementNodes);
              dispatch(tr.scrollIntoView());
              return true;
            })
            .run();

          return true;
        }

        const resultBlock =
          parsedCommand.type === "scene" && !appStore.getSnapshot().activeSession
            ? createResultBlock("error", {
                commandText,
                payload: {
                  commandName: "scene",
                  reason: "No active session",
                },
              })
            : createCommandResultBlock(parsedCommand);
        if (
          resultBlock.type === "roll" ||
          resultBlock.type === "stat" ||
          resultBlock.type === "chaos"
        ) {
          const inlineResultNode = editor.schema.nodes.inlineResultBlock?.create({
            block: resultBlock,
          });

          if (!inlineResultNode) {
            return false;
          }

          const commandFrom = $from.start() + commandStart;
          const commandTo = $from.pos;

          editor
            .chain()
            .focus()
            .command(({ tr, dispatch }) => {
              if (!dispatch) {
                return true;
              }

              tr.replaceWith(commandFrom, commandTo, inlineResultNode);
              tr.setSelection(
                TextSelection.create(tr.doc, commandFrom + inlineResultNode.nodeSize),
              );
              dispatch(tr.scrollIntoView());
              return true;
            })
            .run();

          return true;
        }

        const resultNode = editor.schema.nodes.resultBlock?.create({
          block: resultBlock,
        });

        if (!resultNode) {
          return false;
        }

        const beforeParagraph = paragraphWithContent(parent, 0, commandStart);
        const afterParagraph =
          paragraphWithContent(parent, $from.parentOffset, parent.content.size) ??
          editor.schema.nodes.paragraph.create();
        const replacementNodes = [
          beforeParagraph,
          resultNode,
          afterParagraph,
        ].filter((node): node is ProseMirrorNode => Boolean(node));
        const from = $from.before();
        const to = $from.after();

        editor
          .chain()
          .focus()
          .command(({ tr, dispatch }) => {
            if (!dispatch) {
              return true;
            }

            tr.replaceWith(from, to, replacementNodes);
            dispatch(tr.scrollIntoView());
            return true;
          })
          .run();

        return true;
      },
    };
  },
});
