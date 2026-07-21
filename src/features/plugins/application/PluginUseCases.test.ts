import { describe, expect, it, vi } from "vitest";
import type { CharacterSheetTemplate } from "../../../domain/domainTypes";
import type { PluginManifest } from "../../../plugins/pluginTypes";
import { createInstallPlugin } from "./InstallPlugin";
import { PluginApplicationError } from "./PluginApplicationError";
import { createReinstallPluginTemplates } from "./ReinstallPluginTemplates";
import { createReloadPlugins } from "./ReloadPlugins";
import { createDisablePlugin, createEnablePlugin } from "./SetPluginEnabled";
import { createUninstallPlugin } from "./UninstallPlugin";
import type {
  InstalledPlugin,
  PluginFiles,
  PluginLifecycle,
  PluginRepository,
  PluginTemplates,
} from "./ports/PluginPorts";

const manifest: PluginManifest = {
  id: "soloist-plugin.templates",
  name: "Templates",
  version: "1.0.0",
  soloistApiVersion: "1",
  type: "data",
  contributes: {
    characterSheetTemplates: [
      { id: "hero", name: "Hero", fields: [] },
      { id: "villain", name: "Villain", fields: [] },
    ],
  },
};

function installed(input: Partial<InstalledPlugin> = {}): InstalledPlugin {
  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    type: manifest.type,
    enabled: true,
    manifest,
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...input,
  };
}

