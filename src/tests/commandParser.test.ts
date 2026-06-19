import { describe, expect, it } from "vitest";
import { parseCommand } from "../commands/parseCommand";
import {
  extractCommandName,
  normalizeWhitespace,
  parseQuotedString,
  startsWithSlash,
  tokenizeArgs,
  trimCommandInput,
} from "../commands/parserUtils";

describe("command parser foundation", () => {
  it("handles an empty string safely", () => {
    expect(parseCommand("")).toEqual({
      type: "unknown",
      raw: "",
      reason: "Command input is empty",
    });
  });

  it("handles text that does not start with slash", () => {
    expect(parseCommand("roll 1d20+3")).toEqual({
      type: "unknown",
      raw: "roll 1d20+3",
      reason: "Command input must start with /",
    });
  });

  it("identifies roll commands as unknown for now", () => {
    expect(parseCommand("/roll 1d20+3")).toEqual({
      type: "unknown",
      raw: "/roll 1d20+3",
      commandName: "roll",
      reason: "Command parser not implemented yet",
    });
  });

  it("identifies ask commands as unknown for now", () => {
    expect(parseCommand("/ask likely Is the guard asleep?")).toMatchObject({
      type: "unknown",
      raw: "/ask likely Is the guard asleep?",
      commandName: "ask",
    });
  });

  it("identifies scene commands with quoted args", () => {
    expect(parseCommand('/scene "I visit the guild"')).toMatchObject({
      type: "unknown",
      commandName: "scene",
    });
  });

  it("identifies stat commands with quoted args", () => {
    expect(parseCommand('/stat "Kael Voss" HP -4')).toMatchObject({
      type: "unknown",
      commandName: "stat",
    });
  });

  it("identifies chaos commands", () => {
    expect(parseCommand("/chaos +1")).toMatchObject({
      type: "unknown",
      commandName: "chaos",
    });
  });
});

describe("parser utilities", () => {
  it("trims command input and checks slash prefix", () => {
    expect(trimCommandInput("  /roll 1d20  ")).toBe("/roll 1d20");
    expect(startsWithSlash("  /roll")).toBe(true);
    expect(startsWithSlash("roll")).toBe(false);
  });

  it("extracts command names and args", () => {
    expect(extractCommandName("/roll 1d20+3")).toEqual({
      commandName: "roll",
      argsText: "1d20+3",
    });
  });

  it("parses quoted strings", () => {
    expect(parseQuotedString('"Kael Voss" HP -4')).toEqual({
      value: "Kael Voss",
      rest: "HP -4",
    });
  });

  it("tokenizes arguments while preserving quoted phrases", () => {
    expect(tokenizeArgs("Kael HP -4")).toEqual(["Kael", "HP", "-4"]);
    expect(tokenizeArgs('"Kael Voss" HP -4')).toEqual([
      "Kael Voss",
      "HP",
      "-4",
    ]);
  });

  it("normalizes multiple whitespace characters", () => {
    expect(normalizeWhitespace("  /ask   likely\tIs the guard asleep?  ")).toBe(
      "/ask likely Is the guard asleep?",
    );
  });
});
