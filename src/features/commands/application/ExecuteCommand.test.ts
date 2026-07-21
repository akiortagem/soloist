import { describe, expect, it, vi } from "vitest";
import type { CommandEffects } from "./ports/CommandEffects";
import { createExecuteCommand } from "./ExecuteCommand";
import { demoOracleProvider } from "../../../oracle/DemoOracleProvider";

function createHarness() {
  const effects: CommandEffects = {
    snapshot: () => ({ hasActiveSession: true, combatState: null }),
    applyStatDelta: vi.fn(() => ({ ok: false as const, reason: "unused" })),
    applyTrackerStatChange: vi.fn(() => ({
      ok: false as const,
      reason: "unused",
    })),
    applyChaosDelta: vi.fn(() => ({ ok: false as const, reason: "unused" })),
    startCombat: vi.fn(),
    saveCombatState: vi.fn(),
    requestCombatPanel: vi.fn(),
  };
  const execute = createExecuteCommand({
    effects,
    values: {
      id: (prefix) => `${prefix}-fixed`,
      now: () => "2026-01-01T00:00:00.000Z",
      random: () => 0,
      activeOracle: () => demoOracleProvider,
      oracleTable: () => undefined,
    },
  });
  return { effects, execute };
}

describe("ExecuteCommand", () => {
  it("constructs scene results deterministically", async () => {
    const { execute } = createHarness();
    await expect(
      execute(
        { type: "scene", raw: "/scene" },
        { chaosFactor: 5, isInsideCombatSpace: false },
      ),
    ).resolves.toEqual({
      type: "insertSceneContainer",
      payload: { id: "scene-fixed", description: "", descriptionLocked: false },
    });
  });

  it("constructs ordinary result blocks from injected values", async () => {
    const { execute } = createHarness();
    await expect(
      execute(
        { type: "roll", raw: "/roll d20", formula: "d20" },
        { chaosFactor: 5, isInsideCombatSpace: false },
      ),
    ).resolves.toMatchObject({
      type: "insertResultBlock",
      display: "inline",
      block: {
        id: "roll-fixed",
        type: "roll",
        createdAt: "2026-01-01T00:00:00.000Z",
        payload: { total: 1 },
      },
    });
  });

  it("constructs deterministic errors for unavailable sessions", async () => {
    const { execute, effects } = createHarness();
    effects.snapshot = () => ({ hasActiveSession: false, combatState: null });
    await expect(
      execute(
        { type: "scene", raw: "/scene" },
        { chaosFactor: 5, isInsideCombatSpace: false },
      ),
    ).resolves.toMatchObject({
      type: "insertResultBlock",
      block: {
        id: "error-fixed",
        createdAt: "2026-01-01T00:00:00.000Z",
        payload: { commandName: "scene", reason: "No active session" },
      },
    });
  });

  it("makes combat persistence and panel effects explicit", async () => {
    const { effects, execute } = createHarness();
    await execute(
      { type: "combat", raw: "/combat", action: "begin" },
      { chaosFactor: 5, isInsideCombatSpace: false },
    );
    expect(effects.startCombat).toHaveBeenCalledOnce();
    expect(effects.requestCombatPanel).toHaveBeenCalledWith("open");
  });
});
