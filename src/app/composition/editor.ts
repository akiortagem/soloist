import StarterKit from "@tiptap/starter-kit";
import {
  CombatSpaceView,
  CombatTurnBlockView,
  ResultBlockView,
  SceneContainerView,
  createCombatSpaceExtension,
  createCombatTurnBlockExtension,
  createInlineResultBlockExtension,
  createResultBlockExtension,
  createSceneContainerExtension,
  createSlashCommandExtension,
  createSaveDocument,
  StoreDocumentWriter,
} from "../../features/editor";
import {
  markdownToTiptapJson,
  tiptapJsonToMarkdown,
} from "../../features/editor/infrastructure/markdown";

export function createEditorAdapter() {
  const writer = new StoreDocumentWriter();
  const saveDocument = createSaveDocument(writer);
  const documentExtensions = [
    StarterKit,
    createCombatTurnBlockExtension(CombatTurnBlockView),
    createCombatSpaceExtension(CombatSpaceView),
    createResultBlockExtension(ResultBlockView),
    createInlineResultBlockExtension(ResultBlockView),
    createSceneContainerExtension(SceneContainerView),
  ];

  return {
    saveDocument,
    markDocumentSavePending: () => writer.markPending(),
    extensions(input: {
      executeCommand: Parameters<
        typeof createSlashCommandExtension
      >[0]["executeCommand"];
      getChaosFactor: () => number;
      supportsSlashCommands: boolean;
    }) {
      return input.supportsSlashCommands
        ? [
            ...documentExtensions,
            createSlashCommandExtension({
              executeCommand: input.executeCommand,
              getChaosFactor: input.getChaosFactor,
            }),
          ]
        : [StarterKit];
    },
    parseMarkdown: markdownToTiptapJson,
    serialize: tiptapJsonToMarkdown,
  };
}
