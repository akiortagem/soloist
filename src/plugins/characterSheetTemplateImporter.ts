import { normalizeTemplateItems } from "../characterSheets/characterSheetTemplateLogic";
import type {
  CharacterSheetTemplate,
  CharacterTemplateItem,
} from "../domain/domainTypes";
import type { CharacterSheetRepository } from "../persistence/characterSheetRepository";
import type {
  InstalledPluginRecord,
  PluginRepository,
} from "../persistence/pluginRepository";
import {
  type CharacterSheetTemplateContribution,
  validatePluginManifest,
} from "./pluginTypes";

const IMPORT_STORAGE_KEY = "characterSheetTemplateImports";

type PluginTemplateImport = {
  contributionId: string;
  templateIds: string[];
};

type CharacterSheetTemplateImportRepositories = {
  characterSheets: Pick<
    CharacterSheetRepository,
    "createTemplate" | "listTemplates"
  >;
  plugins: Pick<PluginRepository, "get" | "getStorage" | "listInstalled" | "setStorage">;
};

export async function importCharacterSheetTemplatesFromPlugins(
  repositories: CharacterSheetTemplateImportRepositories,
) {
  const plugins = await repositories.plugins.listInstalled();
  const importedTemplates: CharacterSheetTemplate[] = [];

  for (const plugin of plugins) {
    if (!plugin.enabled) {
      continue;
    }

    const validation = validatePluginManifest(plugin.manifest);

    if (!validation.ok) {
      continue;
    }

    for (const contribution of plugin.manifest.contributes
      ?.characterSheetTemplates ?? []) {
      const imports = await readPluginTemplateImports(repositories, plugin.id);

      if (
        imports.some((entry) => entry.contributionId === contribution.id)
      ) {
        continue;
      }

      const importedTemplate = await createTemplateCopyFromContribution(
        repositories,
        plugin,
        contribution,
      );
      await appendPluginTemplateImport(repositories, plugin.id, {
        contributionId: contribution.id,
        templateIds: [importedTemplate.id],
      });
      importedTemplates.push(importedTemplate);
    }
  }

  return importedTemplates;
}

export async function reinstallPluginCharacterSheetTemplate(
  repositories: CharacterSheetTemplateImportRepositories,
  input: {
    pluginId: string;
    contributionId: string;
  },
) {
  const plugin = await repositories.plugins.get(input.pluginId);

  if (!plugin) {
    throw new Error(`Plugin is not installed: ${input.pluginId}`);
  }

  const validation = validatePluginManifest(plugin.manifest);

  if (!validation.ok) {
    throw new Error(`Plugin manifest is invalid: ${input.pluginId}`);
  }

  const contribution = plugin.manifest.contributes?.characterSheetTemplates?.find(
    (candidate) => candidate.id === input.contributionId,
  );

  if (!contribution) {
    throw new Error(
      `Character sheet template contribution is missing: ${input.contributionId}`,
    );
  }

  const importedTemplate = await createTemplateCopyFromContribution(
    repositories,
    plugin,
    contribution,
  );
  const imports = await readPluginTemplateImports(repositories, plugin.id);
  const existing = imports.find(
    (entry) => entry.contributionId === input.contributionId,
  );

  if (existing) {
    existing.templateIds = [...existing.templateIds, importedTemplate.id];
    await writePluginTemplateImports(repositories, plugin.id, imports);
  } else {
    await appendPluginTemplateImport(repositories, plugin.id, {
      contributionId: input.contributionId,
      templateIds: [importedTemplate.id],
    });
  }

  return importedTemplate;
}

async function createTemplateCopyFromContribution(
  repositories: CharacterSheetTemplateImportRepositories,
  plugin: InstalledPluginRecord,
  contribution: CharacterSheetTemplateContribution,
) {
  const existingTemplates = await repositories.characterSheets.listTemplates();

  return repositories.characterSheets.createTemplate({
    name: createUniqueTemplateName(
      contribution.name,
      existingTemplates.map((template) => template.name),
    ),
    fields: normalizeTemplateItems(
      contribution.fields as CharacterTemplateItem[],
    ),
    sourcePluginId: plugin.id,
    sourceContributionId: contribution.id,
  });
}

async function readPluginTemplateImports(
  repositories: CharacterSheetTemplateImportRepositories,
  pluginId: string,
) {
  const imports = await repositories.plugins.getStorage<PluginTemplateImport[]>(
    pluginId,
    IMPORT_STORAGE_KEY,
  );

  return Array.isArray(imports) ? imports : [];
}

async function appendPluginTemplateImport(
  repositories: CharacterSheetTemplateImportRepositories,
  pluginId: string,
  importedTemplate: PluginTemplateImport,
) {
  const imports = await readPluginTemplateImports(repositories, pluginId);
  await writePluginTemplateImports(repositories, pluginId, [
    ...imports,
    importedTemplate,
  ]);
}

async function writePluginTemplateImports(
  repositories: CharacterSheetTemplateImportRepositories,
  pluginId: string,
  imports: PluginTemplateImport[],
) {
  await repositories.plugins.setStorage(
    pluginId,
    IMPORT_STORAGE_KEY,
    imports,
  );
}

export function createUniqueTemplateName(baseName: string, existingNames: string[]) {
  const base = baseName.trim() || "Imported Template";
  const usedNames = new Set(
    existingNames.map((name) => name.trim().toLocaleLowerCase()),
  );

  if (!usedNames.has(base.toLocaleLowerCase())) {
    return base;
  }

  let index = 2;

  while (usedNames.has(`${base} (${index})`.toLocaleLowerCase())) {
    index += 1;
  }

  return `${base} (${index})`;
}
