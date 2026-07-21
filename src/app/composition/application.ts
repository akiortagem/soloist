import { createCreateCampaign } from "../../features/campaigns/application/CreateCampaign";
import { SqliteCampaignRepository } from "../../features/campaigns/infrastructure/SqliteCampaignRepository";
import { getDatabase } from "../../persistence/database";
import {
  createInstallPlugin,
  createDisablePlugin,
  createEnablePlugin,
  createReinstallPluginTemplates,
  createReloadPlugins,
  createUninstallPlugin,
  PluginLifecycleAdapter,
  PluginTemplateAdapter,
  SqlitePluginRepository,
  TauriPluginFiles,
  readTauriPluginEntry,
  GlobalPluginContributionCleanup,
} from "../../features/plugins";
import {
  createExecuteCommand,
  StoreCommandEffects,
} from "../../features/commands";
import {
  getActiveOracleProvider,
  oracleTableRegistry,
} from "../../oracle/oracleRegistry";
import { CharacterSheetRepository } from "../../persistence/characterSheetRepository";
import { PluginRepository } from "../../persistence/pluginRepository";
import { PluginManager } from "../../plugins/pluginManager";
import {
  CryptoIdGenerator,
  SystemClock,
} from "../../shared/infrastructure/systemValues";
import { createEditorAdapter } from "./editor";

export type Application = {
  editor: ReturnType<typeof createEditorAdapter>;
  executeCommand: ReturnType<typeof createExecuteCommand>;
  createCampaign: ReturnType<typeof createCreateCampaign>;
  installPlugin: ReturnType<typeof createInstallPlugin>;
  enablePlugin: ReturnType<typeof createEnablePlugin>;
  disablePlugin: ReturnType<typeof createDisablePlugin>;
  uninstallPlugin: ReturnType<typeof createUninstallPlugin>;
  reloadPlugins: ReturnType<typeof createReloadPlugins>;
  reinstallPluginTemplates: ReturnType<typeof createReinstallPluginTemplates>;
};

export async function createApplication(): Promise<Application> {
  const database = await getDatabase();
  const campaigns = new SqliteCampaignRepository(database);
  const repositories = {
    characterSheets: new CharacterSheetRepository(database),
    plugins: new PluginRepository(database),
  };
  const cleanup = new GlobalPluginContributionCleanup();
  const manager = new PluginManager(repositories.plugins, {
    readPluginEntry: readTauriPluginEntry,
    cleanup,
  });
  const lifecycle = new PluginLifecycleAdapter(manager, cleanup);
  const templates = new PluginTemplateAdapter(repositories);
  const plugins = new SqlitePluginRepository(repositories.plugins);
  const reloadPlugins = createReloadPlugins({ lifecycle, templates });
  const pluginDependencies = { plugins, reloadPlugins };
  const commandIds = new CryptoIdGenerator();
  const commandClock = new SystemClock();

  return {
    editor: createEditorAdapter(),
    executeCommand: createExecuteCommand({
      effects: new StoreCommandEffects(),
      values: {
        id: (prefix) => commandIds.generate(prefix),
        now: () => commandClock.now().toISOString(),
        random: () => Math.random(),
        activeOracle: () => getActiveOracleProvider(),
        oracleTable: (id) => oracleTableRegistry.get(id),
      },
    }),
    createCampaign: createCreateCampaign({
      campaigns,
      clock: new SystemClock(),
      ids: new CryptoIdGenerator(),
    }),
    reloadPlugins,
    installPlugin: createInstallPlugin(pluginDependencies),
    enablePlugin: createEnablePlugin(pluginDependencies),
    disablePlugin: createDisablePlugin(pluginDependencies),
    uninstallPlugin: createUninstallPlugin({
      plugins,
      lifecycle,
      files: new TauriPluginFiles(),
    }),
    reinstallPluginTemplates: createReinstallPluginTemplates({
      plugins,
      templates,
    }),
  };
}
