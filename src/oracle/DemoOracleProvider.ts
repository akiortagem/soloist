import type { OracleProvider } from "./OracleProvider";

export const demoOracleProvider: OracleProvider = {
  id: "demo",
  name: "Demo Oracle — not Mythic GME 2e",
  description: "Simple built-in oracle provider for MVP development.",
  askYesNo(input) {
    return {
      question: input.question,
      odds: input.odds,
      roll: input.d100,
      answer: input.d100 <= 50 ? "Yes" : "No",
      exceptional: input.d100 % 11 === 0,
      chaosFactor: input.chaosFactor,
      providerId: "demo",
      providerName: "Demo Oracle — not Mythic GME 2e",
      explanation: "Demo oracle result. Not Mythic GME 2e.",
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
      providerName: "Demo Oracle — not Mythic GME 2e",
      explanation: "The scene proceeds using the demo provider.",
    };
  },
};
