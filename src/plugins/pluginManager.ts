import {
  CharacterSheetTemplateRegistry,
  characterSheetTemplateRegistry,
} from "../characterSheets/characterSheetTemplateRegistry";
import { invoke } from "@tauri-apps/api/core";
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
import {
  type ScriptPluginRuntime,
  WorkerScriptPluginRuntime,
} from "./scriptPluginRuntime";
import { validateSlashCommandRegistration } from "./pluginValidation";
import { pluginUiRegistry } from "./pluginUiRegistry";
import { unregisterPluginOracleProviders } from "../oracle/oracleRegistry";

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
  pluginType: InstalledPluginRecord["type"];
  typeLabel: string;
  contributionLabels: string[];
  isCharacterSheetTemplatePlugin: boolean;
  status: PluginManagerStatusKind;
  contributions: PluginContributionCounts;
  errors: PluginManifestValidationError[];
  permissions: string[];
};

export type PluginManagerRegistries = {
  slashCommands: SlashCommandRegistry;
  oracleTables: OracleTableRegistry;
  characterSheetTemplates: CharacterSheetTemplateRegistry;
};

export type PluginEntryReader = (input: {
  pluginId: string;
  entry: string;
}) => Promise<string>;

export type PluginManagerOptions = {
  registries?: PluginManagerRegistries;
  scriptRuntime?: ScriptPluginRuntime;
  readPluginEntry?: PluginEntryReader;
};

const EMPTY_COUNTS: PluginContributionCounts = {
  slashCommands: 0,
  oracleTables: 0,
  characterSheetTemplates: 0,
};

export class PluginManager {
  private readonly statuses = new Map<string, PluginManagerStatus>();
  private readonly loadedPluginIds = new Set<string>();
  private readonly registries: PluginManagerRegistries;
  private readonly scriptRuntime: ScriptPluginRuntime;
  private readonly readPluginEntry: PluginEntryReader;

  constructor(
    private readonly pluginRepository: PluginRepository,
    optionsOrRegistries: PluginManagerOptions | PluginManagerRegistries = {},
  ) {
    const options = isPluginManagerRegistries(optionsOrRegistries)
      ? { registries: optionsOrRegistries }
      : optionsOrRegistries;

    this.registries = options.registries ?? {
      slashCommands: slashCommandRegistry,
      oracleTables: oracleTableRegistry,
      characterSheetTemplates: characterSheetTemplateRegistry,
    };
    this.scriptRuntime =
      options.scriptRuntime ?? new WorkerScriptPluginRuntime(pluginRepository);
    this.readPluginEntry = options.readPluginEntry ?? readInstalledPluginEntry;
  }

  async reload(): Promise<PluginManagerStatus[]> {
    const plugins = await this.pluginRepository.listInstalled();

    this.clearPluginContributions(plugins);
    this.statuses.clear();

    for (const plugin of plugins) {
      const status = await this.loadPlugin(plugin);
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
      pluginUiRegistry.unregisterPlugin(pluginId);
      unregisterPluginOracleProviders(pluginId);
      this.registries.slashCommands.unregisterPlugin(pluginId);
      this.registries.oracleTables.unregisterPlugin(pluginId);
      this.registries.characterSheetTemplates.unregisterPlugin(pluginId);
      this.scriptRuntime.deactivatePlugin(pluginId);
    }

    this.loadedPluginIds.clear();
  }

