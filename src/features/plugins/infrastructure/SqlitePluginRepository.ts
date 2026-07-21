import type { PluginRepository as LegacyPluginRepository } from "../../../persistence/pluginRepository";
import type { PluginManifest } from "../../../plugins/pluginTypes";
import type { PluginRepository } from "../application/ports/PluginPorts";

export class SqlitePluginRepository implements PluginRepository {
  constructor(private readonly repository: LegacyPluginRepository) {}

  get(id: string) {
    return this.repository.get(id);
  }

  install(manifest: PluginManifest) {
    return this.repository.install(manifest);
  }

  setEnabled(id: string, enabled: boolean) {
    return this.repository.setEnabled(id, enabled);
  }

  uninstall(id: string) {
    return this.repository.uninstall(id);
  }
}
