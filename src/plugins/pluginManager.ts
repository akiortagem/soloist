import {
  CharacterSheetTemplateRegistry,
  characterSheetTemplateRegistry,
} from "../characterSheets/characterSheetTemplateRegistry";
import {
  SlashCommandRegistry,
  slashCommandRegistry,
  type SlashCommandDefinition,
} from "../commands/slashCommandRegistry";
import {
  OracleTableRegistry,
  oracleTableRegistry,
  type OracleTableDefinition,
} from "../oracle/oracleRegistry";
import type {
  InstalledPluginRecord,
  PluginRepository,
} from "../persistence/pluginRepository";
import {
  type PluginManifestValidationError,
  validatePluginManifest,
} from "./pluginTypes";

export type PluginManagerStatusKind =
  | "loaded"
  | "disabled"
  | "invalid"
  | "error";

export type PluginContributionCounts = {
  slashCommands: number;
  oracleTables: number;
  characterSheetTemplates: number;
};

export type PluginManagerStatus = {
  pluginId: string;
  name: string;
  version: string;
  enabled: boolean;
  status: PluginManagerStatusKind;
  contributions: PluginContributionCounts;
  errors: PluginManifestValidationError[];
};

export type PluginManagerRegistries = {
  slashCommands: SlashCommandRegistry;
  oracleTables: OracleTableRegistry;
  characterSheetTemplates: CharacterSheetTemplateRegistry;
};

const EMPTY_COUNTS: PluginContributionCounts = {
  slashCommands: 0,
  oracleTables: 0,
  characterSheetTemplates: 0,
};

export class PluginManager {
  private readonly statuses = new Map<string, PluginManagerStatus>();
  private readonly loadedPluginIds = new Set<string>();

  constructor(
    private readonly pluginRepository: PluginRepository,
    private readonly registries: PluginManagerRegistries = {
      slashCommands: slashCommandRegistry,
      oracleTables: oracleTableRegistry,
      characterSheetTemplates: characterSheetTemplateRegistry,
    },
  ) {}

  async reload(): Promise<PluginManagerStatus[]> {
    const plugins = await this.pluginRepository.listInstalled();

    this.clearPluginContributions(plugins);
    this.statuses.clear();

    for (const plugin of plugins) {
      const status = this.loadPlugin(plugin);
      this.statuses.set(plugin.id, status);
    }

    return this.getStatuses();
  }

  getStatuses(): PluginManagerStatus[] {
    return Array.from(this.statuses.values(), cloneStatus);
  }

  getStatus(pluginId: string): PluginManagerStatus | undefined {
    const status = this.statuses.get(pluginId);
    return status ? cloneStatus(status) : undefined;
  }

  private clearPluginContributions(plugins: InstalledPluginRecord[]): void {
    const pluginIds = new Set([
      ...this.loadedPluginIds,
      ...plugins.map((plugin) => plugin.id),
    ]);

    for (const pluginId of pluginIds) {
      this.registries.slashCommands.unregisterPlugin(pluginId);
      this.registries.oracleTables.unregisterPlugin(pluginId);
      this.registries.characterSheetTemplates.unregisterPlugin(pluginId);
    }

    this.loadedPluginIds.clear();
  }

  private loadPlugin(plugin: InstalledPluginRecord): PluginManagerStatus {
    if (!plugin.enabled) {
      return this.createStatus(plugin, "disabled");
    }

    const validation = validatePluginManifest(plugin.manifest);

    if (!validation.ok) {
      return this.createStatus(plugin, "invalid", validation.errors);
    }

    try {
      const counts = this.applyContributions(plugin);
      this.loadedPluginIds.add(plugin.id);
      return this.createStatus(plugin, "loaded", [], counts);
    } catch (error) {
      this.registries.slashCommands.unregisterPlugin(plugin.id);
      this.registries.oracleTables.unregisterPlugin(plugin.id);
      this.registries.characterSheetTemplates.unregisterPlugin(plugin.id);

      return this.createStatus(plugin, "error", [
        {
          path: "$",
          code: "INVALID_FIELD_VALUE",
          message: error instanceof Error ? error.message : String(error),
        },
      ]);
    }
  }

  private applyContributions(
    plugin: InstalledPluginRecord,
  ): PluginContributionCounts {
    const contributions = plugin.manifest.contributes;
    const counts: PluginContributionCounts = { ...EMPTY_COUNTS };

    for (const contribution of contributions?.slashCommands ?? []) {
      this.registries.slashCommands.register({
        id: createContributionId(plugin.id, contribution.id),
        name: contribution.name,
        label: contribution.label,
        description: contribution.description,
        prefix: contribution.prefix,
        commandText: contribution.commandText,
        source: "plugin",
        pluginId: plugin.id,
      } satisfies SlashCommandDefinition);
      counts.slashCommands += 1;
    }

    for (const contribution of contributions?.oracleTables ?? []) {
      this.registries.oracleTables.register({
        ...contribution,
        id: createContributionId(plugin.id, contribution.id),
        contributionId: contribution.id,
        source: "plugin",
        pluginId: plugin.id,
      } satisfies OracleTableDefinition);
      counts.oracleTables += 1;
    }

    for (const contribution of contributions?.characterSheetTemplates ?? []) {
      this.registries.characterSheetTemplates.register({
        id: createContributionId(plugin.id, contribution.id),
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

  private createStatus(
    plugin: InstalledPluginRecord,
    status: PluginManagerStatusKind,
    errors: PluginManifestValidationError[] = [],
    contributions: PluginContributionCounts = EMPTY_COUNTS,
  ): PluginManagerStatus {
    return {
      pluginId: plugin.id,
      name: plugin.name,
      version: plugin.version,
      enabled: plugin.enabled,
      status,
      contributions: { ...contributions },
      errors: errors.map((error) => ({ ...error })),
    };
  }
}

function createContributionId(pluginId: string, contributionId: string) {
  return `${pluginId}:${contributionId}`;
}

function cloneStatus(status: PluginManagerStatus): PluginManagerStatus {
  return {
    ...status,
    contributions: { ...status.contributions },
    errors: status.errors.map((error) => ({ ...error })),
  };
}
