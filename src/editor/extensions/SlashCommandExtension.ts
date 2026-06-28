import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
import { TextSelection } from "@tiptap/pm/state";
import { parseCommand } from "../../commands/parseCommand";
import type { ParsedCommand } from "../../commands/commandTypes";
import type {
  CombatSpacePayload,
  CombatTurnBlockPayload,
  ResultBlock,
  SceneContainerPayload,
} from "../../domain/domainTypes";
import { getNextRoundNumber, getNextTurnIndex } from "../../combat/combatLogic";
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
    case "trackerStat":
      return createStatCommandResultBlock(
        parsed,
        appStore.applyTrackerStatChange({
          characterName: parsed.characterName,
          statName: parsed.statName,
          mode: parsed.mode,
          value: parsed.value,
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

function createCombatSpacePayload(input: {
  roundNumber: number;
  currentTurnIndex: number;
  active: boolean;
  ended?: boolean;
}): CombatSpacePayload {
  return {
    id: `combat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    active: input.active,
    ended: input.ended === true,
    roundNumber: input.roundNumber,
    currentTurnIndex: input.currentTurnIndex,
  };
}

function createCombatTurnPayload(input: {
  combatantId: string;
  combatantName: string;
  roundNumber: number;
  turnIndex: number;
  current: boolean;
  collapsed?: boolean;
}): CombatTurnBlockPayload {
  return {
    id: `combat_turn_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    combatantId: input.combatantId,
    combatantName: input.combatantName,
    roundNumber: input.roundNumber,
    turnIndex: input.turnIndex,
    current: input.current,
    collapsed: input.collapsed,
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

function findAncestorDepth(state: EditorState, typeName: string): number | null {
  const { $from } = state.selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === typeName) {
      return depth;
    }
  }

  return null;
}

function getPayloadRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
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

        if (
          parsedCommand.type === "scene" &&
          findAncestorDepth(editor.state, "combatSpace") !== null
        ) {
          const resultBlock = createResultBlock("error", {
            commandText,
            payload: {
              commandName: "scene",
              reason: "/scene cannot be used inside combat",
            },
          });
          const resultNode = editor.schema.nodes.resultBlock?.create({
            block: resultBlock,
          });

          if (!resultNode) {
            return false;
          }

          editor
            .chain()
            .focus()
            .command(({ tr, dispatch }) => {
              if (!dispatch) {
                return true;
              }

              tr.replaceWith($from.before(), $from.after(), resultNode);
              dispatch(tr.scrollIntoView());
              return true;
            })
            .run();

          return true;
        }

        if (parsedCommand.type === "combat") {
          const snapshot = appStore.getSnapshot();

          if (!snapshot.activeSession) {
            const resultBlock = createResultBlock("error", {
              commandText,
              payload: {
                commandName: "combat",
                reason: "No active session",
              },
            });
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

            editor
              .chain()
              .focus()
              .command(({ tr, dispatch }) => {
                if (!dispatch) {
                  return true;
                }

                tr.replaceWith($from.before(), $from.after(), replacementNodes);
                dispatch(tr.scrollIntoView());
                return true;
              })
              .run();

            return true;
          }

          if (parsedCommand.action === "begin") {
            appStore.requestRightPanelOpen();
            void appStore.startCombat();

            const combatState = snapshot.combatState;
            const combatants = combatState?.combatants ?? [];
            const currentTurnIndex = combatState?.currentTurnIndex ?? 0;
            const roundNumber = combatState?.roundNumber ?? 1;
            const firstCombatant = combatants[currentTurnIndex];
            const turnNode =
              combatants.length >= 2 && firstCombatant
                ? editor.schema.nodes.combatTurnBlock?.create(
                    {
                      payload: createCombatTurnPayload({
                        combatantId: firstCombatant.id,
                        combatantName: firstCombatant.name,
                        roundNumber,
                        turnIndex: currentTurnIndex,
                        current: true,
                      }),
                    },
                    editor.schema.nodes.paragraph.create(),
                  )
                : null;
            const combatSpaceNode = editor.schema.nodes.combatSpace?.create(
              {
                payload: createCombatSpacePayload({
                  active: true,
                  currentTurnIndex,
                  roundNumber,
                }),
              },
              turnNode
                ? [turnNode, editor.schema.nodes.paragraph.create()]
                : [editor.schema.nodes.paragraph.create()],
            );

            if (!combatSpaceNode) {
              return false;
            }

            const beforeParagraph = paragraphWithContent(parent, 0, commandStart);
            const afterParagraph =
              paragraphWithContent(parent, $from.parentOffset, parent.content.size) ??
              editor.schema.nodes.paragraph.create();
            const replacementNodes = [
              beforeParagraph,
              combatSpaceNode,
              afterParagraph,
            ].filter((node): node is ProseMirrorNode => Boolean(node));

            editor
              .chain()
              .focus()
              .command(({ tr, dispatch }) => {
                if (!dispatch) {
                  return true;
                }

                tr.replaceWith($from.before(), $from.after(), replacementNodes);
                dispatch(tr.scrollIntoView());
                return true;
              })
              .run();

            return true;
          }

          const combatSpaceDepth = findAncestorDepth(editor.state, "combatSpace");

          if (combatSpaceDepth === null) {
            const resultBlock = createResultBlock("error", {
              commandText,
              payload: {
                commandName: "combat",
                reason: "Use this combat command inside a combat space",
              },
            });
            const resultNode = editor.schema.nodes.resultBlock?.create({
              block: resultBlock,
            });

            if (!resultNode) {
              return false;
            }

            editor
              .chain()
              .focus()
              .command(({ tr, dispatch }) => {
                if (!dispatch) {
                  return true;
                }

                tr.replaceWith($from.before(), $from.after(), resultNode);
                dispatch(tr.scrollIntoView());
                return true;
              })
              .run();

            return true;
          }

          const commandFrom = $from.start() + commandStart;
          const commandTo = $from.pos;
          const combatState = snapshot.combatState;
          const combatants = combatState?.combatants ?? [];

          if (parsedCommand.action === "end") {
            const combatSpaceNode = $from.node(combatSpaceDepth);
            const combatSpacePos = $from.before(combatSpaceDepth);
            const combatSpaceEnd = $from.after(combatSpaceDepth);
            const payload = getPayloadRecord(combatSpaceNode.attrs.payload);
            const afterCombatParagraph = editor.schema.nodes.paragraph.create();

            void appStore.saveCombatState({ active: false });
            appStore.requestRightPanelClose();

            editor
              .chain()
              .focus()
              .command(({ tr, dispatch }) => {
                if (!dispatch) {
                  return true;
                }

                tr.delete(commandFrom, commandTo);
                tr.setNodeMarkup(combatSpacePos, undefined, {
                  payload: {
                    ...payload,
                    active: false,
                    ended: true,
                  },
                });
                const mappedCombatSpaceEnd = tr.mapping.map(combatSpaceEnd);

                tr.insert(mappedCombatSpaceEnd, afterCombatParagraph);
                tr.setSelection(
                  TextSelection.create(tr.doc, mappedCombatSpaceEnd + 1),
                );
                dispatch(tr.scrollIntoView());
                return true;
              })
              .run();

            return true;
          }

          if (combatants.length < 2 || !combatState) {
            editor
              .chain()
              .focus()
              .command(({ tr, dispatch }) => {
                if (!dispatch) {
                  return true;
                }

                tr.delete(commandFrom, commandTo);
                dispatch(tr.scrollIntoView());
                return true;
              })
              .run();

            return true;
          }

          const currentTurnIndex =
            parsedCommand.action === "turn"
              ? getNextTurnIndex(
                  combatState.currentTurnIndex,
                  combatants.length,
                )
              : combatState.currentTurnIndex;
          const roundNumber =
            parsedCommand.action === "turn"
              ? getNextRoundNumber(
                  combatState.currentTurnIndex,
                  combatants.length,
                  combatState.roundNumber,
                )
              : combatState.roundNumber;
          const activeCombatant = combatants[currentTurnIndex];

          if (!activeCombatant) {
            return false;
          }

          const newTurnNode = editor.schema.nodes.combatTurnBlock?.create(
            {
              payload: createCombatTurnPayload({
                combatantId: activeCombatant.id,
                combatantName: activeCombatant.name,
                roundNumber,
                turnIndex: currentTurnIndex,
                current: true,
              }),
            },
            editor.schema.nodes.paragraph.create(),
          );

          if (!newTurnNode) {
            return false;
          }

          const combatTurnDepth = findAncestorDepth(editor.state, "combatTurnBlock");
          const shouldInsertSpacer = combatTurnDepth !== null;
          const spacerNode = shouldInsertSpacer
            ? editor.schema.nodes.paragraph.create()
            : null;
          const insertPos =
            combatTurnDepth === null
              ? $from.after()
              : $from.after(combatTurnDepth);
          const combatSpaceNode = $from.node(combatSpaceDepth);
          const combatSpacePos = $from.before(combatSpaceDepth);
          const combatSpacePayload = getPayloadRecord(combatSpaceNode.attrs.payload);
          const oldTurnNode =
            combatTurnDepth === null ? null : $from.node(combatTurnDepth);
          const oldTurnPos =
            combatTurnDepth === null ? null : $from.before(combatTurnDepth);
          const oldTurnPayload = oldTurnNode
            ? getPayloadRecord(oldTurnNode.attrs.payload)
            : null;

          if (parsedCommand.action === "turn") {
            void appStore.saveCombatState({
              currentTurnIndex,
              roundNumber,
            });
          }

          editor
            .chain()
            .focus()
            .command(({ tr, dispatch }) => {
              if (!dispatch) {
                return true;
              }

              tr.delete(commandFrom, commandTo);

              if (
                parsedCommand.action === "turn" &&
                oldTurnPos !== null &&
                oldTurnPayload
              ) {
                tr.setNodeMarkup(oldTurnPos, undefined, {
                  payload: {
                    ...oldTurnPayload,
                    current: false,
                    collapsed: true,
                  },
                });
              }

              tr.setNodeMarkup(combatSpacePos, undefined, {
                payload: {
                  ...combatSpacePayload,
                  active: true,
                  ended: false,
                  currentTurnIndex,
                  roundNumber,
                },
              });
              const mappedInsertPos = tr.mapping.map(insertPos);

              if (spacerNode) {
                tr.insert(mappedInsertPos, spacerNode);
                tr.insert(mappedInsertPos + spacerNode.nodeSize, newTurnNode);
              } else {
                tr.insert(mappedInsertPos, newTurnNode);
              }

              dispatch(tr.scrollIntoView());
              return true;
            })
            .run();

          return true;
        }

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
