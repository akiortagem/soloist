import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import type { ComponentType } from "react";

export function createResultBlockExtension(
  view: ComponentType<ReactNodeViewProps>,
) {
  return Node.create({
    name: "resultBlock",

    group: "block",

    atom: true,

    selectable: true,

    draggable: false,

    addAttributes() {
      return {
        block: {
          default: null,
          parseHTML: (element) => {
            const encoded = element.getAttribute("data-result-block");

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
            "data-result-block": encodeURIComponent(
              JSON.stringify(attributes.block),
            ),
          }),
        },
      };
    },

    parseHTML() {
      return [{ tag: "section[data-result-block]" }];
    },

    renderHTML({ HTMLAttributes }) {
      return ["section", mergeAttributes(HTMLAttributes)];
    },

    addNodeView() {
      return ReactNodeViewRenderer(view);
    },
  });
}
