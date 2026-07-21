import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
import { TextSelection } from "@tiptap/pm/state";
import type { ApplyCommandResultInput } from "./ApplyCommandResultInput";

export type { ApplyCommandResultInput } from "./ApplyCommandResultInput";

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

function findAncestorDepth(
  state: EditorState,
  typeName: string,
): number | null {
  const { $from } = state.selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === typeName) {
      return depth;
    }
  }

  return null;
}

function getPayloadRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function replacementNodesForBlock(
  input: ApplyCommandResultInput,
  node: ProseMirrorNode,
) {
  const { editor, paragraph, commandStart, cursor } = input;
  const beforeParagraph = paragraphWithContent(paragraph, 0, commandStart);
  const afterParagraph =
    paragraphWithContent(
      paragraph,
      cursor.parentOffset,
      paragraph.content.size,
    ) ?? editor.schema.nodes.paragraph.create();

  return [beforeParagraph, node, afterParagraph].filter(
    (candidate): candidate is ProseMirrorNode => Boolean(candidate),
  );
}

function replaceCommandParagraph(
  input: ApplyCommandResultInput,
  node: ProseMirrorNode,
) {
  const replacementNodes = replacementNodesForBlock(input, node);
  const from = input.cursor.before();
  const to = input.cursor.after();

  input.editor
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

export function applyCommandResult(input: ApplyCommandResultInput): boolean {
  const { editor, result, commandStart, cursor } = input;
  const commandFrom = cursor.start() + commandStart;
  const commandTo = cursor.pos;

  if (result.type === "insertResultBlock") {
    if (result.display === "inline") {
      const inlineResultNode = editor.schema.nodes.inlineResultBlock?.create({
        block: result.block,
      });

      if (!inlineResultNode) {
        return false;
      }

      editor
        .chain()
        .focus()
        .command(({ tr, dispatch }) => {
          if (!dispatch) {
            return true;
          }

          tr.replaceWith(commandFrom, commandTo, inlineResultNode);
          tr.setSelection(
            TextSelection.create(
              tr.doc,
              commandFrom + inlineResultNode.nodeSize,
            ),
          );
          dispatch(tr.scrollIntoView());
          return true;
        })
        .run();

      return true;
    }

    const resultNode = editor.schema.nodes.resultBlock?.create({
      block: result.block,
    });

    return resultNode ? replaceCommandParagraph(input, resultNode) : false;
  }

  if (result.type === "insertSceneContainer") {
    const sceneNode = editor.schema.nodes.sceneContainer?.create(
      {
        payload: result.payload,
      },
      editor.schema.nodes.paragraph.create(),
    );

    return sceneNode ? replaceCommandParagraph(input, sceneNode) : false;
  }

  if (result.type === "insertCombatSpace") {
    const turnNode = result.initialTurn
      ? editor.schema.nodes.combatTurnBlock?.create(
          {
            payload: result.initialTurn,
          },
          editor.schema.nodes.paragraph.create(),
        )
      : null;
    const combatSpaceNode = editor.schema.nodes.combatSpace?.create(
      {
        payload: result.payload,
      },
      turnNode
        ? [turnNode, editor.schema.nodes.paragraph.create()]
        : [editor.schema.nodes.paragraph.create()],
    );

    return combatSpaceNode
      ? replaceCommandParagraph(input, combatSpaceNode)
      : false;
  }

  if (result.type === "endCombat") {
    const combatSpaceDepth = findAncestorDepth(editor.state, "combatSpace");

    if (combatSpaceDepth === null) {
      return false;
    }

    const combatSpaceNode = cursor.node(combatSpaceDepth);
    const combatSpacePos = cursor.before(combatSpaceDepth);
    const combatSpaceEnd = cursor.after(combatSpaceDepth);
    const payload = getPayloadRecord(combatSpaceNode.attrs.payload);
    const afterCombatParagraph = editor.schema.nodes.paragraph.create();

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
        tr.setSelection(TextSelection.create(tr.doc, mappedCombatSpaceEnd + 1));
        dispatch(tr.scrollIntoView());
        return true;
      })
      .run();

    return true;
  }

  if (result.type === "deleteCommand") {
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

  const combatSpaceDepth = findAncestorDepth(editor.state, "combatSpace");

  if (combatSpaceDepth === null) {
    return false;
  }

  const newTurnNode = editor.schema.nodes.combatTurnBlock?.create(
    {
      payload: result.turnPayload,
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
    combatTurnDepth === null ? cursor.after() : cursor.after(combatTurnDepth);
  const combatSpaceNode = cursor.node(combatSpaceDepth);
  const combatSpacePos = cursor.before(combatSpaceDepth);
  const combatSpacePayload = getPayloadRecord(combatSpaceNode.attrs.payload);
  const oldTurnNode =
    combatTurnDepth === null ? null : cursor.node(combatTurnDepth);
  const oldTurnPos =
    combatTurnDepth === null ? null : cursor.before(combatTurnDepth);
  const oldTurnPayload = oldTurnNode
    ? getPayloadRecord(oldTurnNode.attrs.payload)
    : null;

  editor
    .chain()
    .focus()
    .command(({ tr, dispatch }) => {
      if (!dispatch) {
        return true;
      }

      tr.delete(commandFrom, commandTo);

      if (result.collapseCurrentTurn && oldTurnPos !== null && oldTurnPayload) {
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
          ...result.combatSpacePayload,
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
