import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import type { ComponentType } from "react";

export function createSceneContainerExtension(
  view: ComponentType<ReactNodeViewProps>,
) {
  return Node.create({
    name: "sceneContainer",

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
            const encoded = element.getAttribute("data-scene-container");

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
            "data-scene-container": encodeURIComponent(
              JSON.stringify(attributes.payload),
            ),
          }),
        },
      };
    },

    parseHTML() {
      return [{ tag: "section[data-scene-container]" }];
    },

    renderHTML({ HTMLAttributes }) {
      return ["section", mergeAttributes(HTMLAttributes), 0];
    },

    addNodeView() {
      return ReactNodeViewRenderer(view);
    },
  });
}
