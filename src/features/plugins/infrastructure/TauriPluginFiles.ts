import { invoke } from "@tauri-apps/api/core";
import type { PluginFiles } from "../application/ports/PluginPorts";

export class TauriPluginFiles implements PluginFiles {
  async removeInstalledFolder(pluginId: string) {
    await invoke("uninstall_plugin_folder", { pluginId });
  }
}