function template(id: string): CharacterSheetTemplate {
  return {
    id,
    name: id,
    fields: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function fakes(initial: InstalledPlugin | null = installed()) {
  let plugin = initial;
  const plugins: PluginRepository = {
    get: vi.fn(async () => plugin),
    install: vi.fn(async (nextManifest) => {
      plugin = installed({ manifest: nextManifest });
      return plugin;
    }),
    setEnabled: vi.fn(async (_id, enabled) => {
      plugin = plugin ? { ...plugin, enabled } : null;
      return plugin;
    }),
    uninstall: vi.fn(async () => {
      plugin = null;
    }),
  };
  const lifecycle: PluginLifecycle = {
    reload: vi.fn(async () => []),
    unregister: vi.fn(),
  };
  const templates: PluginTemplates = {
    refresh: vi.fn(async () => undefined),
    list: vi.fn(async () => [template("existing")]),
    reinstall: vi.fn(async ({ contributionId }) => template(contributionId)),
  };
  const files: PluginFiles = {
    removeInstalledFolder: vi.fn(async () => undefined),
  };
  return { files, lifecycle, plugins, templates };
}

describe("plugin application use cases", () => {
  it("reloads lifecycle contributions, refreshes imports, and lists templates", async () => {
    const { lifecycle, templates } = fakes();
    const result = await createReloadPlugins({ lifecycle, templates })();

    expect(lifecycle.reload).toHaveBeenCalledOnce();
    expect(templates.refresh).toHaveBeenCalledOnce();
    expect(result.templates).toEqual([template("existing")]);
  });

  it("installs a valid manifest and uses the shared refresh workflow", async () => {
    const { plugins } = fakes(null);
    const reloadPlugins = vi.fn(async () => ({ statuses: [], templates: [] }));
    const result = await createInstallPlugin({ plugins, reloadPlugins })({
      manifest,
      enabled: false,
    });

    expect(result.plugin.enabled).toBe(false);
    expect(plugins.setEnabled).toHaveBeenCalledWith(manifest.id, false);
    expect(reloadPlugins).toHaveBeenCalledOnce();
  });

  it("reports that install committed when refresh fails", async () => {
    const { plugins } = fakes(null);
    const failure = new Error("refresh failed");

    await expect(
      createInstallPlugin({
        plugins,
        reloadPlugins: vi.fn().mockRejectedValue(failure),
      })({ manifest }),
    ).rejects.toMatchObject({
      code: "install_failed",
      stage: "refresh",
      committed: true,
      cause: failure,
    });
    await expect(plugins.get(manifest.id)).resolves.toMatchObject({
      id: manifest.id,
    });
  });

  it("rejects invalid manifests with typed validation details", async () => {
    const { plugins } = fakes(null);
    const installPlugin = createInstallPlugin({
      plugins,
      reloadPlugins: vi.fn(),
    });

    await expect(
      installPlugin({ manifest: { ...manifest, soloistApiVersion: "2" } }),
    ).rejects.toMatchObject({ code: "invalid_manifest" });
    expect(plugins.install).not.toHaveBeenCalled();
  });

  it("enables and disables plugins through distinct use cases", async () => {
    const { plugins } = fakes();
    const reloadPlugins = vi.fn(async () => ({ statuses: [], templates: [] }));

    expect(
      (await createDisablePlugin({ plugins, reloadPlugins })(manifest.id))
        .plugin.enabled,
    ).toBe(false);
    expect(
      (await createEnablePlugin({ plugins, reloadPlugins })(manifest.id)).plugin
        .enabled,
    ).toBe(true);
    expect(reloadPlugins).toHaveBeenCalledTimes(2);
  });

  it("returns a typed not-found error when enabling a missing plugin", async () => {
    const { plugins } = fakes(null);
    await expect(
      createEnablePlugin({ plugins, reloadPlugins: vi.fn() })("missing"),
    ).rejects.toEqual(expect.any(PluginApplicationError));
  });

  it("reports that an enabled-state change committed when refresh fails", async () => {
    const { plugins } = fakes();

    await expect(
      createDisablePlugin({
        plugins,
        reloadPlugins: vi.fn().mockRejectedValue(new Error("refresh failed")),
      })(manifest.id),
    ).rejects.toMatchObject({ committed: true, stage: "refresh" });
    await expect(plugins.get(manifest.id)).resolves.toMatchObject({
      enabled: false,
    });
  });

  it("uninstalls, unregisters, reloads, and tolerates folder cleanup failure", async () => {
    const { files, lifecycle, plugins } = fakes();
    vi.mocked(files.removeInstalledFolder).mockRejectedValueOnce(
      new Error("missing folder"),
    );
    const result = await createUninstallPlugin({
      files,
      lifecycle,
      plugins,
    })(manifest.id);

    expect(result.plugin?.id).toBe(manifest.id);
    expect(plugins.uninstall).toHaveBeenCalledWith(manifest.id);
    expect(lifecycle.unregister).toHaveBeenCalledWith(manifest.id);
    expect(lifecycle.reload).toHaveBeenCalledOnce();
  });

  it("allows uninstall reconciliation to be retried after a committed failure", async () => {
    const { files, lifecycle, plugins } = fakes();
    vi.mocked(lifecycle.reload)
      .mockRejectedValueOnce(new Error("refresh failed"))
      .mockResolvedValueOnce([]);
    const uninstallPlugin = createUninstallPlugin({
      files,
      lifecycle,
      plugins,
    });

    await expect(uninstallPlugin(manifest.id)).rejects.toMatchObject({
      committed: true,
      stage: "refresh",
    });
    await expect(uninstallPlugin(manifest.id)).resolves.toEqual({
      plugin: null,
      statuses: [],
    });
  });

  it("reinstalls every template contribution and returns the current list", async () => {
    const { plugins, templates } = fakes();
    const result = await createReinstallPluginTemplates({ plugins, templates })(
      manifest.id,
    );

    expect(result.createdTemplates.map(({ id }) => id)).toEqual([
      "hero",
      "villain",
    ]);
    expect(templates.reinstall).toHaveBeenCalledTimes(2);
    expect(result.templates).toEqual([template("existing")]);
  });

  it("reports partial template creation as committed", async () => {
    const { plugins, templates } = fakes();
    vi.mocked(templates.reinstall)
      .mockResolvedValueOnce(template("hero"))
      .mockRejectedValueOnce(new Error("template failed"));

    await expect(
      createReinstallPluginTemplates({ plugins, templates })(manifest.id),
    ).rejects.toMatchObject({
      code: "template_reinstall_failed",
      committed: true,
      stage: "refresh",
      details: [manifest.id, "1"],
    });
  });
});
