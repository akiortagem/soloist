import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CombatTurnBlockView } from "../combatBlocks/CombatTurnBlockView";

export const CombatTurnBlockExtension = Node.create({
  name: "combatTurnBlock",

  group: "block",

  content: "block+",

  isolating: true,

  selectable: true,

  draggable: false,

  addAttributes() {
    return {
      payload: {
        default: null,
        parseHTML: (element) => {
          const encoded = element.getAttribute("data-combat-turn-block");

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
          "data-combat-turn-block": encodeURIComponent(
            JSON.stringify(attributes.payload),
          ),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "section[data-combat-turn-block]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["section", mergeAttributes(HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CombatTurnBlockView);
  },
});
