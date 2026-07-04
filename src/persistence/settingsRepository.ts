import type Database from "@tauri-apps/plugin-sql";

export type AppSettingRecord = {
  key: string;
  valueJson: string;
};

export class SettingsRepository {
  constructor(private readonly db: Database) {}

  async get(key: string) {
    const rows = await this.db.select<AppSettingRecord[]>(
      `SELECT key, value_json
       FROM app_settings
       WHERE key = $1
       LIMIT 1`,
      [key],
    );

    return rows[0] ?? null;
  }

  async set(input: { key: string; valueJson: string }) {
    const setting: AppSettingRecord = {
      key: input.key,
      valueJson: input.valueJson,
    };

    await this.db.execute(
      `INSERT INTO app_settings (key, value_json)
       VALUES ($1, $2)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
      [setting.key, setting.valueJson],
    );

    return setting;
  }
}
