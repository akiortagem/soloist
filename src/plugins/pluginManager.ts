import {
  CharacterSheetTemplateRegistry,
  characterSheetTemplateRegistry,
} from "../characterSheets/characterSheetTemplateRegistry";
import {
  SlashCommandRegistry,
  slashCommandRegistry,
} from "../features/commands";
import {
  OracleTableRegistry,
  oracleTableRegistry,
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
import type { PluginContributionCleanup } from "../features/plugins/application/ports/PluginContributionCleanup";
import { registerScriptCommands } from "../features/plugins/infrastructure/ScriptCommandRegistrar";
import { registerDataPluginContributions } from "../features/plugins/infrastructure/DataPluginContributionRegistrar";
import {
  clonePluginManagerStatus,
  createPluginManagerStatus,
  EMPTY_CONTRIBUTION_COUNTS,
  type PluginContributionCounts,
  type PluginManagerStatus,
  type PluginManagerStatusKind,
} from "../features/plugins/domain/PluginManagerStatus";

export type {
  PluginContributionCounts,
  PluginManagerStatus,
  PluginManagerStatusKind,
} from "../features/plugins/domain/PluginManagerStatus";

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
  cleanup?: PluginContributionCleanup;
};

export class PluginManager {
  private readonly statuses = new Map<string, PluginManagerStatus>();
  private readonly loadedPluginIds = new Set<string>();
  private readonly registries: PluginManagerRegistries;
  private readonly scriptRuntime: ScriptPluginRuntime;
  private readonly readPluginEntry: PluginEntryReader;
  private readonly cleanup: PluginContributionCleanup;

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
    this.cleanup = options.cleanup ?? { unregister() {} };
  }

  async reload(): Promise<PluginManagerStatus[]> {
    const plugins = await this.pluginRepository.listInstalled();

    await this.clearPluginContributions(plugins);
    this.statuses.clear();

    for (const plugin of plugins) {
      const status = await this.loadPlugin(plugin);
      this.statuses.set(plugin.id, status);
    }

    return this.getStatuses();
  }

  getStatuses(): PluginManagerStatus[] {
    return Array.from(this.statuses.values(), clonePluginManagerStatus);
  }

  getStatus(pluginId: string): PluginManagerStatus | undefined {
    const status = this.statuses.get(pluginId);
    return status ? clonePluginManagerStatus(status) : undefined;
  }

  private async clearPluginContributions(plugins: InstalledPluginRecord[]): Promise<void> {
    const pluginIds = new Set([
      ...this.loadedPluginIds,
      ...plugins.map((plugin) => plugin.id),
    ]);

    for (const pluginId of pluginIds) {
      this.cleanup.unregister(pluginId);
      this.registries.slashCommands.unregisterPlugin(pluginId);
      this.registries.oracleTables.unregisterPlugin(pluginId);
      this.registries.characterSheetTemplates.unregisterPlugin(pluginId);
      await this.scriptRuntime.deactivatePlugin(pluginId);
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
          : registerDataPluginContributions(plugin, this.registries);
      this.loadedPluginIds.add(plugin.id);
      return this.createStatus(plugin, "loaded", [], counts);
    } catch (error) {
      this.cleanup.unregister(plugin.id);
      await this.scriptRuntime.deactivatePlugin(plugin.id);
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

  private async applyScriptPluginContributions(
    plugin: InstalledPluginRecord,
  ): Promise<PluginContributionCounts> {
    const counts: PluginContributionCounts = { ...EMPTY_CONTRIBUTION_COUNTS };
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

    counts.slashCommands = await registerScriptCommands({
      pluginId: plugin.id,
      commands: activation.slashCommands as unknown[],
      registry: this.registries.slashCommands,
      runtime: this.scriptRuntime,
    });
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
    this.cleanup.unregister(plugin.id);
    this.registries.oracleTables.unregisterPlugin(plugin.id);
    this.registries.characterSheetTemplates.unregisterPlugin(plugin.id);
    void this.scriptRuntime.deactivatePlugin(plugin.id);
    this.loadedPluginIds.delete(plugin.id);

    this.statuses.set(
      plugin.id,
      this.createStatus(
        plugin,
        "error",
        [...(current?.errors ?? []), error],
        current?.contributions ?? EMPTY_CONTRIBUTION_COUNTS,
      ),
    );
  }

  private createStatus(
    plugin: InstalledPluginRecord,
    status: PluginManagerStatusKind,
    errors: PluginManifestValidationError[] = [],
    contributions: PluginContributionCounts = EMPTY_CONTRIBUTION_COUNTS,
  ): PluginManagerStatus {
    return createPluginManagerStatus(plugin, status, errors, contributions);
  }
}

async function readInstalledPluginEntry(input: {
  pluginId: string;
  entry: string;
}): Promise<string> {
  throw new Error(
    `Plugin entry reader is not configured for ${input.pluginId}:${input.entry}`,
  );
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
