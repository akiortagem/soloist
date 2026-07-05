import { afterEach, describe, expect, it } from "vitest";

import { createAskCommandResultBlock } from "../commands/createCommandResultBlock";
import type { OracleProvider } from "../oracle/OracleProvider";
import {
  DEFAULT_ORACLE_PROVIDER_ID,
  getActiveOracleProvider,
  getOracleProvider,
  listOracleProviders,
  registerOracleProvider,
  setActiveOracleProvider,
} from "../oracle/oracleRegistry";

const testOracleProvider: OracleProvider = {
  id: "test-oracle",
  name: "Test Oracle",
  description: "Oracle provider used by registry tests.",
  askYesNo(input) {
    return {
      question: input.question,
      odds: input.odds,
      roll: input.d100,
      answer: "Yes",
      exceptional: false,
      chaosFactor: input.chaosFactor,
      providerId: "test-oracle",
      providerName: "Test Oracle",
      explanation: "Test oracle result.",
    };
  },
  setupScene(input) {
    return {
      prompt: input.prompt,
      roll: input.roll,
      chaosFactor: input.chaosFactor,
      adjustmentType: "Test Scene",
      providerId: "test-oracle",
      providerName: "Test Oracle",
      explanation: "Test scene result.",
    };
  },
};

afterEach(() => {
  setActiveOracleProvider(DEFAULT_ORACLE_PROVIDER_ID);
});

describe("oracle registry", () => {
  it("keeps the demo oracle as the default provider", () => {
    expect(getActiveOracleProvider().id).toBe(DEFAULT_ORACLE_PROVIDER_ID);
    expect(getOracleProvider(DEFAULT_ORACLE_PROVIDER_ID)?.id).toBe(
      DEFAULT_ORACLE_PROVIDER_ID,
    );
    expect(listOracleProviders().some((provider) => provider.id === "demo")).toBe(
      true,
    );
  });

  it("registers and selects an active oracle provider", () => {
    registerOracleProvider(testOracleProvider);

    const activeProvider = setActiveOracleProvider(testOracleProvider.id);

    expect(activeProvider).toBe(testOracleProvider);
    expect(getActiveOracleProvider()).toBe(testOracleProvider);
    expect(getOracleProvider(testOracleProvider.id)).toBe(testOracleProvider);
  });

  it("falls back to the demo provider when the selected id is missing", () => {
    registerOracleProvider(testOracleProvider);
    setActiveOracleProvider(testOracleProvider.id);

    const activeProvider = setActiveOracleProvider("missing-provider");

    expect(activeProvider.id).toBe(DEFAULT_ORACLE_PROVIDER_ID);
    expect(getActiveOracleProvider().id).toBe(DEFAULT_ORACLE_PROVIDER_ID);
  });

  it("uses the active provider for /ask result blocks", () => {
    registerOracleProvider(testOracleProvider);
    setActiveOracleProvider(testOracleProvider.id);

    const block = createAskCommandResultBlock(
      {
        type: "ask",
        raw: "/ask likely Is the gate open?",
        odds: "likely",
        question: "Is the gate open?",
      },
      8,
    );
    const payload =
      block.payload && typeof block.payload === "object"
        ? (block.payload as Record<string, unknown>)
        : {};

    expect(block.type).toBe("oracle");
    expect(payload.providerId).toBe(testOracleProvider.id);
    expect(payload.providerName).toBe(testOracleProvider.name);
    expect(payload.chaosFactor).toBe(8);
  });
});
