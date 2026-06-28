import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CombatSpaceView } from "../combatBlocks/CombatSpaceView";

export const CombatSpaceExtension = Node.create({
  name: "combatSpace",

  group: "block",

  content: "block*",

  isolating: true,

  selectable: true,

  draggable: false,

  addAttributes() {
    return {
      payload: {
        default: null,
        parseHTML: (element) => {
          const encoded = element.getAttribute("data-combat-space");

          if (!encoded) {
            return null;
          }

          try {
            return JSON.parse(decodeURIComponent(encoded));
          } catch {
            return null;
          }
        },
        renderHTML: (attributes) => ({
          "data-combat-space": encodeURIComponent(
            JSON.stringify(attributes.payload),
          ),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "section[data-combat-space]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["section", mergeAttributes(HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CombatSpaceView);
  },
});
