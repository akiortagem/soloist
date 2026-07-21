import type { CharacterSheetTemplate } from "../../../../domain/domainTypes";
import type { PluginManifest } from "../../../../plugins/pluginTypes";
import type { PluginStatus } from "../../domain/PluginStatus";

export type InstalledPlugin = {
  id: string;
  name: string;
  version: string;
  type: PluginManifest["type"];
  enabled: boolean;
  manifest: PluginManifest;
  installedAt: string;
  updatedAt: string;
};

export interface PluginRepository {
  get(id: string): Promise<InstalledPlugin | null>;
  install(manifest: PluginManifest): Promise<InstalledPlugin>;
  setEnabled(id: string, enabled: boolean): Promise<InstalledPlugin | null>;
  uninstall(id: string): Promise<void>;
}

export interface PluginLifecycle {
  reload(): Promise<PluginStatus[]>;
  unregister(pluginId: string): void;
}

export interface PluginTemplates {
  refresh(): Promise<void>;
  list(): Promise<CharacterSheetTemplate[]>;
  reinstall(input: {
    pluginId: string;
    contributionId: string;
  }): Promise<CharacterSheetTemplate>;
}

export interface PluginFiles {
  removeInstalledFolder(pluginId: string): Promise<void>;
}

export type PluginView = {
  statuses: PluginStatus[];
  templates: CharacterSheetTemplate[];
};
