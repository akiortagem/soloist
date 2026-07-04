import { describe, expect, it } from "vitest";
import type { CharacterSheet } from "../domain/domainTypes";
import {
  createUniqueCharacterSheetNick,
  findCharacterSheetForStatTarget,
  normalizeCharacterSheetNick,
} from "../characterSheets/characterSheetLogic";

function sheet(input: Partial<CharacterSheet> & { id: string }): CharacterSheet {
  return {
    sessionId: "session_1",
    name: "Kael",
    fields: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...input,
  };
}

describe("character sheet nick logic", () => {
  it("normalizes names into command-friendly lowercase nicks", () => {
    expect(normalizeCharacterSheetNick("Kael Voss")).toBe("kael-voss");
    expect(normalizeCharacterSheetNick("  Élan / The Bold!  ")).toBe(
      "elan-the-bold",
    );
  });

  it("creates a unique generated nick with numeric suffixes", () => {
    expect(
      createUniqueCharacterSheetNick("Kael", [
        sheet({ id: "sheet_1", nick: "kael" }),
        sheet({ id: "sheet_2", nick: "kael2" }),
      ]),
    ).toBe("kael3");
  });

  it("targets nick before falling back to names on sheets without nicks", () => {
    const sheets = [
      sheet({ id: "sheet_1", name: "Kael", nick: "hero" }),
      sheet({ id: "sheet_2", name: "Kael", nick: "kael" }),
      sheet({ id: "sheet_3", name: "Bandit" }),
    ];

    expect(findCharacterSheetForStatTarget(sheets, "Kael")?.id).toBe("sheet_2");
    expect(findCharacterSheetForStatTarget(sheets, "Bandit")?.id).toBe(
      "sheet_3",
    );
  });

  it("does not fall back to name for a sheet that already has a different nick", () => {
    expect(
      findCharacterSheetForStatTarget(
        [sheet({ id: "sheet_1", name: "Kael", nick: "hero" })],
        "Kael",
      ),
    ).toBeNull();
  });
});
