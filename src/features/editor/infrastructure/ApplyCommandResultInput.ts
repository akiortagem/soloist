import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode, ResolvedPos } from "@tiptap/pm/model";
import type { CommandExecutionResult } from "../../commands";

export type ApplyCommandResultInput = {
  editor: Editor;
  result: CommandExecutionResult;
  commandStart: number;
  cursor: ResolvedPos;
  paragraph: ProseMirrorNode;
};
