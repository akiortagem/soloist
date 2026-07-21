import { describe, expect, it } from "vitest";
import type { SlashCommandDefinition } from "../../commands";
import { commandOptionMatches } from "./slashMenu";

const option: SlashCommandDefinition = {
  id: "roll",
  name: "roll",
  label: "Roll Dice",
  prefix: "/roll ",
  source: "core",
};

describe("slash menu filtering", () => {
  it("shows all commands for an empty query", () => {
    expect(commandOptionMatches(option, "")).toBe(true);
  });

  it("matches labels and command names", () => {
    expect(commandOptionMatches(option, "dice")).toBe(true);
    expect(commandOptionMatches(option, "roll")).toBe(true);
    expect(commandOptionMatches(option, "scene")).toBe(false);
  });
});
