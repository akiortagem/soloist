import type { CharacterSheet } from "./characterSheetTypes";

export function renameCharacterSheet(sheet: CharacterSheet, name: string): CharacterSheet {
  return { ...sheet, name };
}
