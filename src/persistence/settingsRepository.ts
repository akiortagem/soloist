import type Database from "@tauri-apps/plugin-sql";

export type AppSettingRecord = {
  key: string;
  valueJson: string;
};

export class SettingsRepository {
  constructor(private readonly db: Database) {}

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
