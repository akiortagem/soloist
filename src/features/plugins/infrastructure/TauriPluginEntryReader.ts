import { invoke } from "@tauri-apps/api/core";

import type { PluginEntryReader } from "../../../plugins/pluginManager";

export const readTauriPluginEntry: PluginEntryReader = (input) =>
  invoke<string>("read_plugin_entry", input);
