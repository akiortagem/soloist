import { normalizeTemplateItems } from "../characterSheets/characterSheetTemplateLogic";
import type { CharacterSheetTemplate } from "../domain/domainTypes";
import type { PluginManifest } from "./pluginTypes";
import { validatePluginManifest } from "./pluginTypes";

const DEFAULT_PLUGIN_VERSION = "1.0.0";
const SOLOIST_API_VERSION = "1";

export function createCharacterSheetTemplatePluginManifest(
  template: CharacterSheetTemplate,
) {
  const slug = createPluginSlug(template.name);
  const manifest = cleanJsonValue({
    id: `soloist-plugin.${slug}`,
    name: `${template.name.trim() || "Character Sheet"} Template`,
    version: DEFAULT_PLUGIN_VERSION,
    soloistApiVersion: SOLOIST_API_VERSION,
    type: "data",
    contributes: {
      characterSheetTemplates: [
        {
          id: slug,
          name: template.name.trim() || "Character Sheet",
          fields: normalizeTemplateItems(template.fields),
        },
      ],
    },
  }) as PluginManifest;
  const validation = validatePluginManifest(manifest);

  if (!validation.ok) {
    throw new Error(
      validation.errors
        .map((error) => `${error.path}: ${error.message}`)
        .join("\n"),
    );
  }

  return manifest;
}

export function createPluginManifestFileName(templateName: string) {
  return `${createPluginSlug(templateName)}-plugin.json`;
}

export function createPluginSlug(value: string) {
  const slug = value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "character-sheet-template";
}

function cleanJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as unknown;
}
