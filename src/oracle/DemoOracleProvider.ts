import type { OracleProvider } from "./OracleProvider";

export const demoOracleProvider: OracleProvider = {
  id: "demo",
  name: "Demo Oracle",
  description: "Simple built-in oracle provider to let you play solo TRPG",
  askYesNo(input) {
    return {
      question: input.question,
      odds: input.odds,
      roll: input.d100,
      answer: input.d100 <= 50 ? "Yes" : "No",
      exceptional: input.d100 % 11 === 0,
      chaosFactor: input.chaosFactor,
      providerId: "demo",
      providerName: "Demo Oracle",
      explanation: "Demo oracle result",
    };
  },
  setupScene(input) {
    const adjustmentType =
      input.roll <= 3
        ? "Altered Scene"
        : input.roll <= 6
          ? "Interrupt Scene"
          : "Normal Scene";

    return {
      prompt: input.prompt,
      roll: input.roll,
      chaosFactor: input.chaosFactor,
      adjustmentType,
      providerId: "demo",
      providerName: "Demo Oracle",
      explanation: "The scene proceeds",
    };
  },
};
