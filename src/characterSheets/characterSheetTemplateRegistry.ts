import { normalizeTemplateItems } from "./characterSheetTemplateLogic";
import type { CharacterTemplateItem } from "./characterSheetTypes";

export type CharacterSheetTemplateSource = "plugin";

export type CharacterSheetTemplateDefinition = {
  id: string;
  name: string;
  fields: CharacterTemplateItem[];
  source: CharacterSheetTemplateSource;
  pluginId: string;
  contributionId: string;
};

export class CharacterSheetTemplateRegistry {
  private readonly templates = new Map<string, CharacterSheetTemplateDefinition>();

  register(template: CharacterSheetTemplateDefinition): void {
    if (this.templates.has(template.id)) {
      throw new Error(`Character sheet template already registered: ${template.id}`);
    }

    this.templates.set(template.id, cloneTemplate(template));
  }

  list(): CharacterSheetTemplateDefinition[] {
    return Array.from(this.templates.values(), cloneTemplate);
  }

  get(id: string): CharacterSheetTemplateDefinition | undefined {
    const template = this.templates.get(id);
    return template ? cloneTemplate(template) : undefined;
  }

  unregisterPlugin(pluginId: string): void {
    for (const template of this.templates.values()) {
      if (template.pluginId === pluginId) {
        this.templates.delete(template.id);
      }
    }
  }
}

export const characterSheetTemplateRegistry =
  new CharacterSheetTemplateRegistry();

function cloneTemplate(
  template: CharacterSheetTemplateDefinition,
): CharacterSheetTemplateDefinition {
  return {
    ...template,
    fields: normalizeTemplateItems(template.fields),
  };
}
