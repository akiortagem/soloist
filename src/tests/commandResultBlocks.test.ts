import { describe, expect, it } from "vitest";

import type { ParsedInvalidCommand, ParsedRollCommand } from "../commands/commandTypes";
import {
  createInvalidCommandResultBlock,
  createRollCommandResultBlock,
} from "../editor/resultBlocks/createResultBlock";

function payloadRecord(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
}

describe("command result blocks", () => {
  it("creates a roll result block from a parsed /roll command", () => {
    const command: ParsedRollCommand = {
      type: "roll",
      raw: "/roll d20",
      formula: "d20",
    };

    const block = createRollCommandResultBlock(command);
    const payload = payloadRecord(block.payload);

    expect(block.type).toBe("roll");
    expect(block.commandText).toBe("/roll d20");
    expect(block.collapsed).toBeUndefined();
    expect(payload.formula).toBe("d20");
    expect(typeof payload.total).toBe("number");
    expect(Array.isArray(payload.terms)).toBe(true);
  });

  it("creates an error result block from an invalid parsed command", () => {
    const command: ParsedInvalidCommand = {
      type: "invalid",
      raw: "/roll",
      commandName: "roll",
      reason: "Missing dice formula",
    };

    const block = createInvalidCommandResultBlock(command);
    const payload = payloadRecord(block.payload);

    expect(block.type).toBe("error");
    expect(block.commandText).toBe("/roll");
    expect(payload.commandName).toBe("roll");
    expect(payload.reason).toBe("Missing dice formula");
  });
});
