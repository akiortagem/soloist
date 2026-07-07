import type { CharacterSheet, CharacterTemplateItem } from "../../domain/domainTypes";
import {
  normalizeTemplateItems,
  syncFieldsWithTemplate,
} from "../../characterSheets/characterSheetTemplateLogic";
import { createRepositories } from "../../persistence/sessionRepository";
import { reinstallPluginCharacterSheetTemplate } from "../../plugins/characterSheetTemplateImporter";
import { setState, state } from "./stateCore";

export const templateActions = {
  async loadTemplates() {
    setState({
      isLoadingTemplates: true,
      persistenceError: undefined,
    });

    try {
      const repositories = await createRepositories();
      const loadedTemplates = await repositories.characterSheets.listTemplates();
      const characterSheetTemplates = loadedTemplates.map((template) => ({
        ...template,
        fields: normalizeTemplateItems(template.fields),
      }));
      const activeTemplate =
        characterSheetTemplates.find(
          (template) => template.id === state.activeTemplateId,
        ) ??
        characterSheetTemplates[0] ??
        null;

      setState({
        characterSheetTemplates,
        activeTemplateId: activeTemplate?.id,
        activeTemplate,
        persistenceMessage:
          characterSheetTemplates.length > 0
            ? `Read ${characterSheetTemplates.length} template${
                characterSheetTemplates.length === 1 ? "" : "s"
              } from SQLite.`
            : "No templates yet.",
      });
    } catch (error) {
      setState({
        characterSheetTemplates: [],
        activeTemplate: null,
        activeTemplateId: undefined,
        persistenceError: error instanceof Error ? error.message : String(error),
        persistenceMessage: "Template load failed.",
      });
    } finally {
      setState({ isLoadingTemplates: false });
    }
  },

  selectTemplate(templateId: string) {
    const activeTemplate =
      state.characterSheetTemplates.find(
        (template) => template.id === templateId,
      ) ?? null;

    setState({
      activeTemplateId: activeTemplate?.id,
      activeTemplate,
      persistenceError: undefined,
    });
  },

  async createTemplate(input?: {
    name?: string;
    fields?: CharacterTemplateItem[];
  }) {
    setState({
      isSavingTemplate: true,
      persistenceError: undefined,
    });

    try {
      const repositories = await createRepositories();
      const createdTemplate = await repositories.characterSheets.createTemplate({
        name: input?.name?.trim() || "New Template",
        fields: normalizeTemplateItems(input?.fields ?? []),
      });
      const characterSheetTemplates =
        await repositories.characterSheets.listTemplates();
      const activeTemplate =
        characterSheetTemplates.find(
          (template) => template.id === createdTemplate.id,
        ) ?? createdTemplate;

      setState({
        characterSheetTemplates,
        activeTemplateId: activeTemplate.id,
        activeTemplate,
        persistenceMessage: `Created template ${activeTemplate.name}.`,
      });

      return activeTemplate;
    } catch (error) {
      setState({
        persistenceError: error instanceof Error ? error.message : String(error),
        persistenceMessage: "Template create failed.",
      });
      return null;
    } finally {
      setState({ isSavingTemplate: false });
    }
  },

  async reinstallPluginTemplate(input: {
    pluginId: string;
    contributionId: string;
  }) {
    setState({
      isSavingTemplate: true,
      persistenceError: undefined,
    });

    try {
      const repositories = await createRepositories();
      const createdTemplate = await reinstallPluginCharacterSheetTemplate(
        repositories,
        input,
      );
      const characterSheetTemplates =
        await repositories.characterSheets.listTemplates();
      const activeTemplate =
        characterSheetTemplates.find(
          (template) => template.id === createdTemplate.id,
        ) ?? createdTemplate;

      setState({
        characterSheetTemplates,
        activeTemplateId: activeTemplate.id,
        activeTemplate,
        persistenceMessage: `Reinstalled template ${activeTemplate.name}.`,
      });

      return activeTemplate;
    } catch (error) {
      setState({
        persistenceError: error instanceof Error ? error.message : String(error),
        persistenceMessage: "Template reinstall failed.",
      });
      return null;
    } finally {
      setState({ isSavingTemplate: false });
    }
  },

  async saveTemplate(input: {
    id: string;
    name?: string;
    fields?: CharacterTemplateItem[];
  }) {
    setState({
      isSavingTemplate: true,
      persistenceError: undefined,
    });

    try {
      const repositories = await createRepositories();
      const activeTemplate = await repositories.characterSheets.updateTemplate({
        id: input.id,
        name: input.name?.trim() || undefined,
        fields: input.fields ? normalizeTemplateItems(input.fields) : undefined,
      });

      if (!activeTemplate) {
        return null;
      }

      const templateSheets =
        await repositories.characterSheets.listByTemplateId(activeTemplate.id);
      const syncedSheets: CharacterSheet[] = [];

      for (const sheet of templateSheets) {
        const fields = syncFieldsWithTemplate(sheet.fields, activeTemplate.fields);

        if (JSON.stringify(fields) === JSON.stringify(sheet.fields)) {
          syncedSheets.push(sheet);
          continue;
        }

        const updatedSheet = await repositories.characterSheets.update({
          id: sheet.id,
          fields,
        });

        syncedSheets.push(updatedSheet ?? sheet);
      }

      setState({
        activeTemplate,
        activeTemplateId: activeTemplate.id,
        characterSheetTemplates: state.characterSheetTemplates.map((template) =>
          template.id === activeTemplate.id ? activeTemplate : template,
        ),
        activeCharacterSheet:
          syncedSheets.find(
            (sheet) => sheet.id === state.activeCharacterSheet?.id,
          ) ?? state.activeCharacterSheet,
        characterSheets: state.characterSheets.map(
          (sheet) =>
            syncedSheets.find((syncedSheet) => syncedSheet.id === sheet.id) ??
            sheet,
        ),
        persistenceMessage: `Saved template ${activeTemplate.name}.`,
      });

      return activeTemplate;
    } catch (error) {
      setState({
        persistenceError: error instanceof Error ? error.message : String(error),
        persistenceMessage: "Template save failed.",
      });
      return null;
    } finally {
      setState({ isSavingTemplate: false });
    }
  },

  async deleteTemplate(templateId: string) {
    setState({
      isSavingTemplate: true,
      persistenceError: undefined,
    });

    try {
      const repositories = await createRepositories();
      await repositories.characterSheets.deleteTemplate(templateId);
      const characterSheetTemplates =
        await repositories.characterSheets.listTemplates();
      const activeTemplate =
        state.activeTemplateId === templateId
          ? (characterSheetTemplates[0] ?? null)
          : (characterSheetTemplates.find(
              (template) => template.id === state.activeTemplateId,
            ) ?? null);

      setState({
        characterSheetTemplates,
        activeTemplateId: activeTemplate?.id,
        activeTemplate,
        persistenceMessage: "Template deleted.",
      });
    } catch (error) {
      setState({
        persistenceError: error instanceof Error ? error.message : String(error),
        persistenceMessage: "Template delete failed.",
      });
    } finally {
      setState({ isSavingTemplate: false });
    }
  },
};
