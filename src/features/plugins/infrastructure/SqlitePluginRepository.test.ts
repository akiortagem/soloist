import { describe, expect, it, vi } from "vitest";
import type { PluginRepository as LegacyPluginRepository } from "../../../persistence/pluginRepository";
import type { PluginManifest } from "../../../plugins/pluginTypes";
import { SqlitePluginRepository } from "./SqlitePluginRepository";

const manifest: PluginManifest = {
  id: "soloist-plugin.test",
  name: "Test",
  version: "1.0.0",
  soloistApiVersion: "1",
  type: "data",
};

describe("SQLite plugin workflow adapter", () => {
  it("delegates only the persistence operations required by use cases", async () => {
    const installed = {
      ...manifest,
      enabled: true,
      manifest,
      installedAt: "created",
      updatedAt: "updated",
    };
    const legacy = {
      get: vi.fn().mockResolvedValue(installed),
      install: vi.fn().mockResolvedValue(installed),
      setEnabled: vi.fn().mockResolvedValue({ ...installed, enabled: false }),
      uninstall: vi.fn().mockResolvedValue(undefined),
    } as unknown as LegacyPluginRepository;
    const repository = new SqlitePluginRepository(legacy);

    await expect(repository.get(manifest.id)).resolves.toEqual(installed);
    await expect(repository.install(manifest)).resolves.toEqual(installed);
    await expect(
      repository.setEnabled(manifest.id, false),
    ).resolves.toMatchObject({
      enabled: false,
    });
    await expect(repository.uninstall(manifest.id)).resolves.toBeUndefined();
    expect(legacy.uninstall).toHaveBeenCalledWith(manifest.id);
  });
});
