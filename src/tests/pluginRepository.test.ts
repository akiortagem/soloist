import type Database from "@tauri-apps/plugin-sql";
import { describe, expect, it } from "vitest";
import {
  type InstalledPluginRecord,
  PluginRepository,
} from "../persistence/pluginRepository";
import type { PluginManifest } from "../plugins/pluginTypes";

type InstalledPluginRow = {
  id: string;
  name: string;
  version: string;
  type: string;
  enabled: number;
  manifest_json: string;
  installed_at: string;
  updated_at: string;
};

type PluginStorageRow = {
  plugin_id: string;
  key: string;
  value_json: string;
};

const manifest: PluginManifest = {
  id: "soloist-plugin.test",
  name: "Test Plugin",
  version: "1.0.0",
  soloistApiVersion: "1",
  type: "data",
  contributes: {
    slashCommands: [
      {
        id: "test.command",
        name: "test",
        label: "Test",
        prefix: "/test",
        commandText: "/roll 1d6",
      },
    ],
  },
};

class FakePluginDatabase {
  readonly installedPlugins = new Map<string, InstalledPluginRow>();
  readonly pluginStorage = new Map<string, PluginStorageRow>();

  async select<T>(query: string, bindValues: unknown[] = []): Promise<T> {
    if (query.includes("FROM installed_plugins")) {
      if (query.includes("WHERE id = $1")) {
        const id = bindValues[0] as string;
        const row = this.installedPlugins.get(id);
        return (row ? [row] : []) as T;
      }

      return [...this.installedPlugins.values()].sort(comparePluginRows) as T;
    }

    if (query.includes("FROM plugin_storage")) {
      const [pluginId, key] = bindValues as [string, string];
      const row = this.pluginStorage.get(storageId(pluginId, key));
      return (row ? [row] : []) as T;
    }

    throw new Error(`Unexpected select query: ${query}`);
  }

  async execute(query: string, bindValues: unknown[] = []) {
    if (query.includes("INSERT INTO installed_plugins")) {
      const [
        id,
        name,
        version,
        type,
        enabled,
        manifestJson,
        installedAt,
        updatedAt,
      ] = bindValues as [string, string, string, string, number, string, string, string];

      this.installedPlugins.set(id, {
        id,
        name,
        version,
        type,
        enabled,
        manifest_json: manifestJson,
        installed_at: this.installedPlugins.get(id)?.installed_at ?? installedAt,
        updated_at: updatedAt,
      });

      return { rowsAffected: 1, lastInsertId: 0 };
    }

    if (query.includes("UPDATE installed_plugins")) {
      const [enabled, updatedAt, id] = bindValues as [number, string, string];
      const current = this.installedPlugins.get(id);

      if (current) {
        this.installedPlugins.set(id, {
          ...current,
          enabled,
          updated_at: updatedAt,
        });
      }

      return { rowsAffected: current ? 1 : 0, lastInsertId: 0 };
    }

    if (query.includes("DELETE FROM installed_plugins")) {
      const id = bindValues[0] as string;
      const rowsAffected = this.installedPlugins.delete(id) ? 1 : 0;

      for (const storageKey of [...this.pluginStorage.keys()]) {
        if (storageKey.startsWith(`${id}\u0000`)) {
          this.pluginStorage.delete(storageKey);
        }
      }

      return { rowsAffected, lastInsertId: 0 };
    }

    if (query.includes("INSERT INTO plugin_storage")) {
      const [pluginId, key, valueJson] = bindValues as [string, string, string];

      this.pluginStorage.set(storageId(pluginId, key), {
        plugin_id: pluginId,
        key,
        value_json: valueJson,
      });

      return { rowsAffected: 1, lastInsertId: 0 };
    }

    throw new Error(`Unexpected execute query: ${query}`);
  }
}

function storageId(pluginId: string, key: string) {
  return `${pluginId}\u0000${key}`;
}

function comparePluginRows(a: InstalledPluginRow, b: InstalledPluginRow) {
  return (
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) ||
    a.id.localeCompare(b.id)
  );
}

function createRepository() {
  const db = new FakePluginDatabase();
  return {
    db,
    repository: new PluginRepository(db as unknown as Database),
  };
}

describe("PluginRepository", () => {
  it("installs and lists plugins from SQLite rows", async () => {
    const { repository } = createRepository();

    const installed = await repository.install(manifest);
    const plugins = await repository.listInstalled();

    expect(installed).toMatchObject({
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      type: manifest.type,
      enabled: true,
      manifest,
    } satisfies Partial<InstalledPluginRecord>);
    expect(plugins).toHaveLength(1);
    expect(plugins[0]).toMatchObject({
      id: manifest.id,
      manifest,
    });
  });

  it("gets plugins and enables or disables them", async () => {
    const { repository } = createRepository();
    await repository.install(manifest);

    const disabled = await repository.setEnabled(manifest.id, false);
    const persisted = await repository.get(manifest.id);

    expect(disabled?.enabled).toBe(false);
    expect(persisted?.enabled).toBe(false);

    const enabled = await repository.setEnabled(manifest.id, true);

    expect(enabled?.enabled).toBe(true);
    expect(await repository.setEnabled("missing", false)).toBeNull();
  });

  it("stores values by plugin id and key", async () => {
    const { repository } = createRepository();
    await repository.install(manifest);
    await repository.install({ ...manifest, id: "soloist-plugin.other" });

    await repository.setStorage(manifest.id, "config", {
      theme: "dark",
      count: 2,
    });
    await repository.setStorage("soloist-plugin.other", "config", {
      theme: "light",
    });

    await repository.setStorage(manifest.id, "config", {
      theme: "dark",
      count: 3,
    });

    await expect(
      repository.getStorage<{ theme: string; count: number }>(
        manifest.id,
        "config",
      ),
    ).resolves.toEqual({
      theme: "dark",
      count: 3,
    });
    await expect(
      repository.getStorage<{ theme: string }>(
        "soloist-plugin.other",
        "config",
      ),
    ).resolves.toEqual({ theme: "light" });
    await expect(repository.getStorage(manifest.id, "missing")).resolves.toBeNull();
  });

  it("rejects top-level non-JSON storage values", async () => {
    const { repository } = createRepository();
    await repository.install(manifest);

    await expect(
      repository.setStorage(manifest.id, "bad", undefined),
    ).rejects.toThrow("Plugin storage value must be JSON serializable");
  });

  it("uninstalls plugins and cascades plugin storage", async () => {
    const { repository } = createRepository();
    await repository.install(manifest);
    await repository.setStorage(manifest.id, "config", { enabled: true });

    await repository.uninstall(manifest.id);

    await expect(repository.get(manifest.id)).resolves.toBeNull();
    await expect(repository.getStorage(manifest.id, "config")).resolves.toBeNull();
  });
});
