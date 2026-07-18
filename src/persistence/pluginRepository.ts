import type Database from "@tauri-apps/plugin-sql";
import type { PluginManifest } from "../plugins/pluginTypes";
import { nowIso } from "./id";

export type InstalledPluginRecord = {
  id: string;
  name: string;
  version: string;
  type: PluginManifest["type"];
  enabled: boolean;
  manifest: PluginManifest;
  installedAt: string;
  updatedAt: string;
};

export type PluginStorageRecord<T = unknown> = {
  pluginId: string;
  key: string;
  value: T;
};

type InstalledPluginRow = {
  id: string;
  name: string;
  version: string;
  type: PluginManifest["type"];
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

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

function stringifyJson(value: unknown): string {
  const json = JSON.stringify(value);

  if (typeof json !== "string") {
    throw new Error("Plugin storage value must be JSON serializable");
  }

  return json;
}

function mapInstalledPlugin(row: InstalledPluginRow): InstalledPluginRecord {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    type: row.type,
    enabled: row.enabled === 1,
    manifest: parseJson<PluginManifest>(row.manifest_json),
    installedAt: row.installed_at,
    updatedAt: row.updated_at,
  };
}

function mapPluginStorage<T>(row: PluginStorageRow): PluginStorageRecord<T> {
  return {
    pluginId: row.plugin_id,
    key: row.key,
    value: parseJson<T>(row.value_json),
  };
}

export class PluginRepository {
  constructor(private readonly db: Database) {}

  async listInstalled() {
    const rows = await this.db.select<InstalledPluginRow[]>(
      `SELECT id, name, version, type, enabled, manifest_json, installed_at, updated_at
       FROM installed_plugins
       ORDER BY name COLLATE NOCASE ASC, id ASC`,
    );

    return rows.map(mapInstalledPlugin);
  }

  async get(id: string) {
    const rows = await this.db.select<InstalledPluginRow[]>(
      `SELECT id, name, version, type, enabled, manifest_json, installed_at, updated_at
       FROM installed_plugins
       WHERE id = $1
       LIMIT 1`,
      [id],
    );

    return rows[0] ? mapInstalledPlugin(rows[0]) : null;
  }

  async install(manifest: PluginManifest) {
    const current = await this.get(manifest.id);
    const timestamp = nowIso();
    const plugin: InstalledPluginRecord = {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      type: manifest.type,
      enabled: current?.enabled ?? true,
      manifest,
      installedAt: current?.installedAt ?? timestamp,
      updatedAt: timestamp,
    };

    await this.db.execute(
      `INSERT INTO installed_plugins
       (id, name, version, type, enabled, manifest_json, installed_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         version = excluded.version,
         type = excluded.type,
         enabled = excluded.enabled,
         manifest_json = excluded.manifest_json,
         updated_at = excluded.updated_at`,
      [
        plugin.id,
        plugin.name,
        plugin.version,
        plugin.type,
        plugin.enabled ? 1 : 0,
        JSON.stringify(plugin.manifest),
        plugin.installedAt,
        plugin.updatedAt,
      ],
    );

    return plugin;
  }

  async setEnabled(id: string, enabled: boolean) {
    const current = await this.get(id);

    if (!current) {
      return null;
    }

    const updated: InstalledPluginRecord = {
      ...current,
      enabled,
      updatedAt: nowIso(),
    };

    await this.db.execute(
      `UPDATE installed_plugins
       SET enabled = $1,
           updated_at = $2
       WHERE id = $3`,
      [updated.enabled ? 1 : 0, updated.updatedAt, updated.id],
    );

    return updated;
  }

  async uninstall(id: string) {
    await this.db.execute(`DELETE FROM installed_plugins WHERE id = $1`, [id]);
  }

  async getStorage<T = unknown>(pluginId: string, key: string) {
    const rows = await this.db.select<PluginStorageRow[]>(
      `SELECT plugin_id, key, value_json
       FROM plugin_storage
       WHERE plugin_id = $1
         AND key = $2
       LIMIT 1`,
      [pluginId, key],
    );

    return rows[0] ? mapPluginStorage<T>(rows[0]).value : null;
  }

  async setStorage<T = unknown>(pluginId: string, key: string, value: T) {
    const storage: PluginStorageRecord<T> = {
      pluginId,
      key,
      value,
    };

    await this.db.execute(
      `INSERT INTO plugin_storage (plugin_id, key, value_json)
       VALUES ($1, $2, $3)
       ON CONFLICT(plugin_id, key) DO UPDATE SET value_json = excluded.value_json`,
      [storage.pluginId, storage.key, stringifyJson(storage.value)],
    );

    return storage;
  }

  async removeStorage(pluginId: string, key: string) {
    await this.db.execute(
      `DELETE FROM plugin_storage
       WHERE plugin_id = $1
         AND key = $2`,
      [pluginId, key],
    );
  }

  async listStorageKeys(pluginId: string) {
    const rows = await this.db.select<Array<{ key: string }>>(
      `SELECT key
       FROM plugin_storage
       WHERE plugin_id = $1
       ORDER BY key ASC`,
      [pluginId],
    );

    return rows.map((row) => row.key);
  }

  async clearStorage(pluginId: string) {
    await this.db.execute(`DELETE FROM plugin_storage WHERE plugin_id = $1`, [
      pluginId,
    ]);
  }
}
