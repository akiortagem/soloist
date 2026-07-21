import type { CharacterSheetTemplateRegistry } from "../../../characterSheets/characterSheetTemplateRegistry";
import type {
  SlashCommandDefinition,
  SlashCommandRegistry,
} from "../../commands";
import type {
  OracleTableDefinition,
  OracleTableRegistry,
} from "../../../oracle/oracleRegistry";
import type { InstalledPluginRecord } from "../../../persistence/pluginRepository";
import {
  EMPTY_CONTRIBUTION_COUNTS,
  type PluginContributionCounts,
} from "../domain/PluginManagerStatus";

export type PluginContributionRegistries = {
  slashCommands: SlashCommandRegistry;
  oracleTables: OracleTableRegistry;
  characterSheetTemplates: CharacterSheetTemplateRegistry;
};

export function registerDataPluginContributions(
  plugin: InstalledPluginRecord,
  registries: PluginContributionRegistries,
): PluginContributionCounts {
  const contributions = plugin.manifest.contributes;
  const counts = { ...EMPTY_CONTRIBUTION_COUNTS };

  for (const contribution of contributions?.slashCommands ?? []) {
    const tableId = contribution.tableId
      ? contributionId(plugin.id, contribution.tableId)
      : undefined;
    registries.slashCommands.register({
      ...contribution,
      id: contributionId(plugin.id, contribution.id),
      source: "plugin",
      pluginId: plugin.id,
      tableId,
      parse: tableId
        ? ({ raw, commandName }) => ({
            type: "pluginRandomTable",
            raw,
            commandName,
            pluginId: plugin.id,
            tableId,
          })
        : undefined,
    } satisfies SlashCommandDefinition);
    counts.slashCommands += 1;
  }

  for (const contribution of [
    ...(contributions?.randomTables ?? []),
    ...(contributions?.oracleTables ?? []),
  ]) {
    registries.oracleTables.register({
      ...contribution,
      id: contributionId(plugin.id, contribution.id),
      contributionId: contribution.id,
      source: "plugin",
      pluginId: plugin.id,
    } satisfies OracleTableDefinition);
    counts.oracleTables += 1;
  }

  for (const contribution of contributions?.characterSheetTemplates ?? []) {
    registries.characterSheetTemplates.register({
      id: contributionId(plugin.id, contribution.id),
      name: contribution.name,
      fields: contribution.fields,
      contributionId: contribution.id,
      source: "plugin",
      pluginId: plugin.id,
    });
    counts.characterSheetTemplates += 1;
  }
  return counts;
}

function contributionId(pluginId: string, id: string): string {
  return `${pluginId}:${id}`;
}
