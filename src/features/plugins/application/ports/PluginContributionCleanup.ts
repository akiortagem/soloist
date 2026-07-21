export interface PluginContributionCleanup {
  unregister(pluginId: string): void;
}
