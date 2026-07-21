import { normalizeTemplateItems } from "../../../characterSheets/characterSheetTemplateLogic";
import type { CharacterSheetRepository } from "../../../persistence/characterSheetRepository";
import type { PluginRepository as LegacyPluginRepository } from "../../../persistence/pluginRepository";
import {
  importCharacterSheetTemplatesFromPlugins,
  reinstallPluginCharacterSheetTemplate,
} from "../../../plugins/characterSheetTemplateImporter";
import type { PluginTemplates } from "../application/ports/PluginPorts";

type Repositories = {
  characterSheets: CharacterSheetRepository;
  plugins: LegacyPluginRepository;
};

export class PluginTemplateAdapter implements PluginTemplates {
  constructor(private readonly repositories: Repositories) {}

  async refresh() {
    await importCharacterSheetTemplatesFromPlugins(this.repositories);
  }

  reinstall(input: { pluginId: string; contributionId: string }) {
    return reinstallPluginCharacterSheetTemplate(this.repositories, input);
  }

  async list() {
    return (await this.repositories.characterSheets.listTemplates()).map(
      (template) => ({
        ...template,
        fields: normalizeTemplateItems(template.fields),
      }),
    );
  }
}
