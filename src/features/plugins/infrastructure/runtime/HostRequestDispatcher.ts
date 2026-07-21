import type { PluginRepository } from "../../../../persistence/pluginRepository";
import { assertJsonSafe } from "../../../../plugins/pluginValidation";

export class HostRequestDispatcher {
  constructor(private readonly repository?: PluginRepository) {}

  async dispatch(
    action: string,
    payload: Record<string, unknown>,
  ): Promise<unknown> {
    if (!this.repository) throw new Error("Plugin storage is unavailable");
    const pluginId =
      typeof payload.pluginId === "string" ? payload.pluginId : "";
    const key = typeof payload.key === "string" ? payload.key : "";
    if (!pluginId) throw new Error("Plugin id is required");

    switch (action) {
      case "storage.get":
        return (await this.repository.getStorage(pluginId, key)) ?? undefined;
      case "storage.set":
        assertJsonSafe(payload.value, "Plugin storage value");
        await this.repository.setStorage(pluginId, key, payload.value);
        return undefined;
      case "storage.remove":
        await this.repository.removeStorage(pluginId, key);
        return undefined;
      case "storage.keys":
        return this.repository.listStorageKeys(pluginId);
      case "storage.clear":
        await this.repository.clearStorage(pluginId);
        return undefined;
      default:
        throw new Error(`Unsupported plugin host request: ${action}`);
    }
  }
}
