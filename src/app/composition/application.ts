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
} from "../../features/plugins";
import { CharacterSheetRepository } from "../../persistence/characterSheetRepository";
import { PluginRepository } from "../../persistence/pluginRepository";
import { PluginManager } from "../../plugins/pluginManager";
import {
  CryptoIdGenerator,
  SystemClock,
} from "../../shared/infrastructure/systemValues";

export type Application = {
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
  const manager = new PluginManager(repositories.plugins);
  const lifecycle = new PluginLifecycleAdapter(manager);
  const templates = new PluginTemplateAdapter(repositories);
  const plugins = new SqlitePluginRepository(repositories.plugins);
  const reloadPlugins = createReloadPlugins({ lifecycle, templates });
  const pluginDependencies = { plugins, reloadPlugins };

  return {
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