  private async loadPlugin(plugin: InstalledPluginRecord): Promise<PluginManagerStatus> {
    if (!plugin.enabled) {
      return this.createStatus(plugin, "disabled");
    }

    const validation = validatePluginManifest(plugin.manifest);

    if (!validation.ok) {
      return this.createStatus(plugin, "invalid", validation.errors);
    }

    try {
      const counts =
        plugin.type === "script"
          ? await this.applyScriptPluginContributions(plugin)
          : this.applyDataPluginContributions(plugin);
      this.loadedPluginIds.add(plugin.id);
      return this.createStatus(plugin, "loaded", [], counts);
    } catch (error) {
      pluginUiRegistry.unregisterPlugin(plugin.id);
      unregisterPluginOracleProviders(plugin.id);
      this.scriptRuntime.deactivatePlugin(plugin.id);
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

  private applyDataPluginContributions(
    plugin: InstalledPluginRecord,
  ): PluginContributionCounts {
    const contributions = plugin.manifest.contributes;
    const counts: PluginContributionCounts = { ...EMPTY_COUNTS };

    for (const contribution of contributions?.slashCommands ?? []) {
      const tableId = contribution.tableId
        ? createContributionId(plugin.id, contribution.tableId)
        : undefined;

      this.registries.slashCommands.register({
        id: createContributionId(plugin.id, contribution.id),
        name: contribution.name,
        label: contribution.label,
        description: contribution.description,
        prefix: contribution.prefix,
        commandText: contribution.commandText,
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

  private async applyScriptPluginContributions(
    plugin: InstalledPluginRecord,
  ): Promise<PluginContributionCounts> {
    const counts: PluginContributionCounts = { ...EMPTY_COUNTS };
    const entry = plugin.manifest.entry;

    if (!entry) {
      throw new Error("Script plugin entry is required");
    }

    const entryCode = await this.readPluginEntry({
      pluginId: plugin.id,
      entry,
    });
    const activation = await this.scriptRuntime.activatePlugin({
      pluginId: plugin.id,
      entryCode,
      permissions: plugin.manifest.permissions ?? [],
      onRuntimeError: (message) => this.setRuntimeErrorStatus(plugin, message),
    });

    const commandIds = new Set<string>();
    const commandNames = new Set<string>();
    for (const rawCommand of activation.slashCommands as unknown[]) {
      const command = validateSlashCommandRegistration(rawCommand);
      if (commandIds.has(command.id)) {
        throw new Error(`Duplicate slash command id: ${command.id}`);
      }
      const normalizedName = command.name.toLowerCase();
      if (commandNames.has(normalizedName)) {
        throw new Error(`Duplicate slash command name: ${command.name}`);
      }
      commandIds.add(command.id);
      commandNames.add(normalizedName);
      this.registries.slashCommands.register({
        id: createContributionId(plugin.id, command.id),
        name: command.name,
        label: command.label,
        description: command.description,
        prefix: command.prefix,
        source: "plugin",
        pluginId: plugin.id,
        parse: ({ raw, commandName, argsText }) => ({
          type: "scriptPlugin",
          raw,
          commandName,
          pluginId: plugin.id,
          commandId: command.id,
          argsText,
          args: splitCommandArgs(argsText),
          execute: (context) =>
            this.scriptRuntime.executeCommand(plugin.id, command.id, context),
        }),
      } satisfies SlashCommandDefinition);
      counts.slashCommands += 1;
    }

    return counts;
  }

  private setRuntimeErrorStatus(
    plugin: InstalledPluginRecord,
    message: string,
  ): void {
    const current = this.statuses.get(plugin.id);
    const error: PluginManifestValidationError = {
      path: "$.entry",
      code: "INVALID_FIELD_VALUE",
      message,
    };

    this.registries.slashCommands.unregisterPlugin(plugin.id);
    pluginUiRegistry.unregisterPlugin(plugin.id);
    unregisterPluginOracleProviders(plugin.id);
    this.registries.oracleTables.unregisterPlugin(plugin.id);
    this.registries.characterSheetTemplates.unregisterPlugin(plugin.id);
    this.scriptRuntime.deactivatePlugin(plugin.id);
    this.loadedPluginIds.delete(plugin.id);

    this.statuses.set(
      plugin.id,
      this.createStatus(
        plugin,
        "error",
        [...(current?.errors ?? []), error],
        current?.contributions ?? EMPTY_COUNTS,
      ),
    );
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
      pluginType: plugin.type,
      typeLabel: createPluginTypeLabel(plugin),
      contributionLabels: createPluginContributionLabels(plugin),
      isCharacterSheetTemplatePlugin: isCharacterSheetTemplatePlugin(plugin),
      status,
      contributions: { ...contributions },
      errors: errors.map((error) => ({ ...error })),
      permissions: [...(plugin.manifest.permissions ?? [])],
    };
  }
}

function createContributionId(pluginId: string, contributionId: string) {
  return `${pluginId}:${contributionId}`;
}

async function readInstalledPluginEntry(input: {
  pluginId: string;
  entry: string;
}) {
  return invoke<string>("read_plugin_entry", input);
}

function splitCommandArgs(argsText: string) {
  const trimmed = argsText.trim();
  return trimmed.length === 0 ? [] : trimmed.split(/\s+/);
}

function isPluginManagerRegistries(
  value: PluginManagerOptions | PluginManagerRegistries,
): value is PluginManagerRegistries {
  return (
    "slashCommands" in value &&
    "oracleTables" in value &&
    "characterSheetTemplates" in value
  );
}

function createPluginTypeLabel(plugin: InstalledPluginRecord) {
  return plugin.type === "data" ? "Data" : "Script";
}

function createPluginContributionLabels(plugin: InstalledPluginRecord) {
  const contributions = plugin.manifest.contributes;
  const labels: string[] = [];

  if ((contributions?.characterSheetTemplates?.length ?? 0) > 0) {
    labels.push("Character sheet template");
  }

  if ((contributions?.slashCommands?.length ?? 0) > 0) {
    labels.push("Slash command");
  }

  if (
    (contributions?.randomTables?.length ?? 0) > 0 ||
    (contributions?.oracleTables?.length ?? 0) > 0
  ) {
    labels.push("Oracle table");
  }

  return labels;
}

function isCharacterSheetTemplatePlugin(plugin: InstalledPluginRecord) {
  return (plugin.manifest.contributes?.characterSheetTemplates?.length ?? 0) > 0;
}

function cloneStatus(status: PluginManagerStatus): PluginManagerStatus {
  return {
    ...status,
    contributionLabels: [...status.contributionLabels],
    contributions: { ...status.contributions },
    errors: status.errors.map((error) => ({ ...error })),
    permissions: [...status.permissions],
  };
}
