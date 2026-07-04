import type { CharacterSheet } from "./characterSheetTypes";

export function renameCharacterSheet(sheet: CharacterSheet, name: string): CharacterSheet {
  return { ...sheet, name };
}

export function normalizeCharacterSheetNick(nick: string) {
  return nick
    .trim()
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createUniqueCharacterSheetNick(
  name: string,
  sheets: CharacterSheet[],
  options?: { excludeSheetId?: string },
) {
  const baseNick = normalizeCharacterSheetNick(name) || "character";
  const usedNicks = new Set(
    sheets
      .filter((sheet) => sheet.id !== options?.excludeSheetId)
      .map((sheet) => sheet.nick)
      .filter((nick): nick is string => Boolean(nick))
      .map(normalizeCharacterSheetNick),
  );

  if (!usedNicks.has(baseNick)) {
    return baseNick;
  }

  let suffix = 2;
  let candidate = `${baseNick}${suffix}`;

  while (usedNicks.has(candidate)) {
    suffix += 1;
    candidate = `${baseNick}${suffix}`;
  }

  return candidate;
}

export function findCharacterSheetForStatTarget(
  sheets: CharacterSheet[],
  target: string,
) {
  const normalizedTarget = normalizeCharacterSheetNick(target);
  const nickMatch =
    sheets.find(
      (sheet) =>
        sheet.nick &&
        normalizeCharacterSheetNick(sheet.nick) === normalizedTarget,
    ) ?? null;

  if (nickMatch) {
    return nickMatch;
  }

  const normalizedName = target.trim().toLocaleLowerCase();

  return (
    sheets.find(
      (sheet) =>
        !sheet.nick &&
        sheet.name.trim().toLocaleLowerCase() === normalizedName,
    ) ?? null
  );
}
