import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import type { ComponentType } from "react";

export function createInlineResultBlockExtension(
  view: ComponentType<ReactNodeViewProps>,
) {
  return Node.create({
    name: "inlineResultBlock",

    group: "inline",

    inline: true,

    atom: true,

    selectable: true,

    draggable: false,

    addAttributes() {
      return {
        block: {
          default: null,
          parseHTML: (element) => {
            const encoded = element.getAttribute("data-inline-result-block");

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
            "data-inline-result-block": encodeURIComponent(
              JSON.stringify(attributes.block),
            ),
          }),
        },
      };
    },

    parseHTML() {
      return [{ tag: "span[data-inline-result-block]" }];
    },

    renderHTML({ HTMLAttributes }) {
      return ["span", mergeAttributes(HTMLAttributes)];
    },

    addNodeView() {
      return ReactNodeViewRenderer(view);
    },
  });
}
