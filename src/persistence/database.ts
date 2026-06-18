import Database from "@tauri-apps/plugin-sql";

export const DATABASE_URL = "sqlite:soloist.db";

let databasePromise: Promise<Database> | undefined;

export function getDatabase() {
  databasePromise ??= Database.load(DATABASE_URL);
  return databasePromise;
}
